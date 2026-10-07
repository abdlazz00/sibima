# Docker + Cloudflare Tunnel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SIBIMA bisa dideploy ke VPS Ubuntu 24.04 lewat Docker Compose dan diakses di `https://si-bima.online` melalui Cloudflare Tunnel.

**Architecture:** Satu Dockerfile multi-stage menghasilkan dua image: `app` (PHP-FPM, dipakai juga oleh `queue` dan `scheduler`) dan `web` (Nginx + aset statis). MySQL dan `cloudflared` memakai image resmi. Data persisten ada di dua named volume (`dbdata`, `storage`). Host hanya membuka port 22.

**Tech Stack:** Docker Compose, PHP 8.4-FPM (Alpine), Nginx 1.27, MySQL 8.4, Node 24 (stage build, npm 11 sama dengan yang membuat package-lock.json), cloudflared, Pest.

**Spec:** `docs/superpowers/specs/2026-10-07-docker-deployment-design.md`

## Global Constraints

- Host publik hanya membuka port 22; tidak ada `ports:` di `compose.prod.yaml`.
- Tidak ada rahasia di git: `.env` tetap di-ignore; hanya `.env.production.example` yang masuk repo.
- Worker antrean: `--tries=1 --timeout=600 --max-time=3600 --memory=512` (sama dengan `docs/ops/queue-setup.md`); `DB_QUEUE_RETRY_AFTER=900` harus lebih besar dari timeout 600.
- Nama project Compose dipatok `sibima`, volume `sibima_dbdata` dan `sibima_storage`.
- Skrip `.sh` memakai LF dan `bash` dengan `set -euo pipefail`.
- `PermissionSeeder` TIDAK dijalankan otomatis saat deploy (menimpa permission role sistem).
- Tidak ada trailer `Co-Authored-By` pada commit.
- Docker tidak terpasang di mesin pengembangan ini, jadi build image dan `docker compose config` baru diverifikasi di VPS (Task 5).

## Review Focus

- Request lewat tunnel bersifat HTTP internal; Laravel harus tetap menganggapnya HTTPS (URL, cookie secure). Ditest di Task 1.
- Foto yang diunggah harus bertahan setelah container dibuat ulang dan tetap terlayani Nginx (symlink `public/storage` ke volume). Diperiksa di Task 5.
- `APP_KEY` kosong menghasilkan 500 membingungkan; `deploy.sh` harus menolak berjalan. Task 3.
- Migrasi gagal tidak boleh mengganti container yang sedang jalan. Task 3 (migrasi sebelum `up -d`, `set -e`).
- App start sebelum MySQL siap pada boot pertama. Task 3 (`depends_on` + healthcheck).

---

### Task 1: Trust proxy

**Files:**
- Modify: `bootstrap/app.php`
- Test: `tests/Feature/TrustProxiesTest.php`

**Interfaces:**
- Produces: aplikasi mempercayai header `X-Forwarded-*` dari proxy mana pun (aman karena satu-satunya jalan masuk adalah tunnel).

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php

use Illuminate\Support\Facades\Route;

it('menganggap request HTTPS bila proxy mengirim X-Forwarded-Proto', function () {
    Route::get('/_proto', fn () => response()->json(['secure' => request()->isSecure()]));

    $this->get('/_proto', ['X-Forwarded-Proto' => 'https'])->assertJson(['secure' => true]);
    $this->get('/_proto')->assertJson(['secure' => false]);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=TrustProxiesTest`
Expected: FAIL (`secure` bernilai false pada request pertama).

- [ ] **Step 3: Implementasi**

Di `bootstrap/app.php`, ganti baris komentar `//` di dalam closure `withMiddleware` dengan:

```php
        // Satu-satunya jalan masuk produksi adalah Cloudflare Tunnel (lihat docs/ops/deployment.md).
        $middleware->trustProxies(at: '*');
```

- [ ] **Step 4: Jalankan, pastikan lulus, lalu seluruh suite**

Run: `php artisan test --filter=TrustProxiesTest` → PASS. Lalu `php artisan test` → semua lulus.

- [ ] **Step 5: Commit**

```bash
git add bootstrap/app.php tests/Feature/TrustProxiesTest.php
git commit -m "feat(deploy): trust forwarded headers from Cloudflare Tunnel"
```

---

### Task 2: Image (Dockerfile, Nginx, PHP, entrypoint)

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker/php.ini`, `docker/entrypoint.sh`, `docker/nginx.conf`
- Modify: `.gitattributes` (hanya jika belum memaksa LF untuk `*.sh`)

**Interfaces:**
- Produces: target build `app` (CMD `php-fpm`, user `www-data`, port 9000) dan target `web` (Nginx port 80, `fastcgi_pass app:9000`). Entrypoint `/entrypoint.sh` menjalankan cache artisan lalu `exec "$@"`.

- [ ] **Step 1: `.dockerignore`**

```
.git
.github
.env
.env.*
!.env.production.example
node_modules
vendor
public/build
public/hot
public/storage
storage/logs/*
storage/framework/cache/data/*
storage/framework/sessions/*
storage/framework/views/*
backups
docs
tests
.idea
.vscode
.superpowers
.playwright-mcp
*.log
```

- [ ] **Step 2: `docker/php.ini`**

```ini
memory_limit=512M
upload_max_filesize=10M
post_max_size=12M
expose_php=0
opcache.enable=1
opcache.validate_timestamps=0
opcache.memory_consumption=128
opcache.max_accelerated_files=10000
```

- [ ] **Step 3: `docker/entrypoint.sh`**

```sh
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
```

- [ ] **Step 4: `docker/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html/public;
    index index.php;
    charset utf-8;
    client_max_body_size 12M;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass app:9000;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.(?!well-known) {
        deny all;
    }
}
```

- [ ] **Step 5: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts

FROM node:24-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
COPY --from=vendor /app/vendor ./vendor
RUN npm run build

FROM php:8.4-fpm-alpine AS app
RUN apk add --no-cache libpng-dev libjpeg-turbo-dev freetype-dev libzip-dev icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 pdo_mysql gd zip bcmath intl exif opcache pcntl
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /var/www/html
COPY --chown=www-data:www-data . .
COPY --from=vendor --chown=www-data:www-data /app/vendor ./vendor
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build
RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
ENTRYPOINT ["/entrypoint.sh"]
CMD ["php-fpm"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=app /var/www/html/public /var/www/html/public
RUN rm -rf /var/www/html/public/storage \
    && ln -s ../storage/app/public /var/www/html/public/storage
```

- [ ] **Step 6: Paksa LF untuk skrip**

Run: `grep -n "eol" .gitattributes`. Bila tidak ada baris yang mencakup `*.sh`, tambahkan:

```
*.sh text eol=lf
docker/** text eol=lf
```

- [ ] **Step 7: Cek sintaks skrip**

Run: `sh -n docker/entrypoint.sh && echo ok` → `ok`. (Build image diverifikasi di Task 5.)

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore docker .gitattributes
git commit -m "feat(deploy): add multi-stage Dockerfile, nginx and php config"
```

---

### Task 3: Compose, env contoh, skrip deploy dan backup

**Files:**
- Create: `compose.prod.yaml`, `.env.production.example`, `deploy.sh`, `backup.sh`
- Modify: `.gitignore` (tambah `/backups`)

**Interfaces:**
- Consumes: target `app` dan `web` dari Task 2.
- Produces: `deploy.sh` (tanpa argumen, dijalankan dari host sebagai `deploy`) dan `backup.sh` (menulis `backups/sibima-YYYY-MM-DD.sql.gz` dan `backups/storage-YYYY-MM-DD.tgz`).

- [ ] **Step 1: `compose.prod.yaml`**

```yaml
name: sibima

x-app: &app
  build:
    context: .
    target: app
  image: sibima-app
  env_file: .env
  restart: unless-stopped
  volumes:
    - storage:/var/www/html/storage
  depends_on:
    db:
      condition: service_healthy

services:
  app:
    <<: *app

  queue:
    <<: *app
    command: php artisan queue:work database --sleep=3 --tries=1 --timeout=600 --max-time=3600 --memory=512

  scheduler:
    <<: *app
    command: php artisan schedule:work

  web:
    build:
      context: .
      target: web
    image: sibima-web
    restart: unless-stopped
    depends_on:
      - app
    volumes:
      - storage:/var/www/html/storage:ro

  db:
    image: mysql:8.4
    restart: unless-stopped
    command: --innodb-buffer-pool-size=512M --max-connections=50
    environment:
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_RANDOM_ROOT_PASSWORD: "1"
    volumes:
      - dbdata:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -u\"$$MYSQL_USER\" -p\"$$MYSQL_PASSWORD\" --silent"]
      interval: 5s
      timeout: 5s
      retries: 20

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on:
      - web

volumes:
  dbdata:
  storage:
```

- [ ] **Step 2: `.env.production.example`** (nilai tanpa tanda kutip; isi yang berlabel `GANTI`)

```
APP_NAME=SIBIMA
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://si-bima.online

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=sibima
DB_USERNAME=sibima
DB_PASSWORD=GANTI

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=database
DB_QUEUE_RETRY_AFTER=900
CACHE_STORE=database
FILESYSTEM_DISK=local
BROADCAST_CONNECTION=log

MAIL_MAILER=resend
RESEND_API_KEY=GANTI
MAIL_FROM_ADDRESS=noreply@si-bima.online
MAIL_FROM_NAME=SIBIMA

VITE_APP_NAME=SIBIMA

TUNNEL_TOKEN=GANTI
```

- [ ] **Step 3: `deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DC="docker compose -f compose.prod.yaml"

grep -q '^APP_KEY=base64:' .env || { echo "APP_KEY di .env kosong. Lihat docs/ops/deployment.md bagian 3." >&2; exit 1; }

git pull --ff-only
$DC build
$DC up -d db
$DC run --rm app php artisan migrate --force
$DC run --rm app php artisan db:seed --class=WorkflowDefinitionSeeder --force
$DC up -d --remove-orphans
docker image prune -f
```

- [ ] **Step 4: `backup.sh`**

```bash
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
```

- [ ] **Step 5: `.gitignore`**: tambahkan baris `/backups`.

- [ ] **Step 6: Cek sintaks**

Run: `bash -n deploy.sh && bash -n backup.sh && echo ok` → `ok`. Lalu `git update-index --chmod=+x deploy.sh backup.sh` setelah `git add` agar bit eksekusi tersimpan di repo.

- [ ] **Step 7: Commit**

```bash
git add compose.prod.yaml .env.production.example deploy.sh backup.sh .gitignore
git update-index --chmod=+x deploy.sh backup.sh
git commit -m "feat(deploy): add production compose, env template, deploy and backup scripts"
```

---

### Task 4: Runbook

**Files:**
- Create: `docs/ops/deployment.md`
- Modify: `docs/ops/queue-setup.md` (satu catatan di atas bagian "Produksi")

- [ ] **Step 1: Tulis `docs/ops/deployment.md`**

````markdown
# Deployment (Docker + Cloudflare Tunnel)

Target: VPS Ubuntu 24.04, domain `si-bima.online` (Rumahweb), DNS dan CDN lewat Cloudflare. Semua service jalan di Docker; host hanya membuka port 22. Rancangan: `docs/superpowers/specs/2026-10-07-docker-deployment-design.md`.

## 1. Siapkan VPS (sekali)

Sebagai `root`:

```bash
timedatectl set-timezone Asia/Jakarta
apt install -y ufw fail2ban git
adduser deploy                 # isi password, sisanya Enter
usermod -aG sudo deploy
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Dari laptop (PowerShell), pasang SSH key ke user `deploy` (buat dulu dengan `ssh-keygen -t ed25519` bila belum punya):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@IP_VPS "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

**Buka terminal kedua dan pastikan `ssh deploy@IP_VPS` masuk tanpa password sebelum lanjut.** Lalu sebagai `root` (atau `sudo`):

```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
EOF
systemctl restart ssh
ufw allow OpenSSH
ufw --force enable
```

Nama file `00-` penting: pada sshd nilai pertama yang terbaca menang, dan `50-cloud-init.conf` bisa menyalakan lagi login password. Mulai sini login sebagai `deploy`.

## 2. Cloudflare dan Rumahweb

1. Daftar di cloudflare.com (paket Free) → **Add a site** → `si-bima.online`. Hapus A record lama bila Cloudflare mengimpornya.
2. Rumahweb: Client Area → Domain → pilih domain → **Nameservers** → ganti ke dua nameserver yang diberikan Cloudflare. Tunggu status situs di Cloudflare menjadi **Active** (beberapa menit sampai beberapa jam).
3. Cloudflare → **Zero Trust** → Networks → Tunnels → **Create a tunnel** (Cloudflared), nama `sibima`. Salin **token** (string panjang setelah `--token` / `TUNNEL_TOKEN`). Cloudflare kadang meminta kartu untuk verifikasi paket Free.
4. Di tunnel itu, tab **Public Hostname**: hostname `si-bima.online`, service `HTTP`, URL `web:80`. Tambahkan `www.si-bima.online` dengan tujuan sama bila diperlukan.
5. Cloudflare → SSL/TLS → mode **Full**; Edge Certificates → **Always Use HTTPS** aktif.

## 3. Deploy pertama

Sebagai `deploy`:

```bash
sudo mkdir -p /opt/sibima && sudo chown deploy:deploy /opt/sibima
git clone https://github.com/abdlazz00/sibima.git /opt/sibima
cd /opt/sibima
cp .env.production.example .env
nano .env        # isi DB_PASSWORD, RESEND_API_KEY, TUNNEL_TOKEN
```

Repo private? Buat deploy key: `ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""`, tempel `~/.ssh/github_deploy.pub` di GitHub repo → Settings → Deploy keys, lalu clone dengan `GIT_SSH_COMMAND="ssh -i ~/.ssh/github_deploy" git clone git@github.com:abdlazz00/sibima.git /opt/sibima` dan simpan konfigurasinya di `~/.ssh/config`.

Buat `APP_KEY`:

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml run --rm app php artisan key:generate --show
```

Tempel hasilnya (`base64:...`) ke `APP_KEY=` di `.env`. Lalu:

```bash
./deploy.sh
docker compose -f compose.prod.yaml run --rm app php artisan db:seed --force
```

`db:seed` hanya sekali: mengisi role, permission, unit, kategori aset, alur persetujuan. Data demo dan akun demo tidak dibuat di produksi. Buat akun pertama:

```bash
docker compose -f compose.prod.yaml run --rm app php artisan tinker --execute='$u = App\Models\User::create(["name" => "Kasubag", "email" => "EMAIL_ANDA", "password" => "PASSWORD_KUAT", "unit_id" => null, "email_verified_at" => now()]); $u->assignRole("kasubag");'
```

Role `kasubag` (tanpa unit) adalah akun tingkat atas pada seeder; akun lain dibuat dari menu manajemen user di aplikasi. Ganti password dari aplikasi setelah login, lalu hapus riwayat shell (`history -c`).

Cek: `curl -I https://si-bima.online/up` → `200`.

## 4. Update

```bash
cd /opt/sibima && ./deploy.sh
```

Skrip: pull → build → migrate → seeder alur (non-destruktif) → ganti container. Bila migrasi gagal, container lama tetap jalan. `PermissionSeeder` tidak dijalankan otomatis karena menimpa permission role sistem; jalankan manual hanya bila rilis menambah permission: `docker compose -f compose.prod.yaml run --rm app php artisan db:seed --class=PermissionSeeder --force`.

## 5. Backup

```bash
chmod +x backup.sh
crontab -e     # tambahkan:
0 2 * * * /opt/sibima/backup.sh >> /opt/sibima/backups/backup.log 2>&1
```

Menghasilkan `backups/sibima-TANGGAL.sql.gz` (database) dan `backups/storage-TANGGAL.tgz` (foto dan file import), disimpan 14 hari. Backup di VPS yang sama tidak melindungi bila VPS hilang: salin berkala ke luar, misalnya dari laptop `scp deploy@IP_VPS:/opt/sibima/backups/* D:\backup-sibima\`.

Restore database:

```bash
gunzip -c backups/sibima-TANGGAL.sql.gz | docker compose -f compose.prod.yaml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

## 6. Rollback

```bash
cd /opt/sibima
git log --oneline -5
git checkout SHA_SEBELUMNYA
docker compose -f compose.prod.yaml build && docker compose -f compose.prod.yaml up -d
```

Bila rilis yang di-rollback punya migrasi, kembalikan database dari backup (bagian 5) atau jalankan `migrate:rollback --step=N`. Setelah masalah beres: `git checkout main`.

## 7. Pemecahan masalah

| Gejala | Pemeriksaan |
|---|---|
| Situs tidak terbuka, Cloudflare error 1033/502 | `docker compose -f compose.prod.yaml logs cloudflared web`; pastikan token benar dan hostname mengarah ke `web:80`. |
| 500 | `docker compose -f compose.prod.yaml logs app` dan `exec app tail storage/logs/laravel.log`; periksa `APP_KEY` dan koneksi DB. |
| Impor tetap "Memeriksa" | `docker compose -f compose.prod.yaml logs queue`. |
| Foto tidak tampil | `docker compose -f compose.prod.yaml exec web ls -l public/storage/` harus menampilkan isi volume. |
| Perlu shell di app | `docker compose -f compose.prod.yaml exec app sh`. |
````

- [ ] **Step 2: Catatan di `docs/ops/queue-setup.md`**

Tepat di bawah judul `## Produksi (Ubuntu, Nginx + PHP-FPM, Supervisor)`, sisipkan:

```
> Deployment standar memakai Docker (worker dan scheduler sudah berupa container): lihat `docs/ops/deployment.md`. Langkah Supervisor dan cron di bawah hanya untuk instalasi non-Docker.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/deployment.md docs/ops/queue-setup.md
git commit -m "docs(ops): add Docker + Cloudflare Tunnel deployment runbook"
```

---

### Task 5: Deploy pertama di VPS (dijalankan bersama pengguna)

Bukan perubahan kode: pengguna mengeksekusi `docs/ops/deployment.md` bagian 1-3 di VPS dan menempelkan keluaran; Claude membaca keluaran dan memperbaiki file bila ada yang salah. Setelah `git push` branch ini ke GitHub (atas persetujuan pengguna).

- [ ] **Step 1:** `docker compose -f compose.prod.yaml config -q` di VPS → tanpa error.
- [ ] **Step 2:** `docker compose -f compose.prod.yaml build` lulus (periksa RAM: `free -h`; swap harus terpakai bila perlu).
- [ ] **Step 3:** Setelah `./deploy.sh`, `docker compose -f compose.prod.yaml ps` → `app`, `web`, `queue`, `scheduler`, `db` (healthy), `cloudflared` semuanya `Up`.
- [ ] **Step 4:** `curl -I https://si-bima.online/up` → 200; login dengan akun yang dibuat; tidak ada peringatan mixed content di browser.
- [ ] **Step 5:** Unggah foto aset, lalu `docker compose -f compose.prod.yaml up -d --force-recreate app web`; foto masih tampil.
- [ ] **Step 6:** Unggah template impor kecil; status berubah dari "Memeriksa" ke "Siap dikonfirmasi" (worker hidup).
- [ ] **Step 7:** `docker compose -f compose.prod.yaml exec scheduler php artisan schedule:list` menampilkan `import:prune`.
- [ ] **Step 8:** Jalankan `./backup.sh` sekali; kedua file ada di `backups/` dan `gunzip -t backups/sibima-*.sql.gz` sukses.
