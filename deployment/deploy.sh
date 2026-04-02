#!/bin/bash
set -euo pipefail

# Determine script and project root directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Cleanup background processes on exit
PIDS=()
cleanup() {
  echo "[TPSR] Cleaning up background processes..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

# Load deployment env file
DEPLOY_ENV_FILE="${1:-${SCRIPT_DIR}/deploy.env}"

if [ ! -f "${DEPLOY_ENV_FILE}" ]; then
  echo "[TPSR] ERROR: Deployment env file not found: ${DEPLOY_ENV_FILE}"
  echo "[TPSR] Copy tpsr/deployment/deploy.env.example to tpsr/deployment/deploy.env and fill in values."
  exit 1
fi

echo "[TPSR] Loading deployment configuration from: ${DEPLOY_ENV_FILE}"
# shellcheck disable=SC1090
set -a
source "${DEPLOY_ENV_FILE}"
set +a

# Validate required variables
REQUIRED_VARS=(
  CHANNEL_NAME
  CHAINCODE_NAME
  CHAINCODE_VERSION
  CHAINCODE_SEQUENCE
  API_PORT
  API_ENV_FILE
  DASHBOARD_ENV_FILE
  START_API
  START_DASHBOARD
  RUN_POST_DEPLOY_TESTS
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [ -z "${val}" ]; then
    MISSING+=("$var")
  fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[TPSR] ERROR: Missing required deployment variables:"
  for m in "${MISSING[@]}"; do
    echo "  - ${m}"
  done
  exit 1
fi

# Validate required project scripts exist
REQUIRED_SCRIPTS=(
  "${PROJECT_ROOT}/tpsr/network/scripts/generate-crypto.sh"
  "${PROJECT_ROOT}/tpsr/network/scripts/start-network.sh"
  "${PROJECT_ROOT}/tpsr/network/scripts/create-channel.sh"
  "${PROJECT_ROOT}/tpsr/network/scripts/deploy-chaincode.sh"
  "${PROJECT_ROOT}/tpsr/scripts/test-functional.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ ! -f "${script}" ]; then
    echo "[TPSR] ERROR: Required script not found: ${script}"
    exit 1
  fi
done

echo "[TPSR] All required scripts found."

# ==============================================================
# DEPLOYMENT SEQUENCE
# ==============================================================

echo ""
echo "[TPSR] === STEP 1: Generating certificates ==="
bash "${PROJECT_ROOT}/tpsr/network/scripts/generate-crypto.sh"
echo "[TPSR] Certificates generated."

echo ""
echo "[TPSR] === STEP 2: Starting Fabric network ==="
bash "${PROJECT_ROOT}/tpsr/network/scripts/start-network.sh"
echo "[TPSR] Fabric network started."

echo ""
echo "[TPSR] === STEP 3: Creating channel: ${CHANNEL_NAME} ==="
bash "${PROJECT_ROOT}/tpsr/network/scripts/create-channel.sh" "${CHANNEL_NAME}"
echo "[TPSR] Channel created."

echo ""
echo "[TPSR] === STEP 4: Deploying chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION} seq ${CHAINCODE_SEQUENCE} ==="
bash "${PROJECT_ROOT}/tpsr/network/scripts/deploy-chaincode.sh" \
  "${CHANNEL_NAME}" \
  "${CHAINCODE_NAME}" \
  "${CHAINCODE_VERSION}" \
  "${CHAINCODE_SEQUENCE}"
echo "[TPSR] Chaincode deployed."

# Start API
if [ "${START_API}" = "true" ]; then
  echo ""
  echo "[TPSR] === STEP 5: Starting backend API on port ${API_PORT} ==="

  RESOLVED_API_ENV="${SCRIPT_DIR}/${API_ENV_FILE}"
  if [ ! -f "${RESOLVED_API_ENV}" ]; then
    echo "[TPSR] ERROR: API env file not found: ${RESOLVED_API_ENV}"
    exit 1
  fi

  (
    cd "${PROJECT_ROOT}/tpsr/api"
    # shellcheck disable=SC1090
    set -a
    source "${RESOLVED_API_ENV}"
    set +a
    export PORT="${API_PORT}"
    npm start
  ) &
  API_PID=$!
  PIDS+=("${API_PID}")
  echo "[TPSR] API started with PID ${API_PID}. Waiting for startup..."
  sleep 5
fi

# Start dashboard
if [ "${START_DASHBOARD}" = "true" ]; then
  echo ""
  echo "[TPSR] === STEP 6: Starting dashboard ==="

  RESOLVED_DASH_ENV="${SCRIPT_DIR}/${DASHBOARD_ENV_FILE}"
  if [ ! -f "${RESOLVED_DASH_ENV}" ]; then
    echo "[TPSR] ERROR: Dashboard env file not found: ${RESOLVED_DASH_ENV}"
    exit 1
  fi

  (
    cd "${PROJECT_ROOT}/tpsr/dashboard"
    # shellcheck disable=SC1090
    set -a
    source "${RESOLVED_DASH_ENV}"
    set +a
    npm start
  ) &
  DASH_PID=$!
  PIDS+=("${DASH_PID}")
  echo "[TPSR] Dashboard started with PID ${DASH_PID}. Waiting for startup..."
  sleep 5
fi

# Run post-deploy functional tests
if [ "${RUN_POST_DEPLOY_TESTS}" = "true" ]; then
  echo ""
  echo "[TPSR] === STEP 7: Running post-deploy functional tests ==="
  bash "${PROJECT_ROOT}/tpsr/scripts/test-functional.sh"
  echo "[TPSR] Functional tests completed."
fi

echo ""
echo "[TPSR] Deployment complete."
echo "[TPSR] Background PID list: ${PIDS[*]:-none}"
echo "[TPSR] Press Ctrl+C to stop all started background processes."

# Keep script alive to hold background processes if any were started
if [ "${#PIDS[@]}" -gt 0 ]; then
  wait
fi
