#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
docker compose up --build -d --wait --wait-timeout 180
sh scripts/test-local.sh
printf '%s\n' 'Öppna http://localhost:5173 i webbläsaren.'
