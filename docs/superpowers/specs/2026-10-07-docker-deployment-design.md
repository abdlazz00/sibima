# Deployment Docker + Let's Encrypt (Tanpa Cloudflare)

Target: VPS Rumahweb (Ubuntu 24.04, 2 CPU, 4 GB RAM + 4 GB swap), domain `si-bima.online`, DNS langsung di Rumahweb.

## Keputusan

- Semua service jalan di Docker Compose. Tidak ada PHP/Nginx/MySQL terpasang di host.
- Akses publik langsung ke port 80 dan 443 di VPS (UFW membuka port 22, 80, 443).
- SSL ditangani langsung oleh Nginx + Certbot di dalam Docker Compose menggunakan Let's Encrypt.
- Build image di VPS (`docker compose build`). Tanpa registry dan CI. Upgrade ke GitHub Actions + GHCR kalau build di VPS terasa berat.
- DNS domain dikelola di Rumahweb (A record `@` dan `www` mengarah langsung ke IP Public VPS).

## Container (`compose.prod.yaml`)

| Service | Isi | Catatan |
|---|---|---|
| `app` | PHP 8.4-FPM, image Laravel | multi-stage: Node 24 (`npm ci && npm run build`) → Composer (`--no-dev -o`) → runtime |
| `web` | Nginx 1.27 | melayani `public/`, terminasi SSL di port 443, redirect HTTP ke HTTPS, meneruskan `.php` ke `app:9000` via FastCGI (`HTTPS on`) |
| `queue` | image `app` | `queue:work --timeout=600 --tries=1`; timeout < `DB_QUEUE_RETRY_AFTER` (900) |
| `scheduler` | image `app` | `schedule:work` (ada `import:prune` harian) |
| `db` | MySQL 8.4 | named volume `dbdata`, tanpa port ke host |
| `certbot` | Certbot | mengelola pembaruan sertifikat Let's Encrypt (`certbot renew` berkala) |

PHP ekstensi: `pdo_mysql`, `gd` (+freetype/jpeg), `zip`, `mbstring`, `bcmath`, `intl`, `opcache`, `exif`. Dibutuhkan PhpSpreadsheet, dompdf, bacon-qr-code, dan upload foto.

## Data persisten

- Volume `dbdata` → MySQL.
- Volume `storage` → `/var/www/html/storage`, dipakai bersama `app`, `queue`, `scheduler`, dan `web` (read-only). Isinya foto aset/pegawai (disk `public`), file import (disk `local`), dan log.
- Volume `./certbot/conf` dan `./certbot/www` → sertifikat SSL dan challenge file ACME.
- `public/storage` adalah symlink `storage:link`. Dibuat di image `app` dan `web`.
- `.env` produksi ada di host (`/opt/sibima/.env`), tidak di image dan tidak di git.

## Konfigurasi aplikasi

- FastCGI: Nginx meneruskan request HTTPS ke PHP-FPM dengan `fastcgi_param HTTPS on;`, sehingga Laravel secara native mendeteksi koneksi aman tanpa perlu manipulasi proxy header.
- IP klien asli langsung didapatkan dari TCP connection `$remote_addr` (tidak ada reverse proxy perantara).
- `.env` produksi: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://si-bima.online`, `SESSION_SECURE_COOKIE=true`, `DB_HOST=db`, `MAIL_MAILER=resend`, `LOG_LEVEL=warning`.
- Entrypoint `app`: `config:cache`, `route:cache`, `view:cache`, `event:cache`. Migrate tidak otomatis; dijalankan eksplisit oleh `deploy.sh`.

## File yang diperbarui/ditambahkan

`Dockerfile`, `.dockerignore`, `docker/nginx.conf`, `docker/entrypoint.sh`, `compose.prod.yaml`, `.env.production.example`, `deploy.sh`, `init-ssl.sh`, `docs/ops/deployment.md`.

## Operasional

- Inisiasi SSL: `./init-ssl.sh admin@si-bima.online`
- Deploy / Update: `./deploy.sh` (`git pull` → `docker compose build` → `up -d` → `migrate --force` → `restart web`).
- Backup: cron host harian `mysqldump` ke `/opt/sibima/backups`, simpan 14 hari.
- Hardening host: user `deploy` (grup docker), SSH key only, root login mati, UFW port 22, 80, 443, fail2ban.
