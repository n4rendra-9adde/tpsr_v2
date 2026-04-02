'use strict';

require('dotenv').config();

var express = require('express');
var cors = require('cors');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');

var auth = require('./middleware/auth');

var submitRoute = require('./routes/submit');
var verifyRoute = require('./routes/verify');
var historyRoute = require('./routes/history');
var complianceReportRoute = require('./routes/compliance-report');
var sbomsRoute = require('./routes/sboms');

// Startup environment validation
var REQUIRED_ENV = [
  'FABRIC_CONNECTION_PROFILE',
  'FABRIC_WALLET_PATH',
  'FABRIC_IDENTITY',
  'FABRIC_CHANNEL_NAME',
  'FABRIC_CHAINCODE_NAME',
];

var missingEnv = REQUIRED_ENV.filter(function (key) {
  return !process.env[key] || !process.env[key].trim();
});

if (missingEnv.length > 0) {
  console.error('[TPSR] Startup failed. Missing required environment variables:');
  missingEnv.forEach(function (key) {
    console.error('  - ' + key);
  });
  console.error('[TPSR] Copy api/.env.example to api/.env and fill in all required values.');
  process.exit(1);
}

var PORT = process.env.PORT || 3000;

var app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

app.get('/', function (req, res) {
  res.json({
    service: 'TPSR API',
    status: 'running',
    message: 'Tamper-Proof SBOM Registry REST API',
  });
});

app.get('/health', function (req, res) {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

function getAllowedRoles(method, reqPath) {
  if (method === 'POST' && reqPath === '/submit') {
    return auth.ROUTE_ROLE_MAP.submit;
  }
  if (method === 'POST' && reqPath === '/verify') {
    return auth.ROUTE_ROLE_MAP.verify;
  }
  if (method === 'GET' && reqPath.indexOf('/history/') === 0) {
    return auth.ROUTE_ROLE_MAP.history;
  }
  if (method === 'POST' && reqPath === '/compliance-report') {
    return auth.ROUTE_ROLE_MAP.compliance;
  }
  if (method === 'GET' && reqPath === '/sboms') {
    return auth.ROUTE_ROLE_MAP.sboms;
  }
  return null;
}

app.use('/api', function (req, res, next) {
  var roles = getAllowedRoles(req.method, req.path);
  if (!roles) {
    return next();
  }

  auth.authenticateHeaders(req, res, function () {
    auth.requireRole(roles)(req, res, next);
  });
});

app.use('/api', submitRoute);
app.use('/api', verifyRoute);
app.use('/api', historyRoute);
app.use('/api', complianceReportRoute);
app.use('/api', sbomsRoute);

app.use(function (req, res) {
  res.status(404).json({ error: 'Route not found' });
});

app.use(function (err, req, res, next) {
  console.error('[TPSR] Unhandled server error:', err.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, function () {
  console.log('TPSR API server running on port ' + PORT);
});
