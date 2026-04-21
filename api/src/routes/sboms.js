'use strict';

var express = require('express');
var router = express.Router();

var sbomRepository = require('../repositories/sbomRepository');

router.get('/sboms', async function (req, res) {
  try {
    var limit = req.query.limit;
    
    var sboms = await sbomRepository.listSBOMDocuments(limit);

    return res.status(200).json({
      message: 'SBOM list retrieved successfully',
      count: sboms.length,
      sboms: sboms
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve SBOM list',
      details: error.message || String(error)
    });
  }
});

module.exports = router;
