'use strict';

var express = require('express');
var router = express.Router();

var fabric = require('../config/fabric');
var canonicalize = require('../utils/canonicalize');
var hash = require('../utils/hash');

var STRING_FIELDS = [
  'sbomID',
  'buildID',
  'softwareName',
  'softwareVersion',
  'format',
  'offChainRef',
];

var VALID_FORMATS = ['SPDX', 'CycloneDX'];

function validateStringField(body, field) {
  var value = body[field];
  if (value === undefined || value === null) {
    return field + ' is required';
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return field + ' is required';
  }
  return null;
}

function validateSignatures(signatures) {
  if (signatures === undefined || signatures === null) {
    return 'signatures is required';
  }
  if (!Array.isArray(signatures) || signatures.length === 0) {
    return 'signatures must be a non-empty array of non-empty strings';
  }
  for (var i = 0; i < signatures.length; i++) {
    if (typeof signatures[i] !== 'string' || signatures[i].trim() === '') {
      return 'signatures must be a non-empty array of non-empty strings';
    }
  }
  return null;
}

router.post('/submit', async function (req, res) {
  var gateway = null;

  try {
    var body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    if (body.sbom === undefined || body.sbom === null || body.sbom === '') {
      return res.status(400).json({ error: 'sbom is required' });
    }

    for (var i = 0; i < STRING_FIELDS.length; i++) {
      var fieldError = validateStringField(body, STRING_FIELDS[i]);
      if (fieldError) {
        return res.status(400).json({ error: fieldError });
      }
    }

    if (VALID_FORMATS.indexOf(body.format.trim()) === -1) {
      return res.status(400).json({ error: 'format must be SPDX or CycloneDX' });
    }

    var sigError = validateSignatures(body.signatures);
    if (sigError) {
      return res.status(400).json({ error: sigError });
    }

    var sbomID = body.sbomID.trim();
    var sbom = body.sbom;
    var buildID = body.buildID.trim();
    var softwareName = body.softwareName.trim();
    var softwareVersion = body.softwareVersion.trim();
    var format = body.format.trim();
    var offChainRef = body.offChainRef.trim();
    var signatures = body.signatures.map(function (s) { return s.trim(); });

    var canonicalizedSBOM;
    var sbomHash;

    try {
      canonicalizedSBOM = canonicalize.canonicalizeSBOM(sbom);
      sbomHash = hash.hashSBOM(canonicalizedSBOM);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    var result = await fabric.getContract();
    gateway = result.gateway;
    var contract = result.contract;

    await contract.submitTransaction(
      'SubmitSBOM',
      sbomID,
      sbomHash,
      buildID,
      softwareName,
      softwareVersion,
      format,
      offChainRef,
      JSON.stringify(signatures)
    );

    return res.status(201).json({
      message: 'SBOM submitted successfully',
      sbomID: sbomID,
      hash: sbomHash,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to submit SBOM',
      details: err.message,
    });
  } finally {
    fabric.disconnectGateway(gateway);
  }
});

module.exports = router;
