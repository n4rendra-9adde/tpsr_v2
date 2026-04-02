#!/bin/bash
set -e

echo "=== TPSR Fabric Network Startup ==="

# Check for docker binary
if ! command -v docker > /dev/null; then
  echo "Error: docker binary not found in PATH"
  exit 1
fi

# Check for docker compose
if ! docker compose version > /dev/null 2>&1; then
  echo "Error: docker compose is not available"
  exit 1
fi

echo "docker and docker compose are available"

# Navigate to the network directory (script lives in network/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${NETWORK_DIR}"

echo "Working directory: $(pwd)"

# Verify required files and directories exist
if [ ! -f "./docker-compose.yaml" ]; then
  echo "Error: docker-compose.yaml not found"
  exit 1
fi

if [ ! -d "./crypto-config" ]; then
  echo "Error: crypto-config directory not found. Run generate-crypto.sh first"
  exit 1
fi

echo "Pre-flight checks passed"

# Start the network
echo "Starting TPSR Fabric network..."
docker compose -f ./docker-compose.yaml up -d

echo "Containers started. Verifying required containers are running..."

# List of required containers
REQUIRED_CONTAINERS=(
  "orderer0.orderer.tpsr.com"
  "peer0.vendor.tpsr.com"
  "couchdb0"
  "peer0.security.tpsr.com"
  "couchdb1"
  "peer0.auditor.tpsr.com"
  "couchdb2"
)

# Verify each container is running
for CONTAINER in "${REQUIRED_CONTAINERS[@]}"; do
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "Error: required container ${CONTAINER} is not running"
    exit 1
  fi
  echo "  [OK] ${CONTAINER}"
done

echo "TPSR Fabric network started successfully"
