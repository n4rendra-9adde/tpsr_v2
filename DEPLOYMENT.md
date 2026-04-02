# TPSR Deployment Runbook

## Overview
The Tamper-Proof SBOM Registry (TPSR) guarantees software supply chain integrity. The complete system consists of a Hyperledger Fabric network, Go chaincode, a Node.js API, a React dashboard, CI integrations, and test scripts.

## Deployment Order
1. Generate certificates
2. Start Fabric network
3. Create channel
4. Deploy chaincode
5. Start backend API
6. Start dashboard
7. Run validation tests

## Prerequisites
- Docker
- Docker Compose
- Hyperledger Fabric binaries
- Node.js / npm
- Go toolchain
- Python 3
- curl
- Git
- required environment files/config paths

## Project Structure
- network
- chaincode/sbom
- api
- dashboard
- ci/jenkins
- ci/gitlab
- cli
- scripts

## Step-by-Step Deployment

### 6.1 Generate certificates
Reference:
`tpsr/network/scripts/generate-crypto.sh`

### 6.2 Start Fabric network
Reference:
`tpsr/network/scripts/start-network.sh`

### 6.3 Create channel
Reference:
`tpsr/network/scripts/create-channel.sh`

### 6.4 Deploy chaincode
Reference:
`tpsr/network/scripts/deploy-chaincode.sh`

### 6.5 Start backend API
The API must be configured with the required environment variables and started from:
`tpsr/api`

The API exposes:
- `/health`
- `/api/submit`
- `/api/verify`
- `/api/history/:sbomID`
- `/api/compliance-report`

Important: Fabric connection and auth-related runtime config must be set.

### 6.6 Start dashboard
The dashboard must be started from:
`tpsr/dashboard`

It connects to the API using:
`REACT_APP_API_BASE_URL`

### 6.7 Run validation tests
Reference these scripts:
- `tpsr/scripts/test-functional.sh`
- `tpsr/scripts/test-performance.py`
- `tpsr/scripts/test-security.sh`
- `tpsr/scripts/test-tamper-detection.sh`

## Environment Configuration Notes
- API Fabric connection settings
- API identity/wallet/connection profile settings
- Dashboard API base URL
- CI variables for Jenkins and GitLab usage

## Post-Deployment Validation Checklist
- API `/health` returns ok
- Submit works
- Verify works
- History works
- Compliance report works
- Dashboard loads
- Verify page reaches backend
- History page reaches backend
- Compliance page reaches backend
- Tamper detection script passes

## CI/CD Integration Notes
- Jenkins shared library step:
  `tpsr/ci/jenkins/vars/tpsrSubmitSbom.groovy`
- GitLab reusable template:
  `tpsr/ci/gitlab/.gitlab-ci-tpsr.yml`
- Verification CLI:
  `tpsr/cli/verify-sbom.js`

## Troubleshooting
- backend cannot connect to Fabric
- dashboard cannot reach API
- chaincode not committed
- auth headers rejected
- test script failures
- tamper check not behaving as expected

## Final Notes
TPSR should be deployed and validated in this order for reliable operation.
