$ErrorActionPreference = "Stop"

Write-Host "Starting Docker Compose..."
docker compose up --build -d

Write-Host "Running local smoke tests..."
bash scripts/test-local.sh

Write-Host "All services are running. Open http://localhost:5173 in your browser."
