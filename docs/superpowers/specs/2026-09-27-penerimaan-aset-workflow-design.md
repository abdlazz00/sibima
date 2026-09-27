# Desain: Alur Penerimaan Aset & Generic Approval Workflow Engine

Status: disetujui, siap masuk `writing-plans`.

## Konteks

Sprint 3 (`docs/superpowers/plans/2026-09-24-simaset-sprint-plan.md`) mencakup 5 alur
transaksi institusional (penerimaan + 4 jenis mutasi) yang berbagi satu generic approval
workflow engine, sesuai desain awal di `docs/superpowers/specs/2026-09-24-simaset-design.md`
bagian "Generic Approval Workflow Engine" dan "Modul & Alur Transaksi a-e".

Dokumen ini mempersempit scope ke **alur Penerimaan Aset saja** (alur `a`), sebagai alur
pertama yang dibangun untuk memvalidasi engine-nya sebelum 4 alur mutasi lain (`b`-`e`)
dikerjakan menyusul dengan menumpang komponen yang sama.

UI mengikuti desain Figma yang sudah ada: frame `penerimaan-aset-index` (94:181),
`penerimaan-aset-detail` (94:410), `penerimaan-aset-create` (94:633) di file Figma SIBIMA.

**Yang sengaja tidak dibahas/ditunda di dokumen ini:**
- 4 alur mutasi lain (`mutasi_kec_ke_kel`, `mutasi_antar_kel`, `retur_kel_ke_kec`,
  `mutasi_internal`) — menyusul di iterasi berikutnya, menumpang engine yang sama.
- Cetak Berita Acara sebagai PDF (tombol ada di Figma, tapi ditunda — sesuai keputusan saat
  brainstorming, karena butuh desain template baru di luar scope alur ini).
- Notifikasi real-time (push/websocket) — yang dibangun adalah notifikasi in-app biasa
  (muncul saat halaman di-load ulang), bukan live update.
- Form "Tambah Aset Baru" yang sudah ada **tetap dipertahankan apa adanya** (input langsung
  tanpa approval, untuk kebutuhan data historis/koreksi cepat) — tidak diganti oleh alur ini.

## Generic Approval Workflow Engine

### Data model

- **`workflow_definitions`** — `id`, `code` (unik, mis. `penerimaan_aset`), `name`.
- **`workflow_steps`** — `id`, `workflow_definition_id`, `step_order`, `approver_role`
  (string, mis. `kasubag`, `camat`), `unit_scope` (enum `none`/`subject`/`origin`/`destination`
  — hanya `none` dan `subject` dipakai untuk Penerimaan Aset; `origin`/`destination` disiapkan
  untuk alur mutasi berikutnya, belum dipakai sekarang).
- **`approval_requests`** — polymorphic ke model transaksi (`approvable_type`/
  `approvable_id`), `workflow_definition_id`, `current_step` (int, mulai dari 1), `status`
  (`pending`/`approved`/`rejected` — **disederhanakan dari 4 nilai di spec awal**
  `diajukan`/`berjalan`/`disetujui`/`ditolak`, karena beda "diajukan" vs "berjalan" tidak
  berpengaruh ke logika, cukup dibaca dari `current_step`; UI menurunkan label
  Diajukan/Diverifikasi/Disetujui/Ditolak dari kombinasi `status` + `current_step`).
- **`approval_actions`** — log tiap approve/reject: `approval_request_id`, `step_order`,
  `user_id`, `action` (`approve`/`reject`), `note` (wajib diisi kalau `reject`), timestamps.

### `ApprovalWorkflowService`

Satu service generik, dipakai semua alur (bukan cuma Penerimaan Aset):

- `submit(Model $approvable, string $workflowCode, User $submitter): ApprovalRequest` — bikin
  `approval_requests` di step 1, status `pending`, lalu kirim notifikasi ke approver step 1.
- `approve(ApprovalRequest $request, User $approver, ?string $note): void`:
  1. Validasi `$approver` lolos `canAct()` (lihat resolver di bawah) untuk step berjalan —
     kalau tidak, `403`.
  2. Catat `approval_actions`.
  3. Kalau step terakhir → `status = approved`, trigger efek transaksi via effect handler
     terdaftar (lihat di bawah), notifikasi ke pengaju.
  4. Kalau bukan step terakhir → `current_step++`, notifikasi ke approver step berikutnya.
- `reject(ApprovalRequest $request, User $approver, string $note): void` — `note` wajib,
  `status = rejected`, tidak ada efek ke `assets`, notifikasi ke pengaju + alasan.

### Resolver `canAct()`

```php
function canAct(User $user, ApprovalRequest $request): bool {
    $step = $request->currentStepDefinition(); // dari workflow_steps sesuai current_step
    if (!$user->hasRole($step->approver_role)) return false;
    return match ($step->unit_scope) {
        'none' => true, // kasubag — lintas unit
        'subject' => $user->canAccessUnit($request->approvable->unit),
    };
}
```

Reuse `User::canAccessUnit()` yang sudah ada (dipakai `AssetPolicy` juga) — konsisten dengan
pola scoping yang sudah jalan.

### Effect handler (khusus Penerimaan Aset)

Efek transaksi terdaftar lewat mapping kecil `workflow code → effect class` di
`ApprovalWorkflowService`, supaya 4 alur mutasi berikutnya tinggal daftar efek masing-masing
tanpa mengubah service intinya.

`PenerimaanAsetEffect::apply(BeritaAcaraPenerimaan $ba)`:
1. Untuk tiap `berita_acara_items` milik `$ba`, ulang sebanyak `jumlah_unit`:
   - Validasi ulang `category.code` tidak null (race condition guard — lihat Error Handling).
   - Hitung nomor urut berikutnya untuk `category.code` tsb (ambil nomor urut terbesar yang
     sudah dipakai kode itu di `assets.kode_barang`, +1; bukan reset per-BA).
   - Bikin `Asset` baru: `kode_barang = "{category.code}.{urutan, 3 digit padded}"`,
     `nomor_register` (auto-increment global seperti pola yang sudah ada), `nama_aset`,
     `merk_type`, `category_id` dari item, `unit_id` dari `$ba`, `kondisi` = `kondisi_awal`
     item, `status = aktif`, `tanggal_perolehan` = `$ba->tanggal_penerimaan`,
     `sumber_perolehan` = `$ba->sumber_perolehan`, `nilai_perolehan` = `nilai_per_unit`,
     `nilai_buku` = `nilai_perolehan` (nilai awal), `no_dokumen` = `$ba->no_berita_acara`.
   - Tulis `asset_histories` (event `diterima`, referensi ke `$ba`).
2. Simpan jejak audit unit→Asset lewat kolom `asset_ids` (json, list of int) di
   `berita_acara_items`, supaya dari BA bisa lihat Asset mana saja yang terbentuk tanpa perlu
   tabel pivot terpisah — jumlahnya kecil (sebanyak `jumlah_unit`), tidak perlu di-query
   relasional.

## Data Model: Penerimaan Aset

Bukan 1 pengajuan = 1 aset — mengikuti Figma: 1 Berita Acara berisi banyak baris barang, tiap
baris bisa mewakili beberapa unit fisik sekaligus.

- **`berita_acara_penerimaans`** — `no_berita_acara`, `tanggal_penerimaan`, `sumber_perolehan`
  (text bebas, konsisten dengan keputusan yang sama di form "Tambah Aset Baru" — bukan
  dropdown tetap seperti di mockup Figma, karena tidak ada enum baku di backend),
  `no_kontrak_spk` (wajib), `vendor` (opsional), `catatan` (opsional), `unit_id` (kecamatan
  pengaju, dari user login — bukan field form), `created_by`, `status` (`draft`/`submitted`
  — cuma `submitted` yang punya `approval_requests`), dokumen pendukung lewat relasi
  polymorphic yang sama polanya dengan `asset_photos` yang sudah ada.
- **`berita_acara_items`** — `berita_acara_penerimaan_id`, `nama_aset`, `merk_type`,
  `category_id` (subkategori), `jumlah_unit` (int, min 1), `nilai_per_unit` (decimal),
  `kondisi_awal` (enum `Kondisi` yang sudah ada, default `baik`).

### Migrasi data pendukung

Isi kolom `AssetCategory.code` (sudah ada, nullable, saat ini kosong di 22/22 kategori) untuk
15 subkategori yang sudah ada, memakai kode BMD resmi dari
`docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx` sheet `MASTER_ASET` (341 baris data real,
kode diekstrak & dicocokkan manual terhadap subkategori yang ada — 15/15 cocok persis).
Mapping lengkap:

| Subkategori | Kode BMD |
|---|---|
| Kendaraan Bermotor Angkutan Barang | 1.3.2.02.01.03 |
| Kendaraan Bermotor Beroda Dua | 1.3.2.02.01.04 |
| Kendaraan Dinas Bermotor Perorangan | 1.3.2.02.01.01 |
| Alat Kantor Lainnya | 1.3.2.05.01.05 |
| Alat Penyimpan Perlengkapan Kantor | 1.3.2.05.01.04 |
| Alat Dapur | 1.3.2.05.02.05 |
| Alat Pendingin | 1.3.2.05.02.04 |
| Alat Rumah Tangga Lainnya (Home Use) | 1.3.2.05.02.06 |
| Meubelair | 1.3.2.05.02.01 |
| Peralatan Studio Video dan Film | 1.3.2.06.01.02 |
| Personal Komputer | 1.3.2.10.01.02 |
| Kursi Kerja Pejabat | 1.3.2.05.03.03 |
| Lemari dan Arsip Pejabat | 1.3.2.05.03.07 |
| Meja Kerja Pejabat | 1.3.2.05.03.01 |
| Peralatan Personal Komputer | 1.3.2.10.02.03 |

Catatan: file Excel juga menyebut subkategori "Kendaraan Bermotor Beroda Tiga" yang belum ada
di `asset_categories` — di luar scope (tidak ditambahkan sekarang, tidak menghalangi alur ini).

## UI

Halaman baru (React/Inertia, pola sama seperti `Assets/*` dan `Pegawai/*` yang sudah ada):

- **`Penerimaan/Index.tsx`** — tabel (No. BA, Nama Aset, Kategori, Nilai, Pengaju, Tanggal,
  Status, Aksi), filter status + periode, search, pagination server-side. Badge status
  (`Diajukan`/`Diverifikasi`/`Disetujui`/`Ditolak`) diturunkan dari `status` + `current_step`.
- **`Penerimaan/Create.tsx`** — 3 section sesuai Figma: Info BA, daftar item aset (repeatable,
  "+ Tambah Barang Lain"/"Hapus"), upload dokumen. Tombol **Simpan Draft**
  (`status=draft`) dan **Ajukan Penerimaan** (`status=submitted`, langsung `submit()` ke
  workflow engine).
- **`Penerimaan/Show.tsx`** — tracker 3 step visual (check hijau selesai / kuning berjalan /
  abu-abu belum), info grid BA, rincian barang, riwayat aktivitas (dari `approval_actions` +
  event submit). Tombol Approve/Reject muncul untuk user yang lolos `canAct()` pada step
  berjalan; reject wajib isi catatan lewat modal.
- **`Persetujuan/Index.tsx`** ("Kotak Persetujuan", generik) — daftar semua
  `approval_requests` lintas jenis alur yang bisa di-approve user ini. Untuk sekarang isinya
  cuma Penerimaan Aset, tapi dibangun generik (baca `workflow_definitions.name`) supaya 4 alur
  mutasi berikutnya tinggal numpang.
- **Nav**: aktifkan "Penerimaan Aset" & "Kotak Persetujuan" di `navigation.ts` (sekarang
  disabled). Badge count sidebar diisi jumlah `approval_requests` pending milik user (bukan
  angka statis).

## Notifikasi

- Pakai fitur notifikasi bawaan Laravel (tabel `notifications`, morph ke `User`) — bukan
  sistem baru dari nol.
- `ApprovalWorkflowService` mengirim notifikasi di 3 titik: submit → approver step 1; naik
  step → approver step berikutnya; approved/rejected final → pengaju.
- Bell di `AuthenticatedLayout` diganti dari angka statis jadi count asli (`unread_count`
  lewat Inertia shared prop) + dropdown daftar notifikasi; klik = mark-as-read + navigasi ke
  halaman terkait.
- In-app biasa (re-fetch saat halaman di-load), **bukan** real-time push/websocket.

## Error Handling & Edge Case

- Reject di step manapun → `status = rejected`, tidak ada efek ke `assets`, `note` wajib,
  pengaju dinotifikasi.
- Kategori belum punya `code` — divalidasi saat submit item (gagal cepat) **dan** divalidasi
  ulang saat approval final (race condition guard, sesuai prinsip di spec awal), pesan error
  jelas menyebut subkategori mana yang belum punya kode.
- Approve/reject oleh user yang bukan approver step berjalan → `403` dari `canAct()`.
- BA masih `status = draft` → tidak membuat `approval_requests`, tidak muncul di manapun
  approval inbox.
- Approve/reject dua kali atau di luar urutan step → exception, pola sama seperti guard yang
  sudah ada di model `Unit`/`Asset`.

## Testing Approach

- Pest feature test alur penuh: submit → verifikasi kasubag → approve camat → `Asset` +
  `asset_histories` terbentuk benar (termasuk `kode_barang` auto-generate & lanjut nomor urut
  yang benar, bukan reset).
- Reject di tiap step → tidak ada efek ke `assets`.
- Aktor salah (role/unit tidak sesuai step) di tiap step → `403`.
- Kategori tanpa `code` → gagal dengan pesan jelas, baik saat submit maupun saat approval
  final.
- BA `draft` tidak muncul di Kotak Persetujuan siapapun.
- Notifikasi terbentuk & terkirim ke user yang benar di tiap transisi step.
- Policy test untuk `canAct()` scoping per role & unit.
