#!/usr/bin/env bash
set -euo pipefail

BASE_FRONTEND_URL="${BASE_FRONTEND_URL:-http://localhost:5173}"
BASE_API_URL="${BASE_API_URL:-http://localhost:8000}"
BASE_SCRIPT_URL="${BASE_SCRIPT_URL:-http://localhost:5050}"

echo "Checking frontend at ${BASE_FRONTEND_URL}..."
curl -fsS "${BASE_FRONTEND_URL}" >/dev/null

echo "Checking Python API health..."
curl -fsS "${BASE_API_URL}/health" | grep -q '"status"'

echo "Creating test user..."
USER_ID=$(curl -fsS -X POST "${BASE_API_URL}/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}' | sed -n 's/.*"id":[ ]*\([0-9]*\).*/\1/p')

if [[ -z "${USER_ID}" ]]; then
  echo "Failed to create test user."
  exit 1
fi

echo "Checking script-runner (declaration PDF)..."
curl -fsS -X POST "${BASE_SCRIPT_URL}/api/scripts/run" \
  -H "Content-Type: application/json" \
  -d '{"action":"declaration"}' \
  -o /tmp/declaration.pdf

if [[ ! -s /tmp/declaration.pdf ]]; then
  echo "Declaration PDF was not created."
  exit 1
fi

echo "All checks passed."
