# SIMASET Sprint Plan

> **Revisi 2026-09-26:** Pegawai tidak lagi jadi role login (lihat spec).
> Alur f/g (pengajuan) dan h (lapor rusak/hilang) di Sprint 4 tidak lagi
> dibangun di atas generic workflow engine — detailnya sekarang di tiga
> implementation plan terpisah: `2026-09-26-pegawai-data.md`,
> `2026-09-26-asset-request.md`, `2026-09-26-asset-report.md`.

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md`

**Timeline:** 25 September 2026 – 10 Oktober 2026 (16 hari kalender), production-ready
termasuk import data existing di tanggal 10 Oktober 2026.

**Tim:** Solo developer. Tiap modul dikerjakan Backend dulu, baru Frontend
(bukan paralel).

**Scope:** Full scope sesuai spec — penerimaan aset, 4 jenis mutasi (via generic
workflow engine), data pegawai + create-user-dari-pegawai, request aset
(pegawai & kelurahan→kecamatan) dan lapor rusak/hilang (keduanya lewat model
approval satu langkah, bukan generic engine) + modul pendukung (QR scan, cetak
label, dashboard & laporan) + import data existing.

**Catatan branding:** Logo kecamatan dan nama aplikasi resmi belum diterima
dari client per tanggal spec ini ditulis. Frontend memakai placeholder
("SIMASET" sebagai nama kerja + ikon generik) mulai Sprint 1, dan di-swap
ke aset resmi begitu diterima (idealnya sebelum Sprint 5, kalau terlambat
masuk beban Sprint 5).

**Data import:** Data aset existing sudah tersedia dalam bentuk Excel/spreadsheet
dan siap dipakai — dikerjakan di Sprint 5.

## Risiko

- Tidak ada hari buffer eksplisit untuk bug/UAT feedback dari client di
  tengah jadwal — revisi besar di tengah jalan langsung menekan jadwal.
- Branding masih placeholder — swap ke aset resmi berpotensi masuk beban
  Sprint 5 kalau client terlambat mengirim.
- Solo dev — satu hari terhambat (sakit/urusan lain) langsung menggeser
  seluruh sprint di belakangnya.
- Scope penuh (5 alur transaksi lewat generic workflow engine + request aset +
  lapor rusak/hilang + modul pendukung) dikejar dalam 16 hari adalah keputusan
  sadar (client memilih kejar full scope, bukan MVP dipangkas) — kualitas
  testing per alur harus tetap dijaga sesuai Testing Approach di spec, jangan
  dikorbankan demi kecepatan.

---

## Sprint 1 — Fondasi (25–27 Sep, 3 hari)

**Backend:**
- Install Laravel, konfigurasi `.env` (MySQL, app name placeholder).
- Migration: `units` (type, parent_id), `users` (unit_id), tabel role/permission via `spatie/laravel-permission`.
- Seeder: unit Kecamatan Sagulung + kelurahan-kelurahan awal, satu user dummy per role login (kasubag, camat, admin_kecamatan, admin_kelurahan, lurah — pegawai bukan role login, datanya diseed terpisah di Sprint 2/3, lihat `2026-09-26-pegawai-data.md`).
- Auth: Laravel Breeze (session-based), scaffolding login/logout.
- `app/Policies` dasar: scoping akses per `unit_id` (skeleton, diisi detail penuh di sprint-sprint berikutnya seiring model transaksi ditambahkan).
- Setup Pest (testing) + Laravel Pint (code style).

**Frontend:**
- Scaffold Inertia.js + React + TypeScript.
- Integrasi Tailwind CSS + Preline UI, termasuk re-init `HSStaticMethods.autoInit()` di `router.on('navigate')`.
- Layout dasar: sidebar + navbar dengan placeholder branding ("SIMASET" + ikon generik).
- Halaman login.
- Dashboard shell kosong per role (nav item beda sesuai role, belum ada konten fungsional).
- Setup ESLint + Prettier.

**Deliverable:** Bisa login sebagai tiap role (kasubag/camat/admin_kecamatan/admin_kelurahan/lurah) dan melihat dashboard shell dengan navigasi sesuai hak akses masing-masing.

---

## Sprint 2 — Data Aset & Workflow Engine (28 Sep–1 Okt, 4 hari)

**Backend:**
- Migration & model: `asset_categories` (hierarki BMD: Bidang/Kelompok/Sub Kelompok/Sub-sub Kelompok), `assets`, `asset_photos` (polymorphic), `asset_histories`.
- Service/Repository untuk CRUD aset & kategori.
- Generate QR code unik per aset (kode_barang + nomor_register sebagai payload).
- Generate PDF label aset (QR + info ringkas) untuk dicetak.
- Generic workflow engine: migration & model `workflow_definitions`, `workflow_steps`, `approval_requests` (polymorphic), `approval_actions`.
- `ApprovalWorkflowService`: step progression, approve/reject, trigger event efek transaksi, trigger notifikasi. Diuji dengan transaksi dummy/stub (belum ada transaksi nyata).

**Frontend:**
- Halaman kelola kategori aset (list/create/edit, tampilan hierarkis).
- Halaman CRUD aset: list (filter kategori/unit/kondisi), detail, create/edit dengan upload multi-foto.
- Tombol/aksi cetak label QR per aset.
- Komponen **approval inbox generik** (daftar approval pending untuk user login, tombol approve/reject dengan catatan) — dibangun sekali, dipakai ulang di semua alur transaksi Sprint 3 & 4.

**Deliverable:** Admin (kecamatan/kelurahan sesuai scope) bisa kelola data aset lengkap dengan foto dan cetak label QR. Workflow engine berjalan & teruji lewat unit test terisolasi (belum terhubung ke transaksi bisnis nyata).

---

## Sprint 3 — Alur Penerimaan & Mutasi (2–5 Okt, 4 hari)

**Backend:**
- Definisikan `workflow_definitions` untuk 5 alur: `penerimaan_aset`, `mutasi_kec_ke_kel`, `mutasi_antar_kel`, `retur_kel_ke_kec`, `mutasi_internal` (step & role approver sesuai spec, termasuk verifikasi admin tujuan di alur b/c dan verifikasi admin kecamatan di alur d).
- Model & Service transaksi: `AssetIntake` (a), `AssetMutation` (b, c, d, e) — tiap submit membuat `approval_requests` sesuai definisi terkait.
- Listener efek transaksi: begitu step terakhir approved, update `assets.unit_id`/`current_holder_id`/`status`, tulis `asset_histories`.

**Frontend:**
- Form pengajuan: Penerimaan Aset, Mutasi Kec→Kel, Mutasi antar Kel, Retur Kel→Kec, Mutasi Internal.
- Halaman approval per role (reuse komponen approval inbox dari Sprint 2), menampilkan detail transaksi & step saat ini.
- Tab "Riwayat" di halaman detail aset, menampilkan `asset_histories`.

**Deliverable:** 5 alur transaksi utama (penerimaan + 4 jenis mutasi) berjalan end-to-end dari submit sampai efek transaksi tereksekusi, sesuai urutan approval di spec.

---

## Sprint 4 — Pegawai, Request, Laporan & Modul Pendukung (6–8 Okt, 3 hari)

> Alur f/g/h tidak lagi lewat `workflow_definitions`/generic engine — lihat
> revisi 2026-09-26. Implementasinya dipecah ke tiga plan terpisah, urutan
> eksekusi: `2026-09-26-pegawai-data.md` dulu (prasyarat), baru
> `2026-09-26-asset-request.md` dan `2026-09-26-asset-report.md` (keduanya
> independen satu sama lain, bisa paralel).

**Backend:**
- `2026-09-26-pegawai-data.md`: tabel `pegawais`, repoint `current_holder_id`
  ke `pegawais`, CRUD pegawai scoped per unit, create-user-dari-pegawai.
- `2026-09-26-asset-request.md`: tabel `asset_requests` (tipe pegawai & unit),
  approval satu langkah (camat/lurah untuk pegawai, kasubag untuk unit),
  fulfillment manual oleh admin.
- `2026-09-26-asset-report.md`: tabel `asset_reports` (rusak/hilang, multi-foto
  lewat `asset_photos` yang sudah ada), approval satu langkah (camat/lurah),
  efek approve otomatis update `assets.kondisi`.
- API scan QR: lookup aset by kode QR untuk pencarian cepat.
- Query dashboard: rekap jumlah aset per kelurahan/kategori/kondisi; endpoint export Excel.

**Frontend:**
- Halaman Pegawai (CRUD + tombol buat akun login) — dari plan Pegawai.
- Halaman Request Aset (form untuk pegawai/unit + approve/reject/fulfill) — dari plan Asset Request.
- Halaman Lapor Rusak/Hilang (form multi-foto + kronologi + approve/reject) — dari plan Asset Report.
- Halaman scan QR (akses kamera browser) → langsung ke detail aset.
- Dashboard: kartu rekap + tabel laporan dengan filter, tombol export Excel.

**Deliverable:** Data pegawai terkelola, request aset & lapor rusak/hilang berjalan end-to-end dari submit sampai efek ke aset, + modul pendukung (scan QR, dashboard, laporan) lengkap dan berfungsi.

---

## Sprint 5 — Import Data, Hardening & Go-Live (9–10 Okt, 2 hari)

**Backend:**
- Artisan command import data aset dari Excel: mapping kolom ke skema `assets`/`asset_categories`, mode dry-run dengan laporan baris error sebelum commit ke database.
- Jalankan import data real dari file Excel yang sudah disiapkan client.
- Provisioning VPS: Nginx + PHP-FPM, Supervisor (queue worker), cron (`schedule:run`), SSL.
- Deploy ke production, jalankan migration, seed user real (bukan dummy) per role & unit.

**Frontend:**
- Swap placeholder branding (nama aplikasi, logo) ke aset resmi begitu diterima dari client.
- Polish terakhir: responsif mobile (terutama halaman scan QR & form lapor rusak/hilang), error state & empty state di semua halaman utama.

**Deliverable:** Sistem live di production dengan data aset existing sudah ter-import, siap dipakai Kecamatan Sagulung & kelurahan-kelurahannya per 10 Oktober 2026.
