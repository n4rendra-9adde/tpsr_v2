#!/bin/bash
set -e

echo "=== TPSR Certificate Generation ==="

# Check for cryptogen binary
if ! command -v cryptogen > /dev/null; then
  echo "Error: cryptogen binary not found in PATH"
  exit 1
fi

echo "cryptogen found: $(command -v cryptogen)"

# Navigate to the network directory (script lives in network/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${NETWORK_DIR}"

echo "Working directory: $(pwd)"

# Remove existing crypto-config if present
if [ -d "./crypto-config" ]; then
  echo "Removing existing crypto-config directory..."
  rm -rf ./crypto-config
fi

# Generate certificates
echo "Generating certificates from crypto-config.yaml..."
cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

# Verify output
if [ ! -d "./crypto-config" ]; then
  echo "Error: certificate generation failed"
  exit 1
fi

echo "Certificates generated successfully in ./crypto-config"
