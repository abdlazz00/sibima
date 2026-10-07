#!/bin/sh
set -e
cd /var/www/html
mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs
php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
exec "$@"
