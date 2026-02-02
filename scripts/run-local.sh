#!/usr/bin/env bash
set -euo pipefail

echo "Starting Docker Compose..."
docker compose up --build -d

echo "Running local smoke tests..."
bash scripts/test-local.sh

echo "All services are running. Open http://localhost:5173 in your browser."
