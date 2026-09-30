# Desain: Lapor Rusak/Hilang (asset_reports)

Status: Diimplementasikan (plan 2026-10-01-lapor-rusak-hilang.md).
Tanggal: 2026-10-01

Menggantikan `docs/superpowers/plans/2026-09-26-asset-report.md` (plan lama, dibuat sebelum workflow engine dinamis).

---

## 1. Konteks & Tujuan

Admin unit dapat melaporkan aset rusak atau hilang; atasan unit menyetujui atau menolak; bila disetujui, kondisi aset berubah otomatis dan tercatat di riwayat. Alur ini memakai **Generic Approval Workflow Engine** (bukan approval satu langkah terpisah seperti desain 26 Sep), sehingga Kotak Persetujuan, notifikasi, badge, batalkan pengajuan, alihkan approver, dan Pengaturan Alur dari UI otomatis berlaku.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Approval | Workflow engine, alur `lapor_rusak_hilang`, satu langkah default bertipe `atasan_unit` (Camat bila unit aset kecamatan, Lurah bila kelurahan). Dapat diubah dari Pengaturan Alur. |
| Kunci aset | Tidak dikunci selama pending. Satu aset maksimal satu laporan `pending`. Aset yang sedang `dalam_proses` tetap boleh dilaporkan. |
| Efek laporan hilang | Kondisi jadi `hilang`; aset **diblokir dari transaksi lain** (tidak bisa dipilih di Mutasi, tidak bisa dilaporkan lagi). |
| Pemegang | Opsional. Bila aset punya pemegang saat laporan dibuat, `pegawai_id` diisi otomatis (histori tetap benar). Approver ditentukan dari unit aset, bukan pemegang. |
| Foto | Laporan rusak wajib minimal 1 foto; hilang opsional. Maks 10 foto, 5 MB, jpg/jpeg/png/webp, memakai `asset_photos` polimorfik. |
| Pelapor | Hanya `admin_kecamatan` / `admin_kelurahan`, hanya untuk aset di unit sendiri. |

## 3. Data Model

### 3.1 Enum
- `AssetReportType`: `rusak`, `hilang` (dengan `label()`).
- `AssetReportStatus`: `pending`, `approved`, `rejected`, `cancelled` (dengan `label()`).

### 3.2 Tabel `asset_reports`

| Kolom | Keterangan |
|---|---|
| `id` | |
| `nomor_laporan` | string unik, otomatis `LP/{tahun}/{urut 4 digit}` (urut per tahun, dibuat di dalam transaksi dengan kunci). |
| `asset_id` | FK `assets`. |
| `unit_id` | FK `units`: unit aset saat dilaporkan. Dipakai sebagai unit subjek (`->unit`) oleh engine. |
| `pegawai_id` | FK `pegawais`, nullable: pemegang aset saat dilaporkan. |
| `jenis` | `AssetReportType`. |
| `kondisi_baru` | `Kondisi`: `rusak_ringan`/`rusak_berat` untuk rusak; otomatis `hilang` untuk hilang. |
| `tanggal_kejadian` | date, wajib, tidak boleh di masa depan. |
| `kronologi` | text, wajib. |
| `status` | `AssetReportStatus`, default `pending`. |
| `created_by` | FK `users`. |
| timestamps | |

### 3.3 Model `AssetReport`
Implements `Approvable` (`approvalTitle()` = "Laporan {jenis} #{nomor_laporan}", `approvalShowUrl()`) dan `HandlesApprovalOutcome` (`onApprovalRejected`/`onApprovalCancelled` hanya mengubah status laporan, tidak menyentuh aset). Relasi: `asset()`, `unit()`, `pegawai()`, `creator()`, `photos()` (MorphMany `AssetPhoto`), `approvalRequest()` (MorphOne).

## 4. Workflow & Efek

### 4.1 Definisi alur
Ditambahkan ke `WorkflowDefaults` dan `config/workflow.php`:
- `lapor_rusak_hilang`: nama "Lapor Rusak/Hilang", satu langkah `label = "Persetujuan Atasan Unit"`, `approver_type = atasan_unit`, `unit_scope = subject`.
- `capabilities['lapor_rusak_hilang'] = 'subject'`; `effects['lapor_rusak_hilang'] = AssetReportEffect::class`.
- `WorkflowDefinitionSeeder` (non-destruktif) membuat alur ini di database yang sudah ada.

### 4.2 `AssetReportService::create(array $data, array $photos, User $actor)`
Dalam satu transaksi dengan `lockForUpdate` pada baris aset:
1. Validasi aturan (bagian 5). Melempar `InvalidArgumentException` dengan pesan jelas.
2. Buat `AssetReport` (isi `unit_id` = unit aset, `pegawai_id` = `asset->current_holder_id`, `kondisi_baru` = `hilang` bila jenis hilang).
3. Simpan foto (`asset-reports/{id}` di disk `public`).
4. `ApprovalWorkflowService::submit($report, 'lapor_rusak_hilang', $actor)`.

### 4.3 `AssetReportEffect::apply(AssetReport)`
Dalam transaksi, kunci baris aset, **validasi ulang** (aset ada, belum `hilang`, kondisi baru masih lebih buruk dari kondisi sekarang; bila tidak, `InvalidArgumentException` dan approve dibatalkan dengan pesan jelas). Lalu:
- `assets.kondisi = kondisi_baru`.
- `asset_histories`: `event = laporan_rusak` / `laporan_hilang`, `unit_id`, `current_holder_id`, `kondisi` baru, `user_id` = approver terakhir (`auth()->id() ?? created_by`), `keterangan` = kronologi.
- `asset_reports.status = approved`.

## 5. Aturan Validasi (server; diulang di efek approve)

- Aset milik unit pelapor (`AssetPolicy`-style: `canAccessUnit(asset->unit)` dan pelapor adalah admin unit itu).
- Aset belum berkondisi `hilang`.
- Laporan rusak: `kondisi_baru` harus lebih buruk dari kondisi sekarang (urutan: baik < rusak_ringan < rusak_berat). Sama atau lebih baik ditolak.
- Belum ada laporan `pending` untuk aset yang sama.
- Foto: rusak wajib >= 1; jumlah <= 10; tiap file image `jpg/jpeg/png/webp` <= 5 MB.
- Kronologi wajib; `tanggal_kejadian` wajib dan <= hari ini.

### 5.1 Blokir aset hilang di modul Mutasi
`AssetMutationService::submit` menolak aset berkondisi `hilang` (pesan jelas); `AssetMutationController::create` tidak mengirim aset berkondisi `hilang` ke form.

## 6. Hak Akses

`AssetReportPolicy`:
- `viewAny`: semua role login.
- `view`: mengikuti `accessibleUnitIds()` terhadap `unit_id` laporan (Kasubag semua, Camat unit + binaan, lainnya unit sendiri).
- `create`: hanya `admin_kecamatan`/`admin_kelurahan` dengan `unit_id` terisi; unit aset harus dalam cakupannya.

Approve/reject/batalkan/alihkan memakai endpoint generik `approval-requests.*`.

## 7. UI (Inertia + React)

Menu sidebar "Lapor Rusak/Hilang" diaktifkan (semua role).
- **Index:** kolom nomor, aset, jenis, kondisi baru, unit, pelapor, tanggal, status; filter status dan jenis; cari nomor/nama aset; paginasi server-side.
- **Create** (hanya admin): pilih aset (aset unit sendiri yang belum hilang dan tanpa laporan pending), jenis, kondisi baru (hanya untuk rusak), tanggal kejadian, kronologi, unggah foto; pemegang tampil otomatis (baca saja).
- **Show:** tracker dari snapshot langkah, info laporan, galeri foto (lightbox), riwayat aktivitas, tombol Setujui/Tolak/Batalkan/Alihkan sesuai hak (`can.act/cancel/reassign`), pola sama dengan Mutasi.
- Riwayat aset (`Assets/Show`) otomatis menampilkan event laporan.

## 8. Pengujian (Pest)

Validasi tiap aturan bagian 5; satu laporan pending per aset; aset `dalam_proses` tetap bisa dilaporkan; efek approve (kondisi, riwayat, validasi ulang bila kondisi berubah setelah submit); reject/batal tidak menyentuh aset; approver benar (Camat untuk unit kecamatan, Lurah untuk kelurahan, bukan sebaliknya); pengaju tidak bisa menyetujui sendiri; `403` lintas unit dan role bukan admin; upload foto (jumlah, tipe, ukuran); aset hilang ditolak di Mutasi dan tidak muncul di form Mutasi. Frontend divalidasi manual di browser.

## 9. Di Luar Cakupan

Pemulihan kondisi (rusak kembali baik), penghapusan pembukuan (write-off), notifikasi email/push, dan laporan langsung oleh pegawai (tetap lewat admin unit).
