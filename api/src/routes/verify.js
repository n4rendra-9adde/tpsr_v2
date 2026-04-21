'use strict';

var express = require('express');
var router = express.Router();

var fabric = require('../config/fabric');
var sbomRepository = require('../repositories/sbomRepository');
var canonicalize = require('../utils/canonicalize');
var hash = require('../utils/hash');

router.post('/verify', async function (req, res) {
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
    var submittedHash;

    try {
      canonicalizedSBOM = canonicalize.canonicalizeSBOM(sbom);
      submittedHash = hash.hashSBOM(canonicalizedSBOM);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    var pgDocument;
    try {
      pgDocument = await sbomRepository.getSBOMDocumentBySBOMID(sbomID);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to verify SBOM',
        details: err.message,
      });
    }

    if (!pgDocument) {
      return res.status(404).json({ error: 'SBOM record not found' });
    }

    var result = await fabric.getContract();
    gateway = result.gateway;
    var contract = result.contract;

    var resultBuffer = await contract.evaluateTransaction(
      'VerifyIntegrity',
      sbomID,
      submittedHash
    );

    var resultString = resultBuffer.toString('utf8');
    var verificationResult = JSON.parse(resultString);

    try {
      await sbomRepository.insertVerificationEvent({
        sbomDocumentID: pgDocument.id,
        submittedHash: submittedHash,
        storedHash: verificationResult.storedHash || pgDocument.sbom_hash,
        match: verificationResult.match,
        verifiedBy: req.headers['x-user-id'] || 'anonymous',
        verifierRole: req.headers['x-user-role'] || 'unknown',
        verificationMode: 'API',
        fabricTxID: null
      });
    } catch (dbErr) {
      console.error('[TPSR] Failed to insert verification event:', dbErr.message);
    }

    return res.status(200).json({
      message: 'SBOM verification completed',
      verification: verificationResult
    });
  } catch (err) {
    if (err.message && err.message.indexOf('not found') !== -1) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({
      error: 'Failed to verify SBOM',
      details: err.message,
    });
  } finally {
    fabric.disconnectGateway(gateway);
  }
});

module.exports = router;
