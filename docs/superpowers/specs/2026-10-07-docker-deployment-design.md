# Deployment Docker + Cloudflare Tunnel

Target: VPS Rumahweb (Ubuntu 24.04, 2 CPU, 4 GB RAM + 4 GB swap), domain `si-bima.online`, DNS lewat Cloudflare.

## Keputusan

- Semua jalan di Docker Compose. Tidak ada PHP/Nginx/MySQL terpasang di host.
- Akses publik hanya lewat Cloudflare Tunnel (`cloudflared`). Host hanya membuka port 22. HTTPS ditangani Cloudflare; tidak ada Certbot.
- Build image di VPS (`docker compose build`). Tanpa registry dan CI. Upgrade ke GitHub Actions + GHCR kalau build di VPS terasa berat.
- Nameserver domain di Rumahweb diganti ke nameserver Cloudflare. Tidak ada A record di Rumahweb.

## Container (`compose.prod.yaml`)

| Service | Isi | Catatan |
|---|---|---|
| `app` | PHP 8.4-FPM, image Laravel | multi-stage: Node 24 (`npm ci && npm run build`) → Composer (`--no-dev -o`) → runtime |
| `web` | Nginx | melayani `public/` (aset hasil build disalin ke image), meneruskan `.php` ke `app:9000` |
| `queue` | image `app` | `queue:work --timeout=600 --tries=3`; timeout < `DB_QUEUE_RETRY_AFTER` (900) |
| `scheduler` | image `app` | `schedule:work` (ada `import:prune` harian) |
| `db` | MySQL 8 | named volume `dbdata`, tanpa port ke host |
| `cloudflared` | Cloudflare Tunnel | tunnel dikelola lokal (CLI, tanpa Zero Trust): `cloudflared/config.yml` + `credentials.json` di host (di-ignore git), tujuan `http://web:80` |

PHP ekstensi: `pdo_mysql`, `gd` (+freetype/jpeg), `zip`, `mbstring`, `bcmath`, `intl`, `opcache`, `exif`. Dibutuhkan PhpSpreadsheet, dompdf, bacon-qr-code, dan upload foto.

## Data persisten

- Volume `dbdata` → MySQL.
- Volume `storage` → `/var/www/html/storage`, dipakai bersama `app`, `queue`, `scheduler`, dan `web` (read-only). Isinya foto aset/pegawai (disk `public`), file import (disk `local`), dan log.
- `public/storage` adalah symlink `storage:link`. Dibuat di image `app` dan `web`.
- `.env` produksi ada di host (`/opt/sibima/.env`), tidak di image dan tidak di git.

## Konfigurasi aplikasi

- `bootstrap/app.php`: `trustProxies(at: '*', headers: HEADER_X_FORWARDED_PROTO)`. Hanya skema yang dipercaya; Host dan For tidak (poisoning link reset, pemalsuan IP). IP klien asli diambil Nginx dari `CF-Connecting-IP` (`set_real_ip_from` jaringan Docker). Tanpa proto, Laravel menganggap request HTTP sehingga URL dan cookie rusak.
- `.env` produksi: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://si-bima.online`, `SESSION_SECURE_COOKIE=true`, `DB_HOST=db`, `MAIL_MAILER=resend`, `LOG_LEVEL=warning`.
- Entrypoint `app`: `config:cache`, `route:cache`, `view:cache`, `event:cache`. Migrate tidak otomatis; dijalankan eksplisit oleh `deploy.sh`.

## File yang ditambahkan

`Dockerfile`, `.dockerignore`, `docker/nginx.conf`, `docker/entrypoint.sh`, `compose.prod.yaml`, `.env.production.example`, `deploy.sh`, `docs/ops/deployment.md` (runbook: setup VPS → Cloudflare/Rumahweb → deploy pertama → update → backup → rollback), satu baris `trustProxies` di `bootstrap/app.php`.

## Operasional

- `deploy.sh`: `git pull` → `docker compose build` → `up -d` → `migrate --force` → `queue:restart`.
- Backup: cron host harian `mysqldump` ke `/opt/sibima/backups`, simpan 14 hari. Salinan keluar VPS (Google Drive/rclone) disebut di runbook, tidak diotomasi sekarang.
- Hardening host: user `deploy` (grup docker), SSH key only, root login mati, UFW hanya 22, fail2ban.
- Seed awal (role/permission dan akun admin) dijalankan manual sekali di deploy pertama.

## Di luar cakupan

CI/CD, registry, monitoring, multi-server, Redis (queue/cache/session tetap di database).

## Verifikasi

Build image lokal sampai lulus; `docker compose config` valid; setelah deploy: `/up` mengembalikan 200 lewat domain, login berhasil, upload foto muncul, job antrean terproses, `schedule:list` terbaca.
