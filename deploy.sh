#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DC="docker compose -f compose.prod.yaml"

grep -q '^APP_KEY=base64:' .env || { echo "APP_KEY di .env kosong. Lihat docs/ops/deployment.md." >&2; exit 1; }

# Pastikan gateway-network sudah ada
docker network inspect gateway-network >/dev/null 2>&1 || docker network create gateway-network

git pull --ff-only
$DC build
$DC up -d db
$DC run --rm app php artisan migrate --force
$DC run --rm app php artisan db:seed --class=WorkflowDefinitionSeeder --force
$DC up -d --remove-orphans
$DC restart web
docker image prune -f
