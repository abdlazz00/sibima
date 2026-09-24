# SIMASET — Sistem Informasi Manajemen Aset Kecamatan Sagulung

## Ringkasan

SIMASET mengelola seluruh aset milik Kecamatan Sagulung beserta kelurahan-kelurahan
di bawahnya: pencatatan aset, penerimaan aset baru, mutasi aset lintas unit,
pengajuan kebutuhan aset (oleh pegawai maupun kelurahan), dan pelaporan aset
rusak/hilang. Sistem mengikuti kaidah pencatatan Barang Milik Daerah (BMD) agar
selaras dengan format pelaporan pemerintah (kode barang, kategori hierarkis).

Tujuan utama: satu sumber kebenaran untuk status & lokasi aset, dengan alur
persetujuan berjenjang yang jelas per jenis transaksi, dan jejak audit lengkap
setiap perubahan kondisi/kepemilikan aset.

## Peran (Roles)

| Role | Scope | Tanggung jawab utama |
|---|---|---|
| Kasubag | Kecamatan (global) | Admin sistem (kelola user, master data) + verifikasi awal pada sebagian alur approval |
| Camat | Kecamatan | Approve penerimaan aset & mutasi aset di level kecamatan |
| Admin Aset Kecamatan | Kecamatan | Input aset masuk, ajukan mutasi aset ke/dari kelurahan |
| Admin Aset Kelurahan | Kelurahan (unit sendiri) | Sama seperti admin kecamatan, scope hanya kelurahannya |
| Lurah | Kelurahan (unit sendiri) | Approve mutasi aset masuk/keluar kelurahannya |
| Pegawai | Unit tempat bertugas (kecamatan/kelurahan) | Ajukan kebutuhan aset untuk diri sendiri, lapor aset rusak/hilang |

Semua role punya akun login sendiri. Admin Kelurahan dan Lurah dibatasi (via
Laravel Policy) hanya bisa mengakses data milik unit mereka sendiri.

## Arsitektur & Stack

**Backend**
- Laravel (versi stabil terbaru), PHP 8.3+, MySQL.
- `spatie/laravel-permission` untuk role & permission.
- **Struktur folder** (default Laravel + Service/Repository pattern, controller tipis):
  - `app/Http/Controllers` — orkestrasi saja: panggil Form Request untuk validasi, panggil Service, kembalikan Inertia response.
  - `app/Http/Requests` — satu FormRequest per aksi, validasi & otorisasi dasar terpisah dari controller.
  - `app/Services` — logic bisnis (mis. `AssetService`, `ApprovalWorkflowService`, `MutasiService`). Workflow engine (step progression, efek transaksi, trigger notifikasi) hidup di sini.
  - `app/Repositories` — data access layer (interface + implementasi Eloquent), dipanggil dari Service, bukan langsung dari Controller.
  - `app/Models`, `app/Policies` (otorisasi scoping per unit).
- **Queue & Scheduler:** efek transaksi workflow & notifikasi in-app dijalankan lewat event/listener yang di-queue (`database` driver cukup untuk skala ini); Supervisor di VPS menjalankan queue worker, cron menjalankan `schedule:run` tiap menit.
- **Testing:** Pest, feature test per alur approval + unit test untuk Service/workflow engine.
- **Code style:** Laravel Pint (default config).
- **Auth:** Session-based (Laravel Breeze/Fortify), satu akun per user termasuk Pegawai.
- **File storage:** Laravel filesystem (local/S3) untuk multi-foto aset & lampiran laporan.
- **QR/Barcode:** kode unik per aset, discan lewat kamera browser (tanpa app native) untuk pencarian cepat & opname/stock-take.
- **Cetak PDF (MVP):** hanya label aset (QR/barcode + info ringkas) untuk ditempel fisik. Berita Acara Serah Terima & form KIB di luar scope MVP.
- **Notifikasi:** Laravel Notifications, channel database (in-app), scoped ke role & unit yang relevan sebagai approver berikutnya.

**Frontend**
- Inertia.js + React + TypeScript.
- Tailwind CSS + **Preline UI** untuk komponen (tabel, form, modal, dropdown, dll). Preline berbasis class Tailwind + JS plugin (bukan komponen React native), sehingga perlu re-init (`window.HSStaticMethods.autoInit()`) pada event `router.on('navigate')` Inertia supaya komponen interaktif tetap berfungsi setelah page transition.
- Struktur `resources/js/`: `Pages/` (per fitur: Aset, Mutasi, Pengajuan, Laporan), `Components/` (reusable UI), `Layouts/`.
- Package manager: npm.
- Code style: ESLint + Prettier (default config) untuk TS/React.

**Dev Environment**
- Laragon (native, tanpa Docker) — PHP + MySQL lokal langsung di Windows.

**Deployment**
- VPS sendiri: Nginx + PHP-FPM, Supervisor untuk queue worker, cron untuk Laravel Scheduler.

## Struktur Organisasi & User

- `units` — tabel tunggal untuk Kecamatan & Kelurahan: kolom `type` (kecamatan/kelurahan),
  `parent_id` (kelurahan punya parent = kecamatan). Struktur hierarkis ini
  memudahkan ekspansi ke kecamatan lain di masa depan bila diperlukan.
- `users` — satu tabel untuk semua role, terhubung ke `unit_id`. Kasubag scope
  kecamatan/global (tidak terikat satu kelurahan).
- `employees`/pegawai memakai tabel `users` yang sama dengan role `pegawai`,
  terhubung ke `unit_id` tempat dia bertugas — dipakai sebagai konteks default
  saat pengajuan aset & lapor rusak/hilang.
- Otorisasi lintas unit ditegakkan di level Policy (bukan hanya UI): admin/lurah
  kelurahan yang mencoba mengakses data unit lain mendapat 403.

## Data Model — Aset

- `asset_categories` — kategori aset hierarkis mengikuti kode barang BMD
  (Bidang → Kelompok → Sub Kelompok → Sub-sub Kelompok).
- `assets` — data inti aset:
  - `kode_barang` (kode BMD hierarkis) + `nomor_register` (urut per kategori per unit)
  - `nama_aset`, `category_id`, `unit_id` (lokasi/pemilik saat ini), `current_holder_id` (pegawai pemegang, nullable)
  - `kondisi` (baik / rusak ringan / rusak berat / hilang)
  - `status` (aktif / dalam_proses_mutasi / dsb — dipakai untuk mengunci aset saat sedang diproses transaksi)
  - `tahun_perolehan`, `sumber_perolehan`, `nilai_perolehan`, `keterangan`
- `asset_photos` — polymorphic multi-foto (`photoable_type`/`photoable_id`),
  dipakai untuk foto aset maupun lampiran laporan rusak/hilang.
- `asset_histories` — log setiap perubahan kondisi/lokasi/pemegang aset, ditulis
  otomatis oleh efek transaksi approval — dasar tampilan "riwayat aset".

## Generic Approval Workflow Engine

- `workflow_definitions` — definisi urutan step approval per jenis transaksi
  (`penerimaan_aset`, `mutasi_kec_ke_kel`, `mutasi_antar_kel`, `retur_kel_ke_kec`,
  `mutasi_internal`, `pengajuan_pegawai`, `pengajuan_kelurahan`).
- `workflow_steps` (definisi) — tiap definisi punya list step berurutan: role
  apa yang approve/verifikasi di step ke-berapa, dan scope unit mana (unit asal/
  unit tujuan) yang relevan untuk step tersebut.
- `approval_requests` — instance transaksi berjalan, polymorphic ke model
  transaksi asli (mis. `AssetIntake`, `AssetMutation`, `AssetRequest`), plus
  `workflow_definition_id`, `current_step`, `status`
  (diajukan / berjalan / disetujui / ditolak).
- `approval_actions` — log tiap aksi approve/reject per step: siapa, kapan,
  catatan/alasan (wajib diisi saat reject).
- **Efek transaksi event-driven:** begitu step terakhir disetujui, sistem
  memicu event yang mengeksekusi efek nyata (pindahkan `unit_id`/`current_holder_id`
  di `assets`, tulis `asset_histories`). Efek transaksi konsisten dari manapun
  approval-nya di-trigger, tidak ditulis langsung di controller.
- **Notifikasi:** setiap `approval_requests` pindah step, user dengan role
  approver step berikutnya (di-scope ke unit yang relevan) menerima notifikasi in-app.

## Modul & Alur Transaksi

### a. Penerimaan Aset
Admin Kecamatan input → Kasubag verifikasi → Camat approve → aset aktif tercatat di kecamatan.

### b. Mutasi Kecamatan → Kelurahan
Admin Kecamatan ajukan → Kasubag verifikasi → Camat approve (keluar) →
Admin Kelurahan tujuan verifikasi → Lurah tujuan approve (masuk) →
`unit_id` aset pindah ke kelurahan tujuan.

### c. Mutasi antar Kelurahan
Admin Kelurahan asal ajukan → Lurah asal approve (keluar) →
Admin Kelurahan tujuan verifikasi → Lurah tujuan approve (masuk).

### d. Retur Kelurahan → Kecamatan
Admin Kelurahan ajukan → Lurah approve (keluar) →
Admin Kecamatan verifikasi → Kasubag verifikasi → Camat approve (masuk kembali ke kecamatan).

### e. Mutasi Internal (dalam 1 unit yang sama)
Admin unit ajukan → atasan unit (Camat untuk kecamatan / Lurah untuk kelurahan)
approve → langsung update lokasi/pemegang aset, tanpa lintas unit.

### f. Pengajuan Aset Pegawai
Pegawai ajukan → Admin unit review kelengkapan → atasan unit (Camat/Lurah sesuai
unit pegawai) approve → jika stok/aset tersedia, otomatis berlanjut sebagai
Mutasi Internal (alokasi aset ke `current_holder_id` = pegawai tsb).
Validasi ketersediaan aset diulang saat approval final (bukan hanya saat submit)
untuk menghindari race condition dua pengajuan rebutan aset yang sama.

### g. Pengajuan Aset Kelurahan → Kecamatan
Admin/Lurah Kelurahan ajukan kebutuhan → Camat approve → berlanjut sebagai
proses Mutasi Kecamatan → Kelurahan (alur b) untuk aset yang dipenuhi.

### h. Lapor Aset Rusak/Hilang
Pegawai lapor (dengan multi-foto) → Admin unit terkait verifikasi → `kondisi`
aset diupdate (rusak ringan/berat/hilang). Tidak ada approval berjenjang lebih
lanjut pada MVP — proses penghapusan pembukuan (write-off) di luar scope MVP.

### i. Modul Pendukung
- **Scan QR/barcode** (kamera browser) — cari aset cepat & opname/stock-take.
- **Cetak label aset** (MVP) — PDF label berisi QR/barcode + info ringkas aset, untuk ditempel fisik.
- **Dashboard & laporan** — rekap jumlah aset per kelurahan/kategori/kondisi, filter & export Excel.
- **Notifikasi in-app** — approval pending per role, scoped ke unit relevan.

## Error Handling & Edge Case

- **Reject di step manapun** → `approval_requests.status = ditolak`, transaksi
  berhenti tanpa efek ke `assets`, pengaju dapat notifikasi + alasan penolakan
  (wajib diisi approver).
- **Race condition stok aset** — divalidasi ulang saat approval final, bukan
  hanya saat submit; jika aset sudah tidak tersedia, approval gagal dengan pesan jelas.
- **Aset sedang dalam proses transaksi** → dikunci (`status = dalam_proses_mutasi`)
  sehingga tidak bisa diajukan ke transaksi lain secara bersamaan.
- **Otorisasi lintas unit** → Policy menolak akses (403) bila admin/lurah
  kelurahan mencoba mengakses data unit lain.

## Testing Approach

- Pest sebagai testing framework.
- Feature test per alur approval (a–h): submit → tiap step approve/reject →
  efek akhir ke `assets`/`asset_histories` benar.
- Policy test untuk scoping akses per role & per unit.
- Unit test untuk workflow engine (step progression, trigger notifikasi, event efek transaksi) di layer Service.

## Di Luar Scope MVP

- Cetak Berita Acara Serah Terima & form KIB (A–F) sebagai PDF.
- Proses penghapusan/pemusnahan aset (write-off) berjenjang.
- Integrasi langsung/ekspor otomatis ke SIMDA-BMD atau SIPD.
