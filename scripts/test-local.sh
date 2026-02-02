#!/usr/bin/env bash
set -euo pipefail

BASE_FRONTEND_URL="${BASE_FRONTEND_URL:-http://localhost:5173}"
BASE_API_URL="${BASE_API_URL:-http://localhost:8000}"
BASE_SCRIPT_URL="${BASE_SCRIPT_URL:-http://localhost:5050}"

fail() {
  echo "ERROR: $1"
  exit 1
}

echo "Checking frontend at ${BASE_FRONTEND_URL}..."
if ! curl -fsS "${BASE_FRONTEND_URL}" >/dev/null; then
  fail "Frontend did not respond at ${BASE_FRONTEND_URL}."
fi

echo "Checking Python API health..."
if ! curl -fsS "${BASE_API_URL}/health" | grep -q '"status"'; then
  fail "Python API health check failed at ${BASE_API_URL}/health."
fi

echo "Creating test user..."
TEST_EMAIL="test-$(date +%s)-$RANDOM@example.com"
USER_ID=$(curl -fsS -X POST "${BASE_API_URL}/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"name\":\"Test User\"}" | sed -n 's/.*"id":[ ]*\([0-9]*\).*/\1/p')

if [[ -z "${USER_ID}" ]]; then
  fail "Failed to create test user."
fi

echo "Checking script-runner (declaration PDF)..."
if ! curl -fsS -X POST "${BASE_SCRIPT_URL}/api/scripts/run" \
  -H "Content-Type: application/json" \
  -d '{"action":"declaration"}' \
  -o /tmp/declaration.pdf; then
  fail "Script runner did not respond at ${BASE_SCRIPT_URL}/api/scripts/run."
fi

if [[ ! -s /tmp/declaration.pdf ]]; then
  fail "Declaration PDF was not created."
fi

echo "All checks passed."
