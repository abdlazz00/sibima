#!/bin/bash
set -e

# Pastikan folder storage (termasuk public & imports) dan cache selalu ada dengan permission yang benar
mkdir -p /var/www/html/storage/app/public \
         /var/www/html/storage/app/private/imports \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Buat symlink public/storage agar foto aset, dokumen BA, dan foto profil dapat diakses publik
php /var/www/html/artisan storage:link --force >/dev/null 2>&1 || true

# Pastikan APP_KEY tersedia sebelum migrasi atau caching
if [ -z "$APP_KEY" ]; then
    echo "Application key is missing. Generating APP_KEY..."
    php /var/www/html/artisan key:generate --force || true
fi

# Jalankan database migrations & seeder alur non-destruktif jika diaktifkan via environment variable
if [ "$AUTO_MIGRATE" = "true" ]; then
    echo "Running database migrations and workflow seeder..."
    php /var/www/html/artisan migrate --force
    php /var/www/html/artisan db:seed --class=WorkflowDefinitionSeeder --force || true
fi

# Caching Laravel untuk performa produksi / staging
if [ "$APP_ENV" = "production" ] || [ "$APP_ENV" = "staging" ]; then
    echo "Optimizing Laravel configuration, routes, and views..."
    php /var/www/html/artisan config:cache || true
    php /var/www/html/artisan route:cache || true
    php /var/www/html/artisan view:cache || true
fi

exec "$@"
