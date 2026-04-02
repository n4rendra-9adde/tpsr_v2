#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`
TPSR Verification CLI

Usage:
  node verify-sbom.js --api-base-url <url> --user-id <id> --role <role> --sbom-id <id> --sbom-file <path> [--json]

Options:
  --api-base-url   Base URL for TPSR API (e.g. http://localhost:3000/api)
  --user-id        User ID for authentication
  --role           User role (developer, security, auditor, admin)
  --sbom-id        ID of the SBOM to verify
  --sbom-file      Path to the raw SBOM file
  --json           Output raw JSON response instead of human-readable summary
  -h, --help       Show this help message
  `);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const parsedArgs = { json: false };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--api-base-url') { parsedArgs.apiBaseUrl = args[++i]; }
    else if (arg === '--user-id') { parsedArgs.userId = args[++i]; }
    else if (arg === '--role') { parsedArgs.role = args[++i]; }
    else if (arg === '--sbom-id') { parsedArgs.sbomID = args[++i]; }
    else if (arg === '--sbom-file') { parsedArgs.sbomFile = args[++i]; }
    else if (arg === '--json') { parsedArgs.json = true; }
  }

  const requiredKeys = ['apiBaseUrl', 'userId', 'role', 'sbomID', 'sbomFile'];
  const flagNames = {
    apiBaseUrl: '--api-base-url',
    userId: '--user-id',
    role: '--role',
    sbomID: '--sbom-id',
    sbomFile: '--sbom-file'
  };

  for (const req of requiredKeys) {
    if (!parsedArgs[req] || parsedArgs[req].trim() === '') {
      fail(`Missing or empty required argument: ${flagNames[req]}`);
    }
  }

  const allowedRoles = ['developer', 'security', 'auditor', 'admin'];
  if (!allowedRoles.includes(parsedArgs.role.trim())) {
    fail(`Invalid role: ${parsedArgs.role.trim()}. Must be one of: ${allowedRoles.join(', ')}`);
  }

  const sbomFilePath = path.resolve(parsedArgs.sbomFile.trim());
  if (!fs.existsSync(sbomFilePath)) {
    fail(`SBOM file not found: ${parsedArgs.sbomFile}`);
  }

  const sbomContent = fs.readFileSync(sbomFilePath, 'utf-8').trim();
  if (!sbomContent) {
    fail(`SBOM file is empty: ${parsedArgs.sbomFile}`);
  }

  let baseUrl = parsedArgs.apiBaseUrl.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const url = `${baseUrl}/verify`;

  const payload = {
    sbomID: parsedArgs.sbomID.trim(),
    sbom: sbomContent
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': parsedArgs.userId.trim(),
        'x-user-role': parsedArgs.role.trim()
      },
      body: JSON.stringify(payload)
    });

    const status = response.status;
    let data;
    try {
      data = await response.json();
    } catch (e) {
      if (status === 200) {
        fail('TPSR verification returned invalid JSON');
      } else {
        fail(`TPSR verification failed with HTTP ${status}`);
      }
    }

    if (status === 200) {
      if (parsedArgs.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        const v = data.verification || {};
        const matchStr = v.match !== undefined ? (v.match ? 'Yes' : 'No') : 'N/A';
        console.log(`Message: ${data.message || 'Verification complete'}`);
        console.log(`SBOM ID: ${v.sbomID || 'N/A'}`);
        console.log(`Submitted Hash: ${v.submittedHash || 'N/A'}`);
        console.log(`Stored Hash: ${v.storedHash || 'N/A'}`);
        console.log(`Match: ${matchStr}`);
        console.log(`Status: ${v.status || 'N/A'}`);
      }
      process.exitCode = 0;
    } else {
      if (status === 400 || status === 404) {
        if (data.error) {
          fail(data.error);
        } else {
          fail(`TPSR verification failed with HTTP ${status}`);
        }
      } else {
        if (data.error && data.details) {
          fail(`TPSR verification failed: ${data.error} - ${data.details}`);
        } else if (data.error) {
          fail(`TPSR verification failed: ${data.error}`);
        } else {
          fail(`TPSR verification failed with HTTP ${status}`);
        }
      }
    }
  } catch (err) {
    fail(`TPSR verification request failed: ${err.message}`);
  }
}

main();
