'use strict';

const express = require('express');
const { getContract, disconnectGateway } = require('../config/fabric');

const router = express.Router();

router.get('/sboms', async (req, res) => {
  let gateway;
  try {
    const fabricConfig = await getContract();
    gateway = fabricConfig.gateway;
    const contract = fabricConfig.contract;

    const resultBuffer = await contract.evaluateTransaction('ListSBOMs');
    const resultString = resultBuffer.toString('utf8');

    let parsedArray;
    try {
      parsedArray = JSON.parse(resultString || '[]');
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse SBOM list response' });
    }

    if (!Array.isArray(parsedArray)) {
      return res.status(500).json({ error: 'Failed to parse SBOM list response' });
    }

    res.status(200).json({
      message: 'SBOM list retrieved successfully',
      count: parsedArray.length,
      sboms: parsedArray
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve SBOM list',
      details: error.message || String(error)
    });
  } finally {
    if (gateway) {
      await disconnectGateway(gateway);
    }
  }
});

module.exports = router;
