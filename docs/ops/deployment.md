# Deployment (Docker + Let's Encrypt SSL)

Branch `production` dipakai khusus untuk deployment; `main` dibiarkan sebagai cadangan codebase sebelum Docker. Fitur baru dikerjakan di `main`/branch fitur lalu di-merge ke `production` saat siap rilis.

Target: VPS Ubuntu 24.04, domain `si-bima.online` (Rumahweb). Semua service aplikasi jalan di Docker Compose; host membuka port 22 (SSH), 80 (HTTP), dan 443 (HTTPS). SSL ditangani langsung oleh Nginx + Certbot di dalam Docker.

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
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Nama file `00-` penting: pada sshd nilai pertama yang terbaca menang, dan `50-cloud-init.conf` bisa menyalakan lagi login password. Mulai sini login sebagai `deploy`.

## 2. Konfigurasi DNS di Rumahweb

1. Buka Client Area Rumahweb → Domain → **DNS Management** (atau cPanel jika DNS dikelola di hosting).
2. Tambahkan / sesuaikan **A Record** agar mengarah langsung ke IP Public VPS:
   - Host `@` (atau kosong) → `IP_VPS`
   - Host `www` → `IP_VPS`
3. Pastikan nameserver domain menggunakan default Rumahweb (bukan Cloudflare).
4. Verifikasi dari laptop atau VPS sampai domain merespons IP VPS:
   ```bash
   ping -c 2 si-bima.online
   ```

## 3. Deploy pertama

Sebagai `deploy`:

```bash
sudo mkdir -p /opt/sibima && sudo chown deploy:deploy /opt/sibima
git clone -b production https://github.com/abdlazz00/sibima.git /opt/sibima
cd /opt/sibima
chmod +x deploy.sh init-ssl.sh backup.sh
cp .env.production.example .env
nano .env        # isi DB_PASSWORD (tanpa karakter $) dan RESEND_API_KEY
```

Repo private? Buat deploy key: `ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""`, tempel `~/.ssh/github_deploy.pub` di GitHub repo → Settings → Deploy keys, lalu clone dengan `GIT_SSH_COMMAND="ssh -i ~/.ssh/github_deploy" git clone -b production git@github.com:abdlazz00/sibima.git /opt/sibima` dan simpan konfigurasinya di `~/.ssh/config`.

Buat `APP_KEY`:

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml run --rm app php artisan key:generate --show
```

Tempel hasilnya (`base64:...`) ke `APP_KEY=` di `.env`.

Terbitkan sertifikat SSL Let's Encrypt (ganti email dengan email admin Anda):

```bash
./init-ssl.sh admin@si-bima.online
```

Lalu jalankan deploy aplikasi dan database:

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

Skrip: pull → build → migrate → seeder alur (non-destruktif) → ganti container. Bila migrasi gagal, container lama tetap jalan. Permission baru tiba lewat migrasi data yang aditif dan berjalan bersama `migrate`; `PermissionSeeder` tidak perlu dijalankan saat deploy dan tidak menimpa role yang sudah punya permission.

## 5. Backup & SSL Auto-Renewal

```bash
crontab -e     # tambahkan:
0 2 * * * /opt/sibima/backup.sh >> /opt/sibima/backups/backup.log 2>&1
0 4 * * * cd /opt/sibima && docker compose -f compose.prod.yaml exec -T web nginx -s reload >/dev/null 2>&1
```

- **Backup**: Menghasilkan `backups/sibima-TANGGAL.sql.gz` (database) dan `backups/storage-TANGGAL.tgz` (foto dan file import), disimpan 14 hari. Salin berkala ke luar, misalnya dari laptop: `scp deploy@IP_VPS:/opt/sibima/backups/* D:\backup-sibima\`.
- **SSL Auto-Renewal**: Container `certbot` di `compose.prod.yaml` otomatis memeriksa pembaruan sertifikat setiap 12 jam. Cron jam 04:00 di atas me-reload Nginx agar sertifikat baru aktif.

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
| Situs tidak terbuka / connection timed out | Pastikan firewall UFW membuka port 80 dan 443 (`sudo ufw status`). Pastikan A Record domain di Rumahweb sudah mengarah ke IP VPS (`ping si-bima.online`). |
| SSL error / SSL handshake failed | Periksa volume `./certbot/conf/live/si-bima.online/`. Jalankan ulang `./init-ssl.sh email@domain.com` untuk memperbarui/membuat ulang sertifikat. |
| 500 | `docker compose -f compose.prod.yaml logs app` dan `exec app tail storage/logs/laravel.log`; periksa `APP_KEY` dan koneksi DB. |
| Impor tetap "Memeriksa" | `docker compose -f compose.prod.yaml logs queue`. |
| Foto tidak tampil | `docker compose -f compose.prod.yaml exec web ls -l public/storage/` harus menampilkan isi volume. |
| Perlu shell di app | `docker compose -f compose.prod.yaml exec app sh`. |
