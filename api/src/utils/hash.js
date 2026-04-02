'use strict';

var crypto = require('crypto');

function hashSBOM(input) {
  if (input === null || input === undefined) {
    throw new Error('Canonical SBOM input is required');
  }

  if (typeof input !== 'string') {
    throw new Error('Canonical SBOM input must be a string');
  }

  var normalized = input.trim();

  if (normalized === '') {
    throw new Error('Canonical SBOM input is required');
  }

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

module.exports = { hashSBOM };
