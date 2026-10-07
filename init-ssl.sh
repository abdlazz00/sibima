#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="si-bima.online"
DOMAINS=("-d" "si-bima.online" "-d" "www.si-bima.online")
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "Penggunaan: ./init-ssl.sh <email-anda>"
  echo "Contoh: ./init-ssl.sh admin@si-bima.online"
  exit 1
fi

if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
  read -p "Sertifikat untuk $DOMAIN sudah ada. Timpa/buat ulang? (y/N) " decision
  if [ "$decision" != "y" ] && [ "$decision" != "Y" ]; then
    echo "Dibatalkan."
    exit 0
  fi
fi

echo "### 1. Menyiapkan direktori certbot..."
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$DATA_PATH/www"

echo "### 2. Membuat dummy certificate sementara agar Nginx bisa start..."
if command -v openssl >/dev/null 2>&1; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$DATA_PATH/conf/live/$DOMAIN/privkey.pem" \
    -out "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" \
    -subj '/CN=localhost'
else
  docker run --rm -v "$PWD/$DATA_PATH/conf:/etc/letsencrypt" alpine/openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
    -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
    -subj '/CN=localhost'
fi

echo "### 3. Menyalakan container Nginx (web)..."
docker compose -f compose.prod.yaml up --force-recreate -d web

echo "### 4. Menghapus dummy certificate..."
rm -rf "$DATA_PATH/conf/live/$DOMAIN"
rm -rf "$DATA_PATH/conf/archive/$DOMAIN"
rm -rf "$DATA_PATH/conf/renewal/$DOMAIN.conf"

echo "### 5. Meminta sertifikat SSL resmi dari Let's Encrypt..."
docker compose -f compose.prod.yaml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    ${DOMAINS[*]} \
    --email $EMAIL \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### 6. Me-reload Nginx dengan sertifikat resmi Let's Encrypt..."
docker compose -f compose.prod.yaml exec web nginx -s reload

echo "=== Selesai! SSL Let's Encrypt aktif untuk $DOMAIN ==="
