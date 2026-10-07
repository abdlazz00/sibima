#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DC="docker compose -f compose.prod.yaml"

grep -q '^APP_KEY=base64:' .env || { echo "APP_KEY di .env kosong. Lihat docs/ops/deployment.md bagian 3." >&2; exit 1; }

[ -f cloudflared/config.yml ] || { echo "cloudflared/config.yml belum ada. Lihat docs/ops/deployment.md bagian 2." >&2; exit 1; }

git pull --ff-only
$DC build
$DC up -d db
$DC run --rm app php artisan migrate --force
$DC run --rm app php artisan db:seed --class=WorkflowDefinitionSeeder --force
$DC up -d --remove-orphans
$DC restart web   # nginx meresolve app:9000 sekali saat start; tanpa ini 502 setelah deploy yang hanya mengubah PHP
docker image prune -f
