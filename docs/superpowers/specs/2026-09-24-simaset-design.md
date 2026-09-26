# SIMASET — Sistem Informasi Manajemen Aset Kecamatan Sagulung

> **Revisi 2026-09-26:** Pegawai tidak lagi punya akun login — pegawai kini
> murni data (lihat "Data Model — Pegawai"). Request aset dan lapor
> rusak/hilang diajukan oleh admin kecamatan/kelurahan atas nama pegawai
> (dari form kertas yang diserahkan pegawai), bukan oleh pegawai sendiri.
> Alur f/g/h diganti model approval satu langkah tersendiri (lihat "Data
> Model — Request & Laporan Aset"), lepas dari Generic Approval Workflow
> Engine yang tetap dipakai untuk alur a–e.

## Ringkasan

SIMASET mengelola seluruh aset milik Kecamatan Sagulung beserta kelurahan-kelurahan
di bawahnya: pencatatan aset, penerimaan aset baru, mutasi aset lintas unit,
pengajuan kebutuhan aset (oleh admin atas nama pegawai maupun atas nama
kelurahan), dan pelaporan aset rusak/hilang (oleh admin atas nama pegawai
pemegang aset). Sistem mengikuti kaidah pencatatan Barang Milik Daerah (BMD) agar
selaras dengan format pelaporan pemerintah (kode barang, kategori hierarkis).

Tujuan utama: satu sumber kebenaran untuk status & lokasi aset, dengan alur
persetujuan berjenjang yang jelas per jenis transaksi, dan jejak audit lengkap
setiap perubahan kondisi/kepemilikan aset.

## Peran (Roles)

| Role | Scope | Tanggung jawab utama |
|---|---|---|
| Kasubag | Kecamatan (global) | Admin sistem (kelola user & pegawai, master data) + verifikasi awal pada sebagian alur approval + approve request aset kelurahan→kecamatan |
| Camat | Kecamatan | Approve penerimaan aset & mutasi aset di level kecamatan; approve request aset & lapor rusak/hilang untuk pegawai di kecamatan |
| Admin Aset Kecamatan | Kecamatan | Input aset masuk, ajukan mutasi aset ke/dari kelurahan, input request aset & lapor rusak/hilang atas nama pegawai kecamatan |
| Admin Aset Kelurahan | Kelurahan (unit sendiri) | Sama seperti admin kecamatan, scope hanya kelurahannya; juga ajukan request aset kelurahan→kecamatan |
| Lurah | Kelurahan (unit sendiri) | Approve mutasi aset masuk/keluar kelurahannya; approve request aset & lapor rusak/hilang untuk pegawai kelurahannya |

Kelima role di atas punya akun login. **Pegawai bukan role login** — pegawai
adalah data pemegang aset saja (lihat "Data Model — Pegawai"). Admin
Kelurahan dan Lurah dibatasi (via Laravel Policy) hanya bisa mengakses data
milik unit mereka sendiri.

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
- **Auth:** Session-based (Laravel Breeze/Fortify), satu akun per user login (Pegawai tidak punya akun kecuali lewat "create user dari pegawai").
- **File storage:** Laravel filesystem (local/S3) untuk multi-foto aset & lampiran laporan.
- **QR/Barcode:** kode unik per aset, discan lewat kamera browser (tanpa app native) untuk pencarian cepat & opname/stock-take.
- **Cetak PDF (MVP):** hanya label aset (QR/barcode + info ringkas) untuk ditempel fisik. Berita Acara Serah Terima & form KIB di luar scope MVP.
- **Notifikasi:** Laravel Notifications, channel database (in-app), scoped ke role & unit yang relevan sebagai approver berikutnya.

**Frontend**
- Inertia.js + React + TypeScript.
- Tailwind CSS + **Preline UI** untuk komponen (tabel, form, modal, dropdown, dll). Preline berbasis class Tailwind + JS plugin (bukan komponen React native), sehingga perlu re-init (`window.HSStaticMethods.autoInit()`) pada event `router.on('navigate')` Inertia supaya komponen interaktif tetap berfungsi setelah page transition.
- Struktur `resources/js/`: `Pages/` (per fitur: Aset, Mutasi, Pegawai, Request, Laporan), `Components/` (reusable UI), `Layouts/`.
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
- `users` — satu tabel untuk role login (`kasubag`, `camat`, `admin_kecamatan`,
  `admin_kelurahan`, `lurah`), terhubung ke `unit_id`. Kasubag scope
  kecamatan/global (tidak terikat satu kelurahan).
  - **Login:** setiap akun wajib punya `email` unik, diisi manual saat provisioning
    (bukan digenerate otomatis oleh sistem) — dipakai juga untuk fitur mendatang seperti
    reset password & notifikasi email.
- Otorisasi lintas unit ditegakkan di level Policy (bukan hanya UI): admin/lurah
  kelurahan yang mencoba mengakses data unit lain mendapat 403.

## Data Model — Pegawai

Pegawai **tidak** memakai tabel `users` dan tidak bisa login — pegawai adalah
data pemegang aset dan sumber form request/lapor yang diinput admin, terpisah
total dari akun sistem.

- `pegawais` — field hasil peninjauan data kepegawaian riil
  (`docs/ABSENN STAF PNS DAN PPPK.xlsx`): `nama`, `nip` (nullable),
  `pangkat_golongan` (nullable), `jabatan` (teks bebas, boleh memuat info
  seksi/subbag mis. "Kasi Trantib Kelurahan Sei Lekop" — seksi/subbag **tidak**
  dimodelkan sebagai level unit terpisah karena lokasi aset di data riil tidak
  dipecah sampai granularitas seksi), `status_kepegawaian` (enum `pns`/`pppk`),
  `unit_id` (FK `units`, unit tempat bertugas), `foto_profile` (path, nullable),
  `user_id` (FK `users`, **nullable** — lihat "create user dari pegawai").
- **Create user dari pegawai:** aksi di halaman kelola pegawai untuk memberi
  pegawai tertentu akses login — kasubag/camat/lurah pilih role + isi
  email/password, sistem membuat baris `users` baru dan mengisi
  `pegawais.user_id`. Bukan setiap pegawai perlu jalur ini; defaultnya pegawai
  tidak punya akun sama sekali.
- Dipakai sebagai `current_holder_id` pada `assets`/`asset_histories` (lihat
  bagian berikut), dan sebagai target pada `asset_requests`/`asset_reports`.

## Data Model — Aset

> Disesuaikan hasil peninjauan data master aset riil client
> (`docs/PHOTO BARANG.xlsx`, sheet "DATA MASTER", 292 baris aset).

- `asset_categories` — kategori aset **2 level flat**: Kategori (mis. "ALAT RUMAH TANGGA")
  → Subkategori (mis. "ALAT PENDINGIN"). Disederhanakan dari rencana awal 4 level
  BMD (Bidang → Kelompok → Sub Kelompok → Sub-sub Kelompok) karena data riil client
  cuma pakai 2 level ini. `kode_barang` pada `assets` tetap memakai format kode BMD
  lengkap (mis. `1.3.2.05.02.04.004`), tapi disimpan sebagai satu string utuh per
  jenis aset — bukan disusun/diturunkan dari relasi kategori berjenjang.
- `assets` — data inti aset:
  - `kode_barang` (kode BMD, string utuh per jenis aset) + `nomor_register` (digenerate
    sistem, urut per kategori per unit — identitas unik per unit fisik aset ke depan)
  - `nama_aset`, `category_id`, `unit_id` (lokasi/pemilik saat ini), `current_holder_id`
    (FK **`pegawais`**, bukan `users` — pegawai pemegang, nullable)
  - `merk_type` — merek/tipe aset (mis. "PANASONIC")
  - `kondisi` (baik / rusak ringan / rusak berat / hilang)
  - `status` (aktif / dalam_proses_mutasi / dsb — dipakai untuk mengunci aset saat sedang diproses transaksi)
  - `tanggal_perolehan` (tanggal lengkap, bukan sekadar tahun — data riil punya tanggal lengkap)
  - `sumber_perolehan`, `nilai_perolehan`, `nilai_buku` (nilai aset setelah penyusutan, terpisah dari `nilai_perolehan`)
  - `no_dokumen` — nomor dokumen pengadaan/mutasi dari data lama (mis. `M#GW04A268636-378-2023-0001`),
    disimpan sebagai field referensi historis/audit — **bukan** identitas utama unit fisik
    (identitas utama tetap `nomor_register` yang digenerate sistem)
  - `keterangan`
- `asset_photos` — polymorphic multi-foto (`photoable_type`/`photoable_id`),
  dipakai untuk foto aset maupun lampiran laporan rusak/hilang.
- `asset_histories` — log setiap perubahan kondisi/lokasi/pemegang aset, ditulis
  otomatis oleh efek transaksi approval — dasar tampilan "riwayat aset".
  `current_holder_id` di sini juga FK ke `pegawais`.

## Data Model — Request & Laporan Aset

Dua tabel dengan approval **satu langkah** (bukan lewat Generic Approval
Workflow Engine di bawah — chain multi-step engine itu berlebihan untuk kasus
yang cuma butuh satu approver).

- `asset_requests` — menangani dua jenis request sekaligus lewat kolom `type`:
  - `type`: enum `pegawai` (request aset untuk pegawai tertentu) / `unit`
    (request kelurahan → kecamatan).
  - `pegawai_id` (FK `pegawais`, nullable — wajib diisi kalau `type = pegawai`).
  - `requesting_unit_id` (FK `units` — unit admin yang mengajukan).
  - `category_id` (FK `asset_categories`, subkategori aset yang dibutuhkan).
  - `keterangan` (teks — alasan/detail dari form kertas).
  - `status`: `pending` → `approved`/`rejected` → `fulfilled`.
  - `approved_by` (FK `users`), `approved_at`, `rejected_reason`.
  - `fulfilled_asset_id` (FK `assets`, diisi manual admin saat serah terima),
    `fulfilled_by` (FK `users`), `fulfilled_at`.
  - `created_by` (FK `users` — admin yang input).
  - **Routing approval:** `type = pegawai` → camat (pegawai di kecamatan) atau
    lurah (pegawai di kelurahan), ditentukan dari `pegawais.unit_id`.
    `type = unit` → selalu kasubag.
  - **Efek fulfill:** untuk `type = pegawai`, `assets.current_holder_id` diisi
    aset yang dipilih; untuk `type = unit`, `assets.unit_id` dipindah ke
    `requesting_unit_id`. Keduanya menulis `asset_histories`. Fulfill hanya
    valid dari status `approved` (state salah → exception, pola sama seperti
    guard di model `Unit`/`Asset`).
- `asset_reports` — lapor aset rusak/hilang:
  - `asset_id` (FK `assets`), `pegawai_id` (FK `pegawais` — pemegang aset saat
    lapor, dicatat eksplisit agar histori tetap benar meski pemegang berubah
    kemudian).
  - `type`: enum `rusak` / `hilang`.
  - `kondisi_baru`: diisi kalau `type = rusak` (`rusak_ringan`/`rusak_berat`,
    memakai enum `Kondisi` yang sudah ada); kalau `type = hilang`, otomatis
    memetakan ke `Kondisi::Hilang` — tidak perlu enum status baru.
  - `kronologi` (teks, wajib — penjelasan kerusakan/kronologi kehilangan).
  - Foto: memakai relasi polymorphic `asset_photos` (`photoable`) yang sudah
    ada, ditempelkan ke `AssetReport` — tidak ada tabel foto baru.
  - `status`: `pending` → `approved`/`rejected`.
  - `approved_by`, `approved_at`, `rejected_reason`, `created_by`.
  - **Routing approval:** sama seperti request pegawai — camat/lurah berdasarkan
    unit aset/pegawai.
  - **Efek approval:** otomatis, tanpa input manual tambahan — `assets.kondisi`
    ter-update sesuai `type`/`kondisi_baru`, dan `asset_histories` tercatat.

## Generic Approval Workflow Engine

Lingkup engine ini **hanya alur a–e** (institusional: penerimaan & mutasi
antar unit). Alur f/g (request) dan h (lapor rusak/hilang) memakai
`asset_requests`/`asset_reports` di atas, bukan engine ini — approval-nya
cuma satu langkah sehingga generic multi-step engine tidak diperlukan.

- `workflow_definitions` — definisi urutan step approval per jenis transaksi
  (`penerimaan_aset`, `mutasi_kec_ke_kel`, `mutasi_antar_kel`, `retur_kel_ke_kec`,
  `mutasi_internal`).
- `workflow_steps` (definisi) — tiap definisi punya list step berurutan: role
  apa yang approve/verifikasi di step ke-berapa, dan scope unit mana (unit asal/
  unit tujuan) yang relevan untuk step tersebut.
- `approval_requests` — instance transaksi berjalan, polymorphic ke model
  transaksi asli (mis. `AssetIntake`, `AssetMutation`), plus
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

### f. Request Aset Pegawai
Pegawai isi form kertas → Admin unit (kecamatan/kelurahan tempat pegawai
bertugas) input jadi `asset_requests` (`type = pegawai`) → atasan unit
(Camat/Lurah sesuai `pegawais.unit_id`) approve/reject → kalau approved,
admin unit input manual aset mana yang diserahkan (`fulfilled_asset_id`) →
`assets.current_holder_id` diisi pegawai tsb, `asset_histories` tercatat.

### g. Request Aset Kelurahan → Kecamatan
Admin Kelurahan input `asset_requests` (`type = unit`) → Kasubag approve/reject
→ kalau approved, admin kecamatan input manual aset mana yang dikirim
(`fulfilled_asset_id`) → `assets.unit_id` pindah ke kelurahan peminta,
`asset_histories` tercatat.

### h. Lapor Aset Rusak/Hilang
Pegawai lapor ke admin unit (dengan kronologi + multi-foto dari kertas/HP
pegawai) → Admin unit input jadi `asset_reports` → atasan unit (Camat/Lurah
sesuai unit aset/pegawai) approve/reject → kalau approved, `assets.kondisi`
ter-update **otomatis** (rusak ringan/berat/hilang) tanpa input manual
tambahan, `asset_histories` tercatat. Proses penghapusan pembukuan
(write-off) di luar scope MVP.

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
- **State salah pada `asset_requests`/`asset_reports`** (mis. `fulfill`
  dipanggil bukan dari status `approved`, atau approve dua kali) → exception,
  pola sama seperti guard di model `Unit`/`Asset`.

## Testing Approach

- Pest sebagai testing framework.
- Feature test per alur approval (a–e, via workflow engine): submit → tiap
  step approve/reject → efek akhir ke `assets`/`asset_histories` benar.
- Feature test per alur f/g/h (`asset_requests`/`asset_reports`): submit →
  approve/reject → (f/g) fulfill manual → efek akhir ke `assets`/`asset_histories`
  benar; kasus reject tidak menyentuh `assets`.
- Policy test untuk scoping akses per role & per unit, termasuk siapa boleh
  approve `asset_requests`/`asset_reports` sesuai routing (camat/lurah/kasubag).
- Unit test untuk workflow engine (step progression, trigger notifikasi, event efek transaksi) di layer Service.

## Di Luar Scope MVP

- Cetak Berita Acara Serah Terima & form KIB (A–F) sebagai PDF.
- Proses penghapusan/pemusnahan aset (write-off) berjenjang.
- Integrasi langsung/ekspor otomatis ke SIMDA-BMD atau SIPD.
