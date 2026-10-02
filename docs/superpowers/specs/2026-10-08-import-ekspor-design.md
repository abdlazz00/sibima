# Desain: Import & Ekspor Data (Aset, Pegawai, Kategori)

Status: Menunggu review.
Tanggal: 2026-10-08

Fitur import Excel lewat UI (dengan pratinjau, antrean, riwayat) dan ekspor Excel untuk tiga modul master: Data Aset, Pegawai, Kategori Aset. Menggantikan `AssetExcelSeeder` sebagai jalur data awal go-live (Sprint 5).

---

## 1. Konteks & Tujuan

Saat ini tidak ada import/ekspor di ketiga modul. Data awal dimasukkan lewat `AssetExcelSeeder` (CLI, destruktif, tanpa pratinjau, tanpa riwayat aset). Data baru berikutnya hanya bisa diinput satu per satu.

Tujuan:
1. Import massal lewat halaman web untuk migrasi awal **dan** pemakaian rutin.
2. Pratinjau (dry-run) sebelum data ditulis; baris bermasalah dilaporkan, tidak menggagalkan seluruh berkas.
3. Pemrosesan lewat antrean agar berkas hingga ±10.000 baris aman.
4. Jejak audit: siapa mengimpor apa, kapan, berapa baris.
5. Ekspor dengan kolom identik template import (round-trip, backup).
6. Otorisasi berbasis permission bernama, bukan nama role, agar siap untuk RBAC dinamis berikutnya.

Di luar cakupan: foto aset, akun login pegawai, pembaruan massal data yang sudah ada (upsert), ekspor lewat antrean, ekspor berkop (sudah tercakup Laporan Aset/Mutasi/Rusak-Hilang).

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Pemakaian | Migrasi awal + rutin, lewat halaman web (bukan CLI). |
| Duplikat | Dilewati dan dilaporkan; import hanya menambah. |
| Baris error | Baris valid tetap diimpor; baris error dilaporkan dan bisa diunduh sebagai Excel untuk diperbaiki. |
| Template | Template baru per modul, sheet tunggal; kolom sama dengan ekspor. Tidak membaca langsung format `MASTER_ASET` client. |
| Referensi tak dikenal | Kategori/subkategori dan pegawai tidak dibuat otomatis dari import aset; baris ditolak. Urutan kerja: kategori, pegawai, aset. |
| Unit | Dari kolom Unit di Excel, divalidasi terhadap cakupan akun pengimpor (`accessibleUnitIds()`). |
| Otorisasi | Permission Spatie bernama (`import-*`, `export-*`); tidak dibatasi per role di kode. |
| Ukuran | Sampai ±10.000 baris dan 5 MB, diproses lewat antrean database. |
| Riwayat | Tabel `import_batches` dengan laporan error, tampil di UI per modul. |
| Ekspor | Sinkron, kolom sama dengan template, mengikuti filter dan cakupan aktif, batas 10.000 baris. |
| `No. Dokumen` aset | Tetap unik seperti form manual; bentrok = error baris. |
| Aset tanpa No. Register | Diterima dan dibuatkan nomor baru; pratinjau memberi peringatan bahwa unggah ulang akan menggandakan. |
| Library | PhpSpreadsheet langsung (tanpa `maatwebsite/excel`). |

---

## 3. Arsitektur

Pendekatan: satu mesin import generik + satu kelas importer per modul (mengikuti pola mesin approval generik).

### 3.1 Tabel `import_batches`

`id`, `modul` (`kategori` | `pegawai` | `aset`), `user_id`, `nama_berkas`, `path` (berkas unggahan, disk privat), `path_hasil` (hasil validasi), `path_error` (laporan error), `status` (`memeriksa` | `siap` | `memproses` | `selesai` | `gagal` | `kedaluwarsa`), `total_baris`, `jumlah_baru`, `jumlah_duplikat`, `jumlah_error`, `jumlah_masuk` (baris yang benar-benar tertulis), `progres` (baris terproses), `pesan` (pesan gagal ramah pengguna), timestamps.

Hasil validasi per baris disimpan di berkas (`path_hasil`), bukan kolom, agar tabel ringan.

### 3.2 Job antrean

1. `ValidateImportJob`: membaca berkas per chunk (500 baris), memvalidasi tiap baris lewat importer modulnya tanpa menulis ke tabel data, menulis hasil, mengisi jumlah, lalu status `siap`.
2. `CommitImportJob`: dijalankan setelah konfirmasi. Memvalidasi ulang tiap baris (data bisa berubah sejak pratinjau), menulis baris valid per chunk dalam satu transaksi per chunk, memperbarui `progres`, lalu status `selesai`.

Pembacaan Excel: `IOFactory` + `ReadFilter` per chunk + `setReadDataOnly(true)` agar memori terkendali (berkas besar pernah menghabiskan 128 MB).

### 3.3 Kontrak importer (satu kelas per modul)

- daftar kolom dan header template;
- `validasi(array $baris, ImportContext $ctx): RowResult` (valid / duplikat / error beserta kolom dan alasan);
- `kunciDuplikat(array $baris): string`;
- `simpan(array $baris, User $actor): void`;
- nama permission impor/ekspor.

Mesin tidak mengetahui apa pun tentang aset atau pegawai. Aturan validasi memakai ulang aturan form manual (`StoreAssetRequest`, `PegawaiRequest`, `AssetCategoryRequest`) sehingga hasil import tidak bisa lebih longgar daripada input manual.

### 3.4 Otorisasi

- Permission: `import-kategori`, `import-pegawai`, `import-aset`, `export-kategori`, `export-pegawai`, `export-aset`. Dibuat oleh seeder.
- Saat ini diberikan ke role yang sudah boleh membuat/melihat modul terkait; pemetaan ke role dikumpulkan di satu tempat (seeder) agar RBAC dinamis cukup mengubah penugasan.
- Cakupan unit dicek per baris lewat `accessibleUnitIds()` (bukan soal role; aturan data yang sama dengan halaman lain). Baris dengan unit di luar cakupan = error.
- Riwayat dibatasi ke batch milik pengguna atau yang unitnya dalam cakupan.

### 3.5 Kedaluwarsa

Scheduled command harian: batch `siap` lebih dari 7 hari dihapus berkas unggahan dan hasilnya, status `kedaluwarsa`. Bergantung pada cron `schedule:run` (sudah dalam rencana Sprint 5). Queue worker juga harus berjalan (Supervisor di produksi, `php artisan queue:work` di dev).

---

## 4. Template, Validasi, dan Kunci Duplikat

Pencocokan teks (nama kategori, unit, kondisi) tidak peka huruf besar-kecil dan mengabaikan spasi di ujung. Tiap template berisi header baku, baris contoh, dan sheet "Petunjuk".

### 4.1 Kategori (khusus kasubag)

| Kolom | Wajib | Catatan |
|---|---|---|
| Kategori | ya | Kategori utama |
| Kode Kategori | tidak | |
| Subkategori | tidak | Kosong = baris mendefinisikan kategori utama saja |
| Kode Subkategori | tidak | Format kode aset |
| Keterangan | tidak | |

Kunci duplikat: pasangan (Kategori, Subkategori), atau Kategori saja bila subkategori kosong (selaras aturan unik `parent_id + name`). Kategori utama yang belum ada dibuat otomatis dari baris subkategorinya.

### 4.2 Pegawai

| Kolom | Wajib | Catatan |
|---|---|---|
| Nama | ya | |
| NIP | tidak | |
| Pangkat/Golongan | tidak | |
| Jabatan | ya | |
| Status Kepegawaian | ya | `PNS` atau `PPPK` |
| Unit | ya | Nama unit persis seperti di sistem |
| No. HP, Email Dinas | tidak | |

Kunci duplikat: NIP bila terisi; bila kosong, pasangan (Nama, Unit). Duplikat juga dicek di dalam berkas yang sama. Foto profil dan akun login tidak diimpor.

### 4.3 Aset

| Kolom | Wajib | Catatan |
|---|---|---|
| Kode Barang | ya | Angka dipisah titik |
| No. Register | tidak | Terisi = dipakai apa adanya; kosong = nomor berikutnya dari sistem |
| Nama Aset | ya | |
| Kategori, Subkategori | ya | Harus sudah ada dan harus subkategori; tidak dibuat otomatis |
| Merk/Tipe | tidak | |
| Tanggal Perolehan | ya | Tanggal Excel asli atau teks `dd-mm-yyyy`; antara 1900 dan hari ini |
| Sumber Perolehan | tidak | |
| Harga Perolehan | ya | Angka |
| Nilai Buku | ya | Tidak boleh melebihi harga perolehan |
| Kondisi | ya | Baik, Rusak Ringan, Rusak Berat, Hilang |
| Unit | ya | Harus dalam cakupan pengimpor |
| Penanggung Jawab | tidak | Nama atau NIP pegawai di unit itu; tidak ketemu atau nama ganda = error |
| No. Dokumen | tidak | Unik seperti form manual |
| Keterangan | tidak | |

- Kunci duplikat: (Kode Barang, No. Register) hanya bila register terisi. Baris tanpa register tidak pernah dianggap duplikat; pratinjau memberi peringatan "N baris tanpa register akan dibuatkan nomor baru".
- Status aset selalu Aktif (`dalam_proses` hanya diatur sistem).
- Tiap aset yang diimpor mendapat riwayat `dibuat`, seperti input manual.
- Nomor register otomatis dibuat di dalam transaksi chunk dengan `maxRegisterNumber` yang sudah mengunci.
- Tidak diimpor: foto, QR (dibuat sistem), kolom rumus/lokasi/nomor seri template lama.

### 4.4 Ekspor

Kolom identik template, mengikuti filter dan cakupan unit aktif. Hasil ekspor yang diimpor ulang ke database kosong menghasilkan data yang sama (round-trip). Batas 10.000 baris; di atasnya pengguna diminta mempersempit filter (pesan jelas, bukan error 500).

---

## 5. UI

- Tombol "Unduh template", "Ekspor", "Impor" di halaman Data Aset, Pegawai, dan Kategori, tampil hanya bagi pemegang permission.
- Halaman generik `/import/{modul}` dengan tiga bagian:
  1. **Unggah**: `.xlsx`, maksimum 5 MB / 10.000 baris. Berkas terlalu besar atau header tidak cocok template ditolak langsung dengan pesan jelas.
  2. **Pratinjau** (setelah validasi selesai): kartu Baru / Sudah ada / Error; daftar 50 error pertama (baris Excel, kolom, alasan); peringatan; tombol "Unduh laporan error" (Excel berisi baris bermasalah + kolom Alasan) dan "Konfirmasi impor N baris" (tidak muncul bila baris baru nol).
  3. **Riwayat**: tabel batch modul itu (waktu, pengunggah, berkas, status, jumlah, tautan laporan error).
- Progres: saat `memeriksa`/`memproses`, halaman memuat ulang batch tiap 2 detik (Inertia partial reload), berhenti di `siap`/`selesai`/`gagal`.
- Mengikuti `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` (kartu rounded-lg tanpa bayangan, badge status, `tabular-nums`). Tidak menambah menu sidebar.

---

## 6. Penanganan Error

- Baris error tidak menghentikan batch; dicatat (baris, kolom, alasan) dan dilewati.
- Gagal sistem (berkas rusak, job crash): status `gagal` dengan pesan umum di UI; detail teknis hanya di log.
- Commit parsial: tiap chunk satu transaksi; bila job mati di tengah, chunk yang sudah masuk tetap ada, batch `gagal` dengan `jumlah_masuk`. Unggah ulang aman karena duplikat dilewati (untuk aset hanya bila register terisi).
- Baris yang berubah menjadi duplikat/tidak valid antara pratinjau dan konfirmasi dilewati dan dihitung sebagai error di hasil akhir.
- Konfirmasi hanya diterima bila status `siap`, dan peralihan ke `memproses` dilakukan dalam satu update atomik (klik ganda tidak menjalankan dua commit).

---

## 7. Pengujian

- Pest dengan antrean `sync`: tiap importer diuji lewat mesin (validasi per kolom, duplikat, duplikat dalam berkas, cakupan unit, kategori/pegawai tak dikenal, No. Dokumen bentrok, tanggal di luar batas).
- Mesin: alur unggah, validasi, `siap`, konfirmasi, `selesai`; konfirmasi ganda; validasi ulang saat commit; batas chunk (499/500/501 baris); kedaluwarsa; header salah; berkas melebihi batas; izin ditolak.
- Template dan ekspor: round-trip ekspor ke impor di database kosong; batas 10.000 baris.
- Frontend: `tsc` dan `npm run build`. Cek UI manual menunggu perintah pengguna.

---

## 8. Risiko & Catatan

- Queue worker wajib aktif; tanpa itu batch berhenti di `memeriksa`. Dicantumkan di checklist deploy Sprint 5.
- Aset tanpa No. Register tidak bisa dideduplikasi; mitigasinya peringatan pratinjau dan template yang menandai kolom itu sebagai disarankan.
- Pengganti `AssetExcelSeeder`: seeder dipensiunkan setelah import aset terbukti memuat data client (tidak dihapus dalam spec ini).
- Ekspor sinkron dibatasi 10.000 baris; penulis streaming ditunda sampai kebutuhan nyata.
- RBAC dinamis (berikutnya) hanya perlu mengubah penugasan permission; tidak ada perubahan pada importer.

---

## 9. Keputusan saat implementasi

Penyesuaian terhadap bagian di atas yang diputuskan saat menulis plan (`docs/superpowers/plans/2026-10-08-import-ekspor.md`):

- **Laporan error tidak disimpan** (`path_error` dihapus dari §3.1): dibuat saat diminta dari berkas hasil validasi.
- **Transaksi per baris, bukan per chunk** (§3.2): satu baris gagal tidak membatalkan baris lain; chunk hanya menentukan seberapa sering `progres` diperbarui.
- **Tombol "Unduh template" ada di halaman Impor**, bukan di halaman modul (§5): halaman modul hanya punya "Impor" dan "Ekspor".
- **Batch terlihat oleh pengunggahnya dan oleh akun dengan cakupan unit tanpa batas** (`accessibleUnitIds() === null`), bukan per unit batch (§3.4): batch tidak punya unit.
- **Permission dibagikan ke frontend** sebagai `auth.user.permissions`; tombol Impor/Ekspor memeriksa nama permission, bukan role.
- **Validasi unggahan memakai `extensions:xlsx`**, bukan `mimes`, karena deteksi MIME berkas xlsx kecil tidak konsisten; berkas yang bukan xlsx sungguhan ditolak oleh pembaca dengan pesan yang sama.
- **Interface `Importer` tidak dibuat**: `Importer` adalah kelas abstrak (satu hierarki, tiga turunan) yang juga memuat helper bersama.
- **Satu job `ProcessImportJob` dengan fase `validate`/`commit`**, bukan dua kelas job.
- **Antrean:** `retry_after` database dinaikkan ke 900 detik (> timeout job 600 detik); panduan setup di `docs/ops/queue-setup.md`.
