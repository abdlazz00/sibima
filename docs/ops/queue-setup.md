# Setup Queue Worker (Import Excel)

Import Excel berjalan di antrean (`QUEUE_CONNECTION=database`, tabel `jobs`). **Tanpa worker yang aktif, batch import berhenti di status "Memeriksa" dan tidak pernah selesai.** Scheduler harian (`import:prune`) juga butuh cron.

## Variabel .env

```
QUEUE_CONNECTION=database
DB_QUEUE_RETRY_AFTER=900
```

`DB_QUEUE_RETRY_AFTER` (detik) **harus lebih besar** dari `import.job_timeout` (600 detik, `config/import.php`). Bila lebih kecil, job yang masih berjalan dianggap macet dan dijalankan ganda. Test `ImportFoundationTest` menjaga hal ini.

## Development

Cara termudah: `composer dev` (menjalankan server, `queue:listen`, log, dan Vite sekaligus). `queue:listen` memuat ulang kode di setiap job, jadi perubahan kode langsung berlaku.

Hanya worker saja: `php artisan queue:listen --tries=1 --timeout=0`.

Cek cepat: unggah template kategori di halaman Impor; status harus berubah dari "Memeriksa" ke "Siap dikonfirmasi" dalam hitungan detik. Bila tetap "Memeriksa", worker tidak berjalan.

## Produksi (Ubuntu, Nginx + PHP-FPM, Supervisor)

> Deployment standar memakai Docker (worker dan scheduler sudah berupa container): lihat `docs/ops/deployment.md`. Langkah Supervisor dan cron di bawah hanya untuk instalasi non-Docker.

1. Pasang Supervisor: `sudo apt install supervisor`.
2. `/etc/supervisor/conf.d/sibima-queue.conf`:

```ini
[program:sibima-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/sibima/artisan queue:work database --sleep=3 --tries=1 --timeout=600 --max-time=3600 --memory=512
directory=/var/www/sibima
user=www-data
numprocs=1
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stopwaitsecs=660
redirect_stderr=true
stdout_logfile=/var/www/sibima/storage/logs/queue-worker.log
```

3. Aktifkan: `sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start sibima-queue:*`.
4. Cron untuk scheduler (`import:prune` harian): `* * * * * cd /var/www/sibima && php artisan schedule:run >> /dev/null 2>&1` (crontab user `www-data`).
5. Batas unggahan: Nginx `client_max_body_size 8m;`, `php.ini` (FPM) `upload_max_filesize=8M` dan `post_max_size=8M`. Batas aplikasi 5 MB dan 10.000 baris ada di `config/import.php`.
6. Memori: worker memakai `memory_limit` CLI; `--memory=512` membuat worker restart bila melewati 512 MB. Pembacaan Excel per chunk 500 baris sehingga kebutuhan nyata jauh di bawah itu.

## Email (reset password)

Email reset password dikirim lewat antrean, jadi worker di atas wajib hidup. Dev memakai `MAIL_MAILER=log` (isi email ada di `storage/logs/laravel.log`).

Produksi memakai Resend:

1. Daftar di resend.com, tambahkan domain, lalu pasang record DNS (SPF dan DKIM) yang diminta sampai statusnya *Verified*. Tanpa domain terverifikasi, Resend hanya mau mengirim ke email pemilik akun.
2. Buat API key, lalu isi `.env` produksi:

```
MAIL_MAILER=resend
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM_ADDRESS="noreply@domain-anda"
MAIL_FROM_NAME="SIBIMA"
APP_URL=https://alamat-produksi
```

3. `php artisan config:cache` lalu `php artisan queue:restart`.
4. Coba dari halaman Lupa Password dengan email pegawai yang nyata. Status pengiriman terlihat di dashboard Resend; email gagal terlihat di tabel `failed_jobs`.

Alamat email akun harus benar-benar bisa menerima surat (akun demo `*@simaset.test` tidak akan menerima apa pun).

## Setiap deploy

```
php artisan migrate --force
php artisan db:seed --class=WorkflowDefinitionSeeder --force
php artisan queue:restart
```

`queue:restart` membuat worker memuat kode baru setelah job berjalan selesai. Permission baru tiba lewat migrasi data yang aditif (berjalan bersama `migrate`); seeder tidak menimpa role yang sudah punya permission, jadi perubahan dari menu Pengaturan Role aman. `WorkflowDefinitionSeeder` non-destruktif: hanya membuat alur yang belum ada (tanpa ini, mengajukan permohonan/penerimaan gagal dengan 404 karena definisi alurnya tidak ditemukan).

## Pemecahan masalah

| Gejala | Pemeriksaan |
|---|---|
| Batch tetap "Memeriksa" | `sudo supervisorctl status`; lihat `storage/logs/queue-worker.log`. |
| Batch "Gagal" | `storage/logs/laravel.log` (detail teknis tidak ditampilkan ke pengguna); `php artisan queue:failed`. |
| Impor jalan dua kali | `DB_QUEUE_RETRY_AFTER` lebih kecil dari timeout job. |
| Batch "Siap" lama tidak berubah | Normal: dikedaluwarsakan setelah 7 hari oleh `import:prune` (butuh cron aktif). |
