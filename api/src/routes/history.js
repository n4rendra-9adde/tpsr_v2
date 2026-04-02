'use strict';

var express = require('express');
var router = express.Router();

var fabric = require('../config/fabric');

router.get('/history/:sbomID', async function (req, res) {
  var gateway = null;

  try {
    var sbomIDParam = req.params.sbomID;

    if (sbomIDParam === undefined || sbomIDParam === null || typeof sbomIDParam !== 'string' || sbomIDParam.trim() === '') {
      return res.status(400).json({ error: 'sbomID is required' });
    }

    var sbomID = sbomIDParam.trim();

    var result = await fabric.getContract();
    gateway = result.gateway;
    var contract = result.contract;

    var resultBuffer = await contract.evaluateTransaction(
      'GetHistory',
      sbomID
    );

    var resultString = resultBuffer.toString('utf8');
    var historyArray;
    
    try {
      historyArray = JSON.parse(resultString);
      if (!Array.isArray(historyArray)) {
        throw new Error('history is not an array');
      }
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse SBOM history response' });
    }

    return res.status(200).json({
      message: 'SBOM history retrieved successfully',
      sbomID: sbomID,
      history: historyArray
    });
  } catch (err) {
    if (err.message && err.message.indexOf('not found') !== -1) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({
      error: 'Failed to retrieve SBOM history',
      details: err.message,
    });
  } finally {
    fabric.disconnectGateway(gateway);
  }
});

module.exports = router;
