#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="si-bima.online"
DOMAINS=("-d" "si-bima.online" "-d" "www.si-bima.online")
DATA_PATH="./certbot"
EMAIL="${1:-sibima.kecsagulung@gmail.com}"

echo "### 1. Menyiapkan direktori certbot..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

echo "### 2. Menghentikan container web sementara agar port 80 bebas..."
docker compose -f compose.prod.yaml stop web 2>/dev/null || true

echo "### 3. Meminta sertifikat SSL resmi langsung dari Let's Encrypt (Standalone)..."
docker run --rm -p 80:80 \
  -v "$PWD/$DATA_PATH/conf:/etc/letsencrypt" \
  -v "$PWD/$DATA_PATH/www:/var/www/certbot" \
  certbot/certbot certonly \
  --standalone \
  ${DOMAINS[*]} \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo "### 4. Menyesuaikan metode renewal ke webroot..."
if [ -f "$DATA_PATH/conf/renewal/$DOMAIN.conf" ]; then
  sed -i 's/authenticator = standalone/authenticator = webroot/' "$DATA_PATH/conf/renewal/$DOMAIN.conf" || true
  if ! grep -q '\[\[webroot_map\]\]' "$DATA_PATH/conf/renewal/$DOMAIN.conf"; then
    cat >> "$DATA_PATH/conf/renewal/$DOMAIN.conf" <<EOF
webroot_path = /var/www/certbot,
[[webroot_map]]
$DOMAIN = /var/www/certbot
www.$DOMAIN = /var/www/certbot
EOF
  fi
fi

echo "### 5. Menyalakan container web (Nginx) dengan sertifikat resmi..."
docker compose -f compose.prod.yaml up -d web

echo "=== Selesai! SSL Let's Encrypt berhasil aktif untuk $DOMAIN ==="
