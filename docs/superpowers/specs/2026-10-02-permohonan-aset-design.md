# Desain: Permohonan Aset (asset_requests)

Status: Diimplementasikan (plan 2026-10-02-permohonan-aset.md).
Tanggal: 2026-10-02

Menggantikan `docs/superpowers/plans/2026-09-26-asset-request.md` (plan lama, dibuat sebelum workflow engine dinamis dan modul Mutasi).

---

## 1. Konteks & Tujuan

Dua kebutuhan permintaan aset (alur f/g pada desain utama):
- **Jenis pegawai:** admin unit mengajukan permohonan aset atas nama seorang pegawai; atasan unit pegawai menyetujui; admin menyerahkan satu aset ke pegawai tersebut.
- **Jenis unit:** admin kelurahan meminta stok ke kecamatan; Kasubag menyetujui; admin kecamatan memenuhi dengan memindahkan aset ke kelurahan lewat alur **Mutasi**.

Approval memakai **Generic Approval Workflow Engine** (bukan approval satu langkah terpisah seperti desain 26 Sep), sehingga Kotak Persetujuan, notifikasi, badge, batalkan pengajuan, alihkan approver, dan Pengaturan Alur dari UI otomatis berlaku.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Approval | Engine. `permohonan_pegawai`: 1 langkah `atasan_unit`. `permohonan_unit`: 1 langkah role `kasubag`. Keduanya dapat diubah dari Pengaturan Alur (kapabilitas `subject`). |
| Isi permohonan | Pegawai: 1 barang. Unit: `jumlah` >= 1 (satu subkategori per permohonan). |
| Fulfill pegawai | Aset unit pegawai, `aktif`, kondisi bukan `hilang`, belum berpemegang, subkategori sama dengan yang diminta. Mengisi pemegang, menulis histori. |
| Fulfill unit | Membuat dan mengajukan Mutasi `kec_ke_kel` (asal kecamatan, tujuan unit peminta) berisi tepat `jumlah` aset. Permohonan `fulfilled` saat Mutasi disetujui; bila Mutasi ditolak/dibatalkan, permohonan bisa dipenuhi lagi. |
| Tutup | Pemenuh dapat menutup permohonan `approved` (tanpa Mutasi berjalan) dengan alasan wajib; status jadi `cancelled`. |
| Pengaju | Hanya `admin_kecamatan` / `admin_kelurahan`; jenis unit hanya `admin_kelurahan`. |

## 3. Data Model

### 3.1 Enum
- `AssetRequestType`: `pegawai`, `unit` (dengan `label()`).
- `AssetRequestStatus`: `pending`, `approved`, `fulfilled`, `rejected`, `cancelled` (dengan `label()`).

### 3.2 Tabel `asset_requests`

| Kolom | Keterangan |
|---|---|
| `nomor_permohonan` | string unik, otomatis `PM/{tahun}/{urut 4 digit}` (di dalam transaksi dengan kunci). |
| `jenis` | `AssetRequestType`. |
| `pegawai_id` | FK `pegawais`, nullable; wajib untuk jenis pegawai. |
| `unit_id` | FK `units`: unit peminta. Untuk pegawai = unit pegawai; untuk unit = unit admin pengaju. **Tidak pernah dari input klien.** Dipakai sebagai unit subjek (`->unit`) oleh engine. |
| `category_id` | FK `asset_categories`, harus subkategori (`parent_id` tidak null). |
| `jumlah` | unsigned int >= 1; selalu 1 untuk jenis pegawai. |
| `keterangan` | text, wajib. |
| `status` | `AssetRequestStatus`, default `pending`. |
| `created_by` | FK `users`. |
| `mutation_id` | FK `asset_mutations`, nullable: Mutasi hasil fulfill (jenis unit). |
| `fulfilled_by`, `fulfilled_at` | FK `users` nullable, timestamp nullable. |
| `catatan_penutupan` | text nullable: alasan tutup permohonan. |
| timestamps | |

### 3.3 Tabel `asset_request_assets`
`asset_request_id` (FK cascade), `asset_id` (FK), unik `(asset_request_id, asset_id)`. Mencatat aset yang diserahkan/dipindahkan untuk permohonan (1 untuk pegawai, N untuk unit).

### 3.4 Model `AssetRequest`
Implements `Approvable` (`approvalTitle()` = "Permohonan Aset #{nomor}", `approvalShowUrl()`) dan `HandlesApprovalOutcome` (`onApprovalRejected` -> `rejected`, `onApprovalCancelled` -> `cancelled`). Relasi: `pegawai()`, `unit()`, `category()`, `creator()`, `fulfiller()`, `mutation()`, `assets()` (BelongsToMany via `asset_request_assets`), `approvalRequest()` (MorphOne).

## 4. Workflow & Efek

### 4.1 Definisi alur
Ditambahkan ke `WorkflowDefaults`, `config/workflow.php` (`capabilities` = `subject`, `effects`):
- `permohonan_pegawai`: "Permohonan Aset Pegawai", 1 langkah "Persetujuan Atasan Unit" (`atasan_unit`, `subject`).
- `permohonan_unit`: "Permohonan Aset Unit", 1 langkah "Persetujuan Kasubag" (role `kasubag`, scope `none`).
- Seeder non-destruktif membuatnya di database yang sudah ada.

### 4.2 `AssetRequestEffect::apply(AssetRequest)`
Dijalankan saat approve final: `status = approved` (tidak menyentuh aset). Melempar `InvalidArgumentException` bila status bukan `pending`.

### 4.3 `AssetRequestService`
- `create(array $data, User $actor): AssetRequest`: validasi (bagian 5), isi `unit_id` dari pegawai/unit admin, nomor otomatis, `submit` ke workflow sesuai jenis, dalam satu transaksi.
- `fulfillPegawai(AssetRequest, int $assetId, User $actor): void`: dalam transaksi + `lockForUpdate` baris permohonan dan aset. Validasi ulang (status `approved`, aktor pemenuh, aset sah). Isi `current_holder_id`, tulis histori `serah_terima` (`keterangan` = nomor permohonan), catat `asset_request_assets`, `status = fulfilled`, `fulfilled_by/at`.
- `fulfillUnit(AssetRequest, array $assetIds, User $actor): AssetMutation`: validasi (status `approved`, tanpa `mutation_id`, aktor admin kecamatan induk, jumlah aset == `jumlah`, aset milik kecamatan dan sah). Membuat Mutasi lewat `AssetMutationService::submit` (`kec_ke_kel`, nomor mutasi otomatis, keterangan menyebut nomor permohonan), menyimpan `mutation_id` dan `asset_request_assets`. Status tetap `approved`.
- `close(AssetRequest, string $note, User $actor): void`: hanya pemenuh; status `approved` dan tanpa `mutation_id`; alasan wajib; `status = cancelled`; notifikasi ke pengaju.

### 4.4 Hook Mutasi
Saat Mutasi tertaut disetujui (`AssetMutationEffect`): permohonan `fulfilled` (`fulfilled_by` = approver terakhir, `fulfilled_at`). Saat Mutasi ditolak/dibatalkan (`onApprovalRejected/Cancelled`): `mutation_id` dikosongkan dan `asset_request_assets` dihapus sehingga permohonan bisa dipenuhi lagi.

## 5. Aturan Validasi (server)

Membuat:
- Aktor `admin_kecamatan`/`admin_kelurahan` dengan `unit_id`.
- Jenis pegawai: `pegawai_id` wajib dan pegawai harus di unit yang bisa diakses aktor (`canAccessUnit`); `jumlah` dipaksa 1.
- Jenis unit: hanya `admin_kelurahan`; unit peminta = unit aktor; `jumlah` >= 1.
- `category_id` subkategori; `keterangan` wajib.

Aset yang sah untuk fulfill (diulang di dalam transaksi): milik unit yang benar (unit pegawai untuk pegawai; kecamatan induk untuk unit), `status = aktif`, `kondisi != hilang`, subkategori sama dengan permohonan, dan untuk pegawai `current_holder_id` kosong. Aset ganda dalam daftar ditolak.

## 6. Hak Akses (`AssetRequestPolicy`)

- `viewAny`: semua role login. `view`: Kasubag semua; lainnya sesuai `accessibleUnitIds()` terhadap `unit_id`; admin kecamatan induk juga melihat permohonan jenis unit dari kelurahan binaannya.
- `create`: bagian 5. `fulfill` dan `close`: admin unit pegawai (jenis pegawai) atau admin kecamatan induk (jenis unit); status `approved`.
- Approve/reject/batalkan/alihkan memakai endpoint generik `approval-requests.*`.

## 7. UI (Inertia + React)

Menu "Permohonan Aset" diaktifkan (semua role).
- **Index:** kolom nomor, jenis, pemohon (pegawai atau unit), subkategori, jumlah, unit, tanggal, status; filter status dan jenis; cari nomor/keterangan; tab "Menunggu Pemenuhan" untuk pemenuh; paginasi.
- **Create** (admin): jenis (opsi sesuai role), pegawai (jenis pegawai), jumlah (jenis unit), subkategori, keterangan.
- **Show:** tracker dari snapshot, info permohonan, aset yang diserahkan atau tautan Mutasi, riwayat aktivitas, tombol Setujui/Tolak/Batalkan/Alihkan; untuk pemenuh pada status `approved`: panel **Penuhi Permohonan** (daftar aset yang memenuhi syarat) dan tombol **Tutup Permohonan** (modal alasan).

## 8. Pengujian (Pest)

Validasi pembuatan per jenis dan role; routing approver (Camat/Lurah vs Kasubag) dan pengaju tidak bisa menyetujui sendiri; efek approve; fulfill pegawai (tiap syarat aset, atomik, histori, hanya pemenuh); fulfill unit (Mutasi terbentuk dengan N item dan aset terkunci, jumlah tidak sama ditolak, `fulfilled` saat Mutasi disetujui, kembali bisa dipenuhi saat Mutasi ditolak/dibatalkan); tutup permohonan; `403` lintas unit dan role salah; dua fulfill bersamaan tidak menyerahkan aset yang sama dua kali. Frontend divalidasi manual di browser.

## 9. Di Luar Cakupan

Pemenuhan sebagian, permohonan multi-jenis barang, kedaluwarsa otomatis, pemenuhan dari unit selain kecamatan, dan notifikasi email/push.
