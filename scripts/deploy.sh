#!/bin/bash
set -e

echo "🚀 [SIBIMA] Memulai deployment Production (sagulung.si-bima.online)..."

PROJECT_DIR="/opt/sibima/prod/app"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Direktori $PROJECT_DIR tidak ditemukan."
    exit 1
fi

cd "$PROJECT_DIR"

echo "📥 Menarik pembaruan dari branch main..."
git fetch origin main
git reset --hard origin/main

echo "🐳 Membangun dan menjalankan ulang container Production..."
docker compose -p sibima-prod -f docker-compose.yml up -d --build

echo "⚡ Menjalankan migrasi database & seeder alur..."
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan migrate --force
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan db:seed --class=WorkflowDefinitionSeeder --force

echo "🔄 Me-restart worker antrean (queue)..."
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan queue:restart

echo "⚡ Mengoptimalkan cache Laravel..."
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan optimize:clear
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan config:cache
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan route:cache
docker compose -p sibima-prod -f docker-compose.yml exec -T app php artisan view:cache

echo "✅ [SIBIMA] Deployment Production Berhasil dan Live!"
