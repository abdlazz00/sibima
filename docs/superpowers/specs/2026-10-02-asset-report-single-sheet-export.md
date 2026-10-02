# Spesifikasi Desain: Export Laporan Aset Single-Sheet (Daftar Aset)

## 1. Latar Belakang & Tujuan
Sebelumnya, fitur export Excel pada Laporan Aset ([`AssetRecapWorkbook.php`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/app/Services/AssetRecapWorkbook.php)) menghasilkan dokumen workbook dengan 5 sheet terpisah (`Ringkasan`, `Daftar Rinci`, `Rekap Kategori`, `Rekap Unit`, `Tren Tahunan`).
Pengguna membutuhkan berkas export yang ringkas dan terfokus pada **1 sheet tunggal** yaitu daftar aset, dengan kolom-kolom yang disesuaikan dengan template resmi Kecamatan Sagulung ([`docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx) pada sheet `MASTER_ASET`), tanpa kolom foto, serta diselaraskan dengan field database model `Asset` di SIBIMA.

## 2. Struktur Sheet Tunggal
- **Nama Sheet**: `Daftar Aset`
- **Jumlah Sheet**: Tepat 1 sheet.
- **Kop Dokumen**:
  - Menggunakan kop standar Pemko Batam & Kecamatan Sagulung melalui [`ReportSheetWriter::kop`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/app/Services/ReportSheetWriter.php).
  - Judul: `Daftar Aset`
  - Metadata: Cakupan unit kerja, Filter yang diterapkan, Tanggal & Waktu pencetakan.

## 3. Struktur Kolom (19 Kolom)
Tabel data aset dimulai pada baris ke-9 dengan 19 kolom terstandarisasi:

| No | Header Kolom | Tipe Format | Sumber Data di Database SIBIMA |
|:---|:---|:---|:---|
| 1 | `No` | `int` | Nomor urut `$index + 1` |
| 2 | `ID Aset` | `text` | `$a->category?->code ?? $a->category?->formatted_code` |
| 3 | `Kode Barang` | `text` | `$a->kode_barang` |
| 4 | `No. Register` | `text` | `$a->registerLabel()` (cth: `0007`) |
| 5 | `Nama Aset` | `text` | `$a->nama_aset` |
| 6 | `Kategori` | `text` | `$a->category?->parent?->name ?? $a->category?->name` |
| 7 | `Subkategori` | `text` | `$a->category?->parent_id !== null ? $a->category->name : '-'` |
| 8 | `Merk/Tipe` | `text` | `$a->merk_type ?? '-'` |
| 9 | `Tahun Perolehan` | `year` | `$a->tanggal_perolehan?->format('Y') ?? '-'` |
| 10 | `Tanggal Perolehan` | `date` | `$a->tanggal_perolehan` |
| 11 | `Sumber Perolehan` | `text` | `$a->sumber_perolehan ?? '-'` |
| 12 | `Harga Perolehan` | `money` | `(float) $a->nilai_perolehan` |
| 13 | `Nilai Buku` | `money` | `(float) $a->nilai_buku` |
| 14 | `Kondisi` | `text` | `$a->kondisi->label()` |
| 15 | `Status Aset` | `text` | `$a->status->label()` |
| 16 | `Unit Kerja` | `text` | `$a->unit?->name ?? '-'` |
| 17 | `Penanggung Jawab` | `text` | `$a->currentHolder?->nama ?? '-'` |
| 18 | `No. Dokumen` | `text` | `$a->no_dokumen ?? '-'` |
| 19 | `Keterangan` | `wrap` | `$a->keterangan ?? '-'` |

## 4. Baris Akumulasi Total
Pada baris terakhir di bawah tabel:
- Kolom `ID Aset` / `Kode Barang` bertuliskan `TOTAL`.
- Kolom ke-12 (`Harga Perolehan`): Nilai total akumulasi harga perolehan.
- Kolom ke-13 (`Nilai Buku`): Nilai total akumulasi nilai buku.
- Kolom lainnya bernilai `null` (kosong).

## 5. Rencana Pengujian
- Unit & Feature test pada [`tests/Feature/AssetRecapWorkbookTest.php`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/tests/Feature/AssetRecapWorkbookTest.php).
- Memastikan sheet yang dibuat tepat 1 sheet bernama `Daftar Aset`.
- Memastikan header kolom tepat 19 kolom dan urutan sesuai spesifikasi.
- Memastikan kalkulasi baris total dan sanitasi formula (formula injection safety) tetap berjalan normal.
- Memastikan seluruh test suite (`php artisan test`) lolos 100%.
