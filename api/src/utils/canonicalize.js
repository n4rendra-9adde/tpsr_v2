'use strict';

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  var proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isValidDate(value) {
  var d = new Date(value);
  return !isNaN(d.getTime());
}

function isTimestampKey(key) {
  return key === 'timestamp' || key.endsWith('Timestamp');
}

function isPurlKey(key) {
  return key === 'purl' || key.endsWith('Purl');
}

function canonicalizeValue(key, value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (isTimestampKey(key) && isValidDate(trimmed)) {
      return new Date(trimmed).toISOString();
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map(function (item, index) {
      return canonicalizeValue(String(index), item);
    });
  }

  if (isPlainObject(value)) {
    return canonicalizeObject(value);
  }

  throw new Error('SBOM input contains unsupported value types');
}

function canonicalizeObject(obj) {
  var keys = Object.keys(obj).sort();
  var result = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    result[k] = canonicalizeValue(k, obj[k]);
  }
  return result;
}

function canonicalizeSBOM(input) {
  if (input === null || input === undefined) {
    throw new Error('SBOM input is required');
  }

  var parsed;

  if (typeof input === 'string') {
    var trimmed = input.trim();
    if (trimmed === '') {
      throw new Error('SBOM input is required');
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      throw new Error('SBOM input must be valid JSON or a JavaScript object');
    }
  } else {
    parsed = input;
  }

  if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
    throw new Error('SBOM input must be valid JSON or a JavaScript object');
  }

  var canonical;
  if (Array.isArray(parsed)) {
    canonical = parsed.map(function (item, index) {
      return canonicalizeValue(String(index), item);
    });
  } else {
    canonical = canonicalizeObject(parsed);
  }

  return JSON.stringify(canonical);
}

module.exports = { canonicalizeSBOM };
