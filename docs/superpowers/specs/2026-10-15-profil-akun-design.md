# Profil Akun: Desain Ulang Halaman dan Fitur Akun

Tanggal: 2026-10-15 · Status: menunggu tinjauan pengguna · Jalur: arsitektural (empat tahap bergerbang)

## 1. Tujuan

Mengganti halaman Profil (Breeze mentah, berbahasa Inggris, hanya dua form) menjadi halaman akun lengkap bergaya Untitled UI berbahasa Indonesia: identitas, ubah data masuk, foto, keamanan sesi, dan riwayat aktivitas. Dikerjakan dalam empat tahap; setiap tahap berakhir di gerbang penilaian pengguna.

Keberhasilan: pengguna dapat melihat siapa dirinya di sistem (NIP, role, unit, cakupan data), mengubah nama/email/sandi/foto dengan aman, melihat dan mencabut sesi login, serta menelusuri aktivitas kerja dan login akunnya, tanpa mengubah perilaku modul lain.

## 2. Keputusan (hasil wawancara)

| Topik | Keputusan |
|---|---|
| Cakupan | Info akun read-only, ubah nama & email, ubah sandi, foto profil, keamanan sesi, riwayat aktivitas |
| Tata letak | Kepala profil (foto, nama, role, unit, status) + tab **Akun / Keamanan / Aktivitas** |
| Gaya form | Baca dulu: baris label + nilai + tombol **Ubah**; form di dalam dialog |
| Nama | Boleh diubah pengguna sendiri (seperti sekarang); tidak menyalin ke data Pegawai |
| Email | Wajib mengisi sandi saat ini bila email berubah |
| Info akun | NIP, role, unit, cakupan data, status. **Izin tidak ditampilkan.** |
| Foto | Milik user (kolom baru), semua akun bisa; cadangan: foto Pegawai yang terhubung |
| Sesi | Daftar sesi; Keluarkan per sesi dan Keluar dari semua perangkat lain; keduanya meminta sandi saat ini |
| Riwayat | Satu linimasa gabungan, filter Semua/Pekerjaan/Login, 15 entri per halaman |
| Log login | Berhasil + gagal + logout; disimpan 90 hari lalu dipangkas otomatis |
| Pesan sukses | Flash `success` yang sudah ada |

Di luar cakupan: autentikasi dua langkah, preferensi notifikasi, perubahan NIP/role/unit oleh pengguna sendiri, hapus akun, terjemahan pesan galat selain yang dipakai Profil.

## 3. Struktur halaman

Berkas: `resources/js/Pages/Profile/Edit.tsx` (+ potongan di `Pages/Profile/Partials/`, menggantikan dua form Breeze). Tata letak memakai `AuthenticatedLayout` dan `PageHeader` (judul "Profil").

- **Kepala profil**: foto bundar 64 px (inisial bila belum ada foto), nama, badge role, nama unit, badge status Aktif. Tombol kamera kecil di foto membuka dialog Ganti foto (tahap 2).
- **Tab Akun**
  - Kartu *Info akun*: daftar dua kolom: NIP (— bila akun tak terhubung ke data pegawai), role, unit, cakupan data (label dari `lib/unitScope.ts`), status.
  - Kartu *Data masuk*: tiga baris `InfoRow` (label, nilai, tombol Ubah): **Nama** (dialog satu kolom), **Email** (dialog: email baru + sandi saat ini), **Kata sandi** ("Terakhir diubah …" bila `password_changed_at` ada; dialog: sandi saat ini, sandi baru, ulangi, dengan tombol tampilkan sandi).
- **Tab Keamanan** (tahap 3): kartu *Sesi aktif*: baris per sesi (perangkat/peramban, IP, aktif terakhir). Sesi berjalan berbadge "Perangkat ini" tanpa aksi; sesi lain punya tombol Keluarkan; kepala kartu punya "Keluar dari semua perangkat lain". Semua aksi membuka dialog yang meminta sandi saat ini.
- **Tab Aktivitas** (tahap 4): filter Semua/Pekerjaan/Login; linimasa terbaru-di-atas dengan ikon, keterangan, waktu; entri pekerjaan menaut ke dokumen; `PaginationPageDefault`.
- Bilah tab hanya dirender bila ada lebih dari satu tab (tahap 1–2: hanya isi Akun tanpa bilah).

Komponen: yang sudah ada (`PageHeader`, `Tabs`, `Badge`, `Button`, `ModalOverlay`/`Dialog`, `Input` termasuk `type="password"`, `Table`/daftar, `ConfirmDialog`). Komponen bersama baru: `InfoRow` (baris label–nilai–aksi). Dialog form dibuat sebagai komponen kecil per dialog di `Pages/Profile/Partials/`.

## 4. Backend dan data

### Migrasi
- `users.foto_profile` (string nullable), `users.password_changed_at` (timestamp nullable).
- `login_logs`: `id`, `user_id` (nullable, FK ke users, `nullOnDelete`), `identifier` (string, apa yang diketik saat login), `event` (`login`/`gagal`/`logout`), `ip_address` (string 45), `user_agent` (text nullable), `created_at`. Indeks `(user_id, created_at)`. Model `LoginLog` memakai `Prunable` (hapus entri > 90 hari); `Schedule::command('model:prune', ['--model' => LoginLog::class])->daily()` di `routes/console.php`.

### Model
- `User`: hook `saving` mengisi `password_changed_at` bila `password` berubah (mencakup Profil, reset sandi, dan admin). Aksesor `fotoProfileUrl`: foto user, bila kosong foto Pegawai; `foto_profile` ditambah ke `Fillable`.

### Rute dan validasi
Semua hanya bekerja pada `$request->user()`; tidak perlu policy.
- `PATCH /profile` (`profile.update`, ada): nama dan/atau email. `current_password` wajib hanya bila email berbeda dari saat ini (`current_password` rule). Pesan galat berbahasa Indonesia ditulis di Form Request.
- `PUT /password` (ada): dipakai dialog sandi; pesan galat berbahasa Indonesia.
- `POST /profile/photo`, `DELETE /profile/photo`: `image`, jpg/png/webp, maks 2 MB, disk `public`; foto lama dihapus saat diganti/dihapus.
- `DELETE /profile/sessions/{id}`, `DELETE /profile/sessions`: `current_password` wajib; menghapus baris `sessions` milik user (sesi berjalan dikecualikan). Driver sesi `database` dipakai langsung.
- Prop `sessions` (daftar sesi user dengan penanda sesi berjalan; peramban/OS diurai dengan fungsi kecil, tanpa paket baru) dikirim di `Profile/Edit`.
- Prop lazy `aktivitas` (filter + halaman) dimuat saat tab Aktivitas dibuka.
- `trustProxies` di `bootstrap/app.php` kini hanya `HEADER_X_FORWARDED_PROTO`; tahap 3 menambah `HEADER_X_FORWARDED_FOR` (aplikasi di belakang Cloudflare Tunnel) agar IP sesi/log benar, dan diverifikasi terhadap setup produksi.

### Penggabung riwayat (`ActivityFeed`)
Sumber: `approval_requests` (pengajuan yang dibuat user: `created_by`), `approval_actions` (setuju/tolak/batal/alih oleh user), `login_logs`. Tiap sumber diambil `page × 15` entri terbaru, digabung, diurutkan menurut waktu, dipotong per halaman. Judul dokumen dan tautan dari `approvalTitle()`/`approvalShowUrl()` yang sudah ada. Pengajuan mencakup penerimaan, mutasi, permohonan, dan laporan rusak/hilang.

### Pencatatan login
Listener untuk `Login`, `Failed`, dan `Logout` mencatat satu baris `login_logs`. `identifier` diambil dari input `email` (bisa berisi NIP). Percobaan gagal pada akun tak dikenal dicatat dengan `user_id` kosong (tidak tampil di Aktivitas pengguna mana pun).

## 5. Tahap eksekusi (satu plan, empat bagian bergerbang)

1. **Dasar**: halaman baru, kepala profil (inisial), Info akun, dialog nama/email/sandi; migrasi `password_changed_at` + hook; aturan `current_password` untuk email; pesan galat Indonesia; tes.
2. **Foto**: migrasi `foto_profile`, rute foto, aksesor + cadangan, dialog Ganti foto; tes.
3. **Keamanan sesi**: tab muncul, daftar sesi, pencabutan, perbaikan `trustProxies`; tes.
4. **Riwayat aktivitas**: `login_logs`, listener, pemangkasan terjadwal, `ActivityFeed`, tab Aktivitas; tes.

Setiap tahap: backend dengan tes dulu (Pest), tampilan lewat `tsc` + build + cek runtime singkat, commit per tugas di `main`, tanpa push. Penerapan ke produksi memerlukan `php artisan migrate` (tahap 1, 2, 4); penjadwal sudah ada (`schedule:work` di `compose.prod.yaml`).

## 6. Pengujian (Pest)

- Tahap 1: ubah nama tanpa sandi; ubah email dengan sandi benar/salah/tanpa sandi; `password_changed_at` terisi saat sandi berubah (Profil dan jalur lain); prop Edit memuat info akun.
- Tahap 2: unggah, ganti (berkas lama terhapus), hapus; tipe/ukuran ditolak; aksesor dan cadangan foto Pegawai.
- Tahap 3: daftar hanya sesi milik user dan penanda sesi berjalan; cabut satu/semua dengan sandi benar; sandi salah ditolak; tidak bisa mencabut sesi milik orang lain atau sesi berjalan.
- Tahap 4: event mengisi `login_logs`; pemangkasan > 90 hari; `ActivityFeed` menggabung, mengurutkan, memfilter, dan memaginasi; entri pekerjaan hanya milik user.

## 7. Risiko

- IP di belakang proxy: ditangani di tahap 3 dengan verifikasi eksplisit.
- Tabel `login_logs` tumbuh: dibatasi pemangkasan 90 hari.
- Menggabung riwayat di PHP: terbatas oleh `page × 15` per sumber; cukup untuk skala aplikasi ini.
- Hook `password_changed_at` di model: diuji agar tidak terisi saat sandi tidak berubah.
