# Deployment (Docker + Cloudflare Tunnel)

Branch `production` dipakai khusus untuk deployment; `main` dibiarkan sebagai cadangan codebase sebelum Docker. Fitur baru dikerjakan di `main`/branch fitur lalu di-merge ke `production` saat siap rilis.

Target: VPS Ubuntu 24.04, domain `si-bima.online` (Rumahweb), DNS dan CDN lewat Cloudflare. Semua service jalan di Docker; host hanya membuka port 22. Rancangan: `docs/superpowers/specs/2026-10-07-docker-deployment-design.md`.

## 1. Siapkan VPS (sekali)

Sebagai `root`:

```bash
timedatectl set-timezone Asia/Jakarta
apt update && apt upgrade -y
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
3. Buat tunnel lewat CLI di VPS (akun Cloudflare biasa, tanpa Zero Trust dan tanpa kartu). Sebagai `deploy`:

```bash
mkdir -p ~/.cloudflared && sudo chown 65532:65532 ~/.cloudflared
CF="docker run --rm -v $HOME/.cloudflared:/home/nonroot/.cloudflared cloudflare/cloudflared:latest"
$CF tunnel login                  # buka URL yang tercetak di browser, pilih si-bima.online, Authorize
$CF tunnel create sibima-prod     # mencetak ID tunnel dan menulis ~/.cloudflared/ID.json
$CF tunnel route dns --overwrite-dns sibima-prod si-bima.online
```

4. Setelah repo di-clone (bagian 3), siapkan folder konfigurasi (ganti `ID` dengan ID tunnel):

```bash
mkdir -p /opt/sibima/cloudflared && cd /opt/sibima/cloudflared
cp ~/.cloudflared/ID.json credentials.json && sudo chown 65532:65532 credentials.json && chmod 600 credentials.json
cat > config.yml <<'YML'
tunnel: ID
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: si-bima.online
    service: http://web:80
  - service: http_status:404
YML
```

`credentials.json` adalah kunci akses tunnel: jangan dibagikan dan jangan di-commit (folder `cloudflared/` sudah di-ignore). Untuk `www`, tambahkan entri `hostname: www.si-bima.online` dengan `service` yang sama sebelum baris `http_status:404`, lalu `$CF tunnel route dns sibima-prod www.si-bima.online`.
5. Cloudflare → SSL/TLS → mode **Full**; Edge Certificates → **Always Use HTTPS** aktif.

## 3. Deploy pertama

Sebagai `deploy`:

```bash
sudo mkdir -p /opt/sibima && sudo chown deploy:deploy /opt/sibima
git clone -b production https://github.com/abdlazz00/sibima.git /opt/sibima
cd /opt/sibima
cp .env.production.example .env
nano .env        # isi DB_PASSWORD (tanpa karakter $) dan RESEND_API_KEY
```

Repo private? Buat deploy key: `ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""`, tempel `~/.ssh/github_deploy.pub` di GitHub repo → Settings → Deploy keys, lalu clone dengan `GIT_SSH_COMMAND="ssh -i ~/.ssh/github_deploy" git clone -b production git@github.com:abdlazz00/sibima.git /opt/sibima` dan simpan konfigurasinya di `~/.ssh/config`.

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

Bila rilis yang di-rollback punya migrasi, kembalikan database dari backup (bagian 5) atau jalankan `migrate:rollback --step=N`. Setelah masalah beres: `git checkout production`.

## 7. Pemecahan masalah

| Gejala | Pemeriksaan |
|---|---|
| Situs tidak terbuka, Cloudflare error 1033/502 | `docker compose -f compose.prod.yaml logs cloudflared web`; pastikan `cloudflared/config.yml` dan `credentials.json` ada, ID tunnel benar, dan `service` mengarah ke `http://web:80`. |
| 500 | `docker compose -f compose.prod.yaml logs app` dan `exec app tail storage/logs/laravel.log`; periksa `APP_KEY` dan koneksi DB. |
| Impor tetap "Memeriksa" | `docker compose -f compose.prod.yaml logs queue`. |
| Foto tidak tampil | `docker compose -f compose.prod.yaml exec web ls -l public/storage/` harus menampilkan isi volume. |
| Perlu shell di app | `docker compose -f compose.prod.yaml exec app sh`. |
