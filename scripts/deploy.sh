#!/bin/bash
set -e

echo "🚀 [SIBIMA] Memulai deployment UAT (uat-sagulung.si-bima.online)..."

PROJECT_DIR="/opt/sibima/uat/app"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Direktori $PROJECT_DIR tidak ditemukan."
    exit 1
fi

cd "$PROJECT_DIR"

echo "📥 Menarik pembaruan dari branch staging..."
git fetch origin staging
git reset --hard origin/staging

echo "🐳 Membangun dan menjalankan ulang container UAT..."
docker compose -p sibima-uat -f docker-compose.yml up -d --build

echo "⚡ Menjalankan migrasi database & seeder alur..."
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan migrate --force
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan db:seed --class=WorkflowDefinitionSeeder --force
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan db:seed --class=AssetCategorySeeder --force

echo "🔄 Me-restart worker antrean (queue)..."
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan queue:restart

echo "⚡ Mengoptimalkan cache Laravel..."
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan optimize:clear
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan config:cache
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan route:cache
docker compose -p sibima-uat -f docker-compose.yml exec -T app php artisan view:cache

echo "✅ [SIBIMA] Deployment UAT Berhasil dan Siap Ditest!"
