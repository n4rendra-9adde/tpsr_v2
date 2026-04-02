# TPSR Deployment Execution Guide

## Overview
This deployment package provides a practical execution path for deploying the full TPSR system in the correct order.

## Package Contents
- `tpsr/deployment/deploy.env.example` — Deployment environment template
- `tpsr/deployment/deploy.sh` — Deployment orchestration script

## Operator Flow

1. Copy the deployment environment template:
`tpsr/deployment/deploy.env.example` to `tpsr/deployment/deploy.env`

2. Edit `tpsr/deployment/deploy.env` and supply all required values:
- `CHANNEL_NAME`
- `CHAINCODE_NAME`
- `CHAINCODE_VERSION`
- `CHAINCODE_SEQUENCE`
- `API_PORT`
- `API_ENV_FILE`
- `DASHBOARD_ENV_FILE`
- `START_API`
- `START_DASHBOARD`
- `RUN_POST_DEPLOY_TESTS`

3. Ensure the API and dashboard `.env` files exist:
- `tpsr/api/.env` (copy from `tpsr/api/.env.example`)
- `tpsr/dashboard/.env` (copy from `tpsr/dashboard/.env.example`)

4. Run the deployment script.

5. Optionally enable post-deploy functional tests by setting:
`RUN_POST_DEPLOY_TESTS=true`

## Files Used During Deployment
- `tpsr/network/scripts/generate-crypto.sh` — Certificate generation
- `tpsr/network/scripts/start-network.sh` — Fabric peer and orderer startup
- `tpsr/network/scripts/create-channel.sh` — Channel provisioning
- `tpsr/network/scripts/deploy-chaincode.sh` — Chaincode packaging and deployment
- `tpsr/api/.env` — API runtime environment variables
- `tpsr/dashboard/.env` — Dashboard runtime environment variables
- `tpsr/scripts/test-functional.sh` — Post-deploy functional test runner

## Execution Example

Using the default env file location:
```
./tpsr/deployment/deploy.sh
```

Using an explicit env file path:
```
./tpsr/deployment/deploy.sh ./tpsr/deployment/deploy.env
```

## What the Deployment Script Does

The script executes the following steps in order:

1. Generate certificates using `generate-crypto.sh`
2. Start the Fabric network using `start-network.sh`
3. Create the application channel using `create-channel.sh`
4. Deploy the SBOM chaincode using `deploy-chaincode.sh`
5. Optionally start the backend API in the background
6. Optionally start the dashboard in the background
7. Optionally run post-deploy functional tests using `test-functional.sh`

The script validates all required environment variables and project scripts before executing any steps. It uses a `trap` to clean up background API and dashboard processes if the script is stopped with Ctrl+C.

## Notes
- This script is intended for development and test deployments.
- Production deployments may later require stronger service supervision, persistent process management, and secure secret injection.
- The script intentionally reuses the existing TPSR project network and deployment scripts to avoid duplication.
- Secrets and credentials must never be committed to version control. Use `.env` files and ensure they are listed in `.gitignore`.
