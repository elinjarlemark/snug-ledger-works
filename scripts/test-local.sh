#!/usr/bin/env sh
set -eu
base_url="${BASE_FRONTEND_URL:-http://localhost:5173}"
curl --fail --silent --show-error "$base_url" > /dev/null
curl --fail --silent --show-error "$base_url/backend/health"
printf '\n%s\n' 'Webbsida, API och databas svarar.'
