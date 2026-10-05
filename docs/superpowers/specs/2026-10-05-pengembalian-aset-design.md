# Desain: Pengembalian Aset ke Inventaris

Status: Menunggu review.
Tanggal: 2026-10-05

Alur untuk mengembalikan aset yang sedang dipegang pegawai ke inventaris (stok) unit, sehingga aset yang menganggur dapat dialokasikan ulang lewat Permohonan Aset yang sudah ada. Dibangun sebagai jenis baru di Mutasi Aset, dengan alur persetujuan sendiri.

---

## 1. Konteks & Tujuan

Hasil showcase ke client: ada alur yang terlewat. Contoh kasus: Bagian Informasi di kecamatan kekurangan satu laptop; ternyata ada laptop yang menganggur di tangan Pak Camat dan beliau ingin laptop itu dialokasikan ke Bagian Informasi.

Kondisi kode saat ini:
- Pemegang aset disimpan di `assets.current_holder_id` (pegawai); kosong berarti aset ada di inventaris unit.
- Mutasi Internal (unit asal = unit tujuan) memindahkan pemegang dari pegawai A ke pegawai B, tetapi **mewajibkan** pemegang baru, sehingga aset tidak bisa dikembalikan ke inventaris.
- Permohonan Aset untuk pegawai hanya dapat dipenuhi dari **stok** (`current_holder_id` kosong), jadi aset yang sedang dipegang tidak pernah muncul sebagai pilihan.

Tujuan:
1. Pegawai (lewat admin unit) dapat mengembalikan aset ke inventaris unit, dengan persetujuan atasan unit.
2. Aset yang dikembalikan otomatis menjadi stok dan dapat dipenuhi lewat Permohonan Aset tanpa perubahan di sisi permohonan.
3. Memakai ulang mesin yang sudah ada (penguncian aset, persetujuan, riwayat, notifikasi, laporan) dan menambah sesedikit mungkin kode baru.

Di luar cakupan: "Alihkan langsung antar pegawai" (sudah ada sebagai Mutasi Internal; form hanya diberi petunjuk), pengembalian massal per pegawai (pensiun/pindah), perubahan kondisi aset saat dikembalikan (kondisi tetap lewat Lapor Rusak/Hilang).

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Bentuk alur | Dua langkah terpisah: (1) pengembalian ke inventaris, (2) aset menjadi stok dan dipenuhi lewat Permohonan Aset yang ada. |
| Pelaku | Admin unit (kecamatan/kelurahan) mencatat; Atasan Unit (Camat/Lurah) menyetujui satu langkah. |
| Pendekatan | Jenis baru `pengembalian` di Mutasi Aset, bukan modul/menu baru. |
| Alur persetujuan | Alur terpisah `pengembalian_aset`, tidak memakai `mutasi_internal_kec`/`mutasi_internal_kel`. Default satu langkah "Persetujuan Atasan Unit" (tipe `atasan_unit`), dapat diedit di Pengaturan Alur. |
| Izin | Memakai `mutasi.create` dan `mutasi.view`; tidak ada permission baru. |
| Kondisi aset | Tidak diubah oleh pengembalian. |

---

## 3. Desain Backend

### 3.1 Jenis dan bentuk data

- `MutationType::Pengembalian = 'pengembalian'`, label "Pengembalian ke Inventaris". Kolom `asset_mutations.jenis_mutasi` berupa `string(30)`, jadi tidak perlu migrasi.
- Unit asal sama dengan unit tujuan (seperti Mutasi Internal). `asset_mutation_items.target_holder_id` selalu kosong dan berarti "inventaris unit".

### 3.2 Aturan di `AssetMutationService::submit`

- Unit asal harus sama dengan unit tujuan.
- Setiap aset harus **sedang dipegang** pegawai (`current_holder_id` terisi); aset yang sudah berada di stok ditolak dengan pesan jelas.
- Item tidak boleh membawa `target_holder_id`.
- Aturan yang sudah ada tetap: aset milik unit asal, bukan kondisi hilang, status aktif; aset dikunci `dalam_proses` selama menunggu.
- `resolveWorkflowCode`: jenis `pengembalian` menuju `pengembalian_aset`.
- `assertUnitKindsMatch`: jenis `pengembalian` valid untuk kecamatan maupun kelurahan.

### 3.3 Alur persetujuan `pengembalian_aset`

- `WorkflowDefaults`: nama "Pengembalian Aset ke Inventaris", satu langkah `atasanUnit('Persetujuan Atasan Unit')`. Tipe ini memilih Camat untuk unit kecamatan dan Lurah untuk unit kelurahan, jadi satu alur cukup untuk keduanya.
- `config/workflow.php`: efek `AssetMutationEffect`; kapabilitas `subject` (agar tipe "Atasan Unit" dan lingkup "Unit pengaju" dapat dipakai dan divalidasi di Pengaturan Alur).
- Langkah "Atasan Unit" membaca `$approvable->unit`; `AssetMutation` hanya punya `originUnit`. Ditambah relasi `AssetMutation::unit()` yang menunjuk unit asal (pada pengembalian, asal = tujuan).
- Pembuat tidak dapat menyetujui pengajuannya sendiri (aturan mesin yang sudah ada).
- Pengaturan Alur menampilkan 10 alur (sebelumnya 9).

### 3.4 Efek saat disetujui (`AssetMutationEffect`)

- `current_holder_id` menjadi kosong (efek yang ada sudah mengisinya dari `target_holder_id`), status aset kembali `aktif`.
- Riwayat aset memakai event `pengembalian` (bukan `mutasi`) untuk jenis ini, dengan keterangan yang memuat nama pemegang sebelumnya dan nomor mutasi, mis. "Dikembalikan oleh {pegawai} ke inventaris {unit}, No. {nomor}".
- Permohonan Aset tidak berubah: `AssetRequestService::eligibleAssets` sudah menyaring `current_holder_id` kosong, sehingga aset yang dikembalikan langsung muncul sebagai pilihan serah terima.

### 3.5 Pengerasan alur hilang

`ApprovalWorkflowService::submit` mengganti `firstOrFail()` dengan pemeriksaan yang melempar `InvalidArgumentException` berpesan jelas ("Alur persetujuan '{kode}' belum dikonfigurasi. Jalankan WorkflowDefinitionSeeder.") agar definisi yang belum di-seed tidak tampil sebagai 404. Berlaku untuk semua alur.

### 3.6 Seeder dan deploy

`WorkflowDefinitionSeeder` (non-destruktif) otomatis membuat `pengembalian_aset` bila belum ada, tanpa menimpa alur yang sudah dikustom. Langkah ini sudah ada di checklist deploy (`docs/ops/queue-setup.md`); lingkungan dev perlu menjalankannya sekali.

### 3.7 Laporan dan antarmuka data

- Laporan Mutasi: jenis baru otomatis tampil di filter, tabel, rekap, dan Excel (semuanya berbasis `MutationType::cases()`).
- Tidak ada perubahan pada `ReportQuery`, `MutationRecapService`, atau `MutationExcel` selain label otomatis.

---

## 4. Desain Frontend

- `types/index.d.ts`: `MutationType` bertambah `'pengembalian'`.
- Label dan warna badge jenis: `AssetMutations/Index.tsx`, `Show.tsx`, `lib/chartColors.ts`.
- `AssetMutations/Create.tsx`:
  - Pilihan jenis bertambah "Pengembalian ke Inventaris".
  - Untuk jenis ini: unit asal otomatis unit pembuat; unit tujuan dan kolom pemegang baru disembunyikan; payload mengirim tujuan = asal dan `target_holder_id` kosong.
  - Daftar aset per baris hanya aset yang sedang dipegang pegawai, berlabel "Nama aset (dipegang: Nama Pegawai)".
  - Alasan pengembalian wajib (memakai kolom keterangan).
  - Petunjuk di bawah pilihan jenis: "Untuk memindahkan langsung ke pegawai lain gunakan Mutasi Internal."
- `Show.tsx`: pada item pengembalian, pemegang baru ditampilkan "Inventaris unit"; kolom tujuan menampilkan unit yang sama.
- `StoreAssetMutationRequest`: untuk jenis `pengembalian`, `keterangan` wajib diisi dan `items.*.target_holder_id` harus kosong.

---

## 5. Pengujian

Pest (SQLite `:memory:`, antrean `sync`), test ditulis lebih dulu:
- Layanan: menolak aset yang sudah di stok, item dengan pemegang baru, asal berbeda dari tujuan, aset hilang; aset terkunci `dalam_proses` selama menunggu; alur yang dipakai adalah `pengembalian_aset`.
- Persetujuan: Camat menyetujui unit kecamatan, Lurah unit kelurahan; pembuat tidak bisa menyetujui; pemegang menjadi kosong, status aktif, riwayat `pengembalian` mencatat pemegang lama.
- Uji menyeluruh: aset yang dikembalikan muncul di `eligibleAssets` dan dapat diserahkan lewat Permohonan Aset pegawai.
- Pengaturan Alur: daftar 10 alur; langkah `pengembalian_aset` dapat diedit; definisi hilang menghasilkan pesan jelas, bukan 404.
- Laporan Mutasi: jenis `pengembalian` muncul di filter dan rekap.
- Request: `keterangan` wajib dan `target_holder_id` harus kosong untuk jenis pengembalian.
- Frontend: `npx tsc --noEmit` dan `npm run build`. Cek UI manual menunggu perintah pengguna.

---

## 6. Risiko & Catatan

- Alur `pengembalian_aset` harus di-seed di setiap lingkungan (dev, produksi); tanpa itu pengajuan gagal dengan pesan jelas dari pengerasan 3.5.
- Relasi `AssetMutation::unit()` menunjuk unit asal untuk semua jenis mutasi; hanya alur `pengembalian_aset` yang membacanya, jadi tidak mengubah perilaku jenis lain.
- Mengembalikan aset tidak menyelesaikan Permohonan Aset yang menunggu; admin tetap memenuhinya dari halaman permohonan setelah pengembalian disetujui.
- Pengembalian massal per pegawai (pensiun/pindah) dapat ditambahkan nanti di atas jenis yang sama.
