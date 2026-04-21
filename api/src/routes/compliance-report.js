'use strict';

var express = require('express');
var router = express.Router();

var fabric = require('../config/fabric');
var sbomRepository = require('../repositories/sbomRepository');
var canonicalize = require('../utils/canonicalize');
var hash = require('../utils/hash');

router.post('/compliance-report', async function (req, res) {
  var gateway = null;

  try {
    var body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    if (body.sbomID === undefined || body.sbomID === null || typeof body.sbomID !== 'string' || body.sbomID.trim() === '') {
      return res.status(400).json({ error: 'sbomID is required' });
    }

    if (body.sbom === undefined || body.sbom === null) {
      return res.status(400).json({ error: 'sbom is required' });
    }

    var sbomID = body.sbomID.trim();
    var sbom = body.sbom;

    var canonicalizedSBOM;
    var computedHash;

    try {
      canonicalizedSBOM = canonicalize.canonicalizeSBOM(sbom);
      computedHash = hash.hashSBOM(canonicalizedSBOM);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    var pgDocument;
    try {
      pgDocument = await sbomRepository.getSBOMDocumentBySBOMID(sbomID);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to generate compliance report',
        details: err.message,
      });
    }

    if (!pgDocument) {
      return res.status(404).json({ error: 'SBOM record not found' });
    }

    var result = await fabric.getContract();
    gateway = result.gateway;
    var contract = result.contract;

    var verificationBuffer = await contract.evaluateTransaction(
      'VerifyIntegrity',
      sbomID,
      computedHash
    );

    var historyBuffer = await contract.evaluateTransaction(
      'GetHistory',
      sbomID
    );

    var verificationResult;
    try {
      verificationResult = JSON.parse(verificationBuffer.toString('utf8'));
      if (!verificationResult || typeof verificationResult !== 'object' || Array.isArray(verificationResult)) {
        throw new Error('verification is not a valid object');
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse verification response' });
    }

    var historyArray;
    try {
      historyArray = JSON.parse(historyBuffer.toString('utf8'));
      if (!Array.isArray(historyArray)) {
        throw new Error('history is not an array');
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse SBOM history response' });
    }

    var historyLen = historyArray.length;
    var latestTx = historyLen > 0 ? historyArray[historyLen - 1] : null;

    var complianceReport = {
      sbomID: sbomID,
      computedHash: computedHash,
      storedHash: verificationResult.storedHash || pgDocument.sbom_hash,
      integrityMatch: verificationResult.match,
      ledgerStatus: verificationResult.status,
      historyCount: historyLen,
      latestTxID: latestTx ? latestTx.txID : null,
      latestTimestamp: latestTx ? latestTx.timestamp : null,
      latestIsDelete: latestTx ? latestTx.isDelete : false,
      compliant: verificationResult.match === true && (verificationResult.status === 'APPROVED' || verificationResult.status === 'ACTIVE')
    };

    try {
      await sbomRepository.insertComplianceReport({
        sbomDocumentID: pgDocument.id,
        integrityMatch: complianceReport.integrityMatch,
        ledgerStatus: complianceReport.ledgerStatus,
        historyCount: complianceReport.historyCount || 0,
        latestTxID: complianceReport.latestTxID || null,
        latestTimestamp: complianceReport.latestTimestamp || null,
        latestIsDelete: complianceReport.latestIsDelete || false,
        compliant: complianceReport.compliant,
        generatedBy: req.headers['x-user-id'] || 'anonymous'
      });
    } catch (dbErr) {
      console.error('[TPSR] Failed to insert compliance report:', dbErr.message);
    }

    return res.status(200).json({
      message: 'Compliance report generated successfully',
      report: complianceReport
    });

  } catch (err) {
    if (err.message && err.message.indexOf('not found') !== -1) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({
      error: 'Failed to generate compliance report',
      details: err.message,
    });
  } finally {
    if (gateway) {
      fabric.disconnectGateway(gateway);
    }
  }
});

module.exports = router;
