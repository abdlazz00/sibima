#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
day=$(date +%F)

docker compose -f compose.prod.yaml exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --no-tablespaces -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
  | gzip > "backups/sibima-$day.sql.gz"

docker run --rm -v sibima_storage:/s:ro -v "$PWD/backups:/b" alpine \
  tar czf "/b/storage-$day.tgz" -C /s app

find backups -name 'sibima-*.sql.gz' -mtime +14 -delete
find backups -name 'storage-*.tgz' -mtime +14 -delete
