# Desain: Laporan Aset (grup menu Laporan)

Status: Menunggu review.
Tanggal: 2026-10-05

Bagian pertama dari restrukturisasi menu Laporan. Laporan Mutasi dan Laporan Aset Rusak & Hilang dibahas dan dikerjakan dalam siklus spec terpisah.

---

## 1. Konteks & Tujuan

Halaman `/laporan` saat ini hanya berisi filter dan jumlah baris, tanpa pratinjau. Dashboard sekarang hanya menampilkan ringkasan dan pintasan; rincian dipindah ke Laporan (lihat `docs/superpowers/specs/2026-10-04-dashboard-laporan-design.md`).

Tujuan: halaman **Laporan Aset** yang lengkap, rinci, dan mudah dibaca, dan satu file Excel siap serah untuk pertanggungjawaban BMD (kop instansi, beberapa sheet), keduanya dibatasi cakupan unit role.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Menu | Grup sidebar **LAPORAN** (pola sama dengan DATA MASTER) berisi Laporan Aset, Laporan Mutasi, Laporan Rusak & Hilang. Item "Laporan" di grup UTAMA dihapus. |
| Route | Datar seperti route lain: `/laporan-aset` dan `/laporan-aset/unduh`. Mutasi dan Rusak & Hilang sementara tetap di halaman tab lama `/laporan`, lalu dipindah ke `/laporan-mutasi` dan `/laporan-rusak-hilang` pada siklus masing-masing. |
| Isi halaman | Ringkasan, persentase per kondisi, tren per tahun perolehan, rekap per kategori, rekap per unit, daftar rinci. |
| Grafik | Chart.js (`chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels`). Dashboard tetap memakai batang CSS (migrasi dapat dilakukan belakangan). |
| Filter | Unit, Kategori, Kondisi. Unit: Semua unit, Kecamatan (hanya aset kantor kecamatan), lalu tiap kelurahan; memilih satu unit berarti hanya aset unit itu. |
| Daftar rinci | 10 kolom inti + baris detail yang bisa dibuka; paginasi 25 baris; kolom bisa diurutkan. |
| Excel | Lima sheet, hanya tabel (tanpa grafik), setiap sheet berkop: lambang Kota Batam + teks resmi + cakupan, filter, tanggal cetak. |
| Di luar cakupan | Filter lanjutan (rentang tahun, pemegang, pencarian), panel kelengkapan data, PDF, pemilih kolom, migrasi dua laporan lain. |

## 3. Navigasi dan Route

- `navigation.ts`: grup baru `LAPORAN` setelah grup terakhir yang ada dengan item **Laporan Aset** (`/laporan-aset`, ikon `bar-chart`), **Laporan Mutasi** (`/laporan?laporan=mutasi`, sementara), **Laporan Rusak & Hilang** (`/laporan?laporan=rusak-hilang`, sementara). Item `Laporan` dihapus dari grup UTAMA; tautan "Laporan" di aksi cepat dashboard menuju `/laporan-aset`.
- `GET /laporan-aset` → `laporan-aset.index` (halaman), `GET /laporan-aset/unduh` → `laporan-aset.download` (xlsx). Keduanya di grup `auth`.
- Halaman tab lama (`/laporan`, `report.index`, `/laporan/{laporan}/unduh`) tetap melayani `mutasi` dan `rusak-hilang`; jenis `aset` dilepas dari halaman itu (kind default menjadi `mutasi`, tab "Daftar Aset" dihapus) dan route unduhnya tidak lagi menerima `aset`.

## 4. Backend

### 4.1 `AssetRecapService::for(User $user, array $filters): array`
Nama memakai "rekap" karena `AssetReport` sudah dipakai untuk laporan rusak/hilang. Memakai `ReportQuery::build('aset', $filters)` sebagai satu-satunya sumber cakupan dan filter (aggregate dengan `reorder()`, tanpa eager load). Keluaran:

- `ringkasan`: `jumlah` (int), `nilai_perolehan` (float), `nilai_buku` (float).
- `kondisi`: empat entri (`baik`, `rusak_ringan`, `rusak_berat`, `hilang`) berisi `kondisi`, `label`, `jumlah`, `persen` (dibulatkan satu desimal; 0 bila `jumlah` total nol).
- `tren`: per tahun perolehan `tahun`, `jumlah`, `nilai_perolehan`, `nilai_buku`, urut menaik dari tahun pertama sampai terakhir; tahun tanpa aset di antaranya diisi nol. Pengelompokan tahun dilakukan di PHP dari hasil `GROUP BY tanggal_perolehan` agar portabel antara SQLite dan MySQL.
- `rekap_kategori`: kategori utama (induk dari subkategori; kategori tanpa induk dianggap kategori utama) berisi `id`, `nama`, `jumlah`, `nilai_perolehan`, `nilai_buku`, dan `anak` (subkategori dengan angka yang sama), diurutkan menurut jumlah menurun lalu nama; plus `total`.
- `rekap_unit`: baris per unit dalam cakupan yang punya aset (`id`, `nama`, `jumlah`, `nilai_perolehan`, `nilai_buku`) plus `total`; `null` bila cakupan user hanya satu unit.

Seluruh total (ringkasan, total rekap kategori, total rekap unit, total tren, jumlah persen kondisi) harus saling sama untuk filter yang sama.

### 4.2 Daftar rinci
`LaporanAsetController@index` memakai query `ReportQuery` yang sama dengan `paginate(25)` dan `withQueryString()`. Urutan lewat `urut` dan `arah` (`asc`|`desc`, default `kode_barang` `asc`); whitelist `urut`: `kode_barang`, `nomor_register`, `nama_aset`, `tanggal_perolehan`, `kondisi`, `nilai_perolehan`, `nilai_buku` (kategori dan unit tidak dapat diurutkan). Nilai di luar whitelist: 422. Setiap baris berisi `id`, `kode_barang`, `nomor_register` (4 digit), `nama_aset`, `merk_type`, `kategori`, `subkategori`, `unit`, `tahun_perolehan`, `kondisi` (nilai enum), `nilai_perolehan`, `nilai_buku`, dan `detail`: `pemegang`, `status`, `sumber_perolehan`, `no_dokumen`, `keterangan`.

### 4.3 Controller dan validasi
- `LaporanAsetController` (`index`, `unduh`). `index` mengirim props `filters`, `ringkasan`, `kondisi`, `tren`, `rekap_kategori`, `rekap_unit`, `asets` (paginator), `units` (kosong bila cakupan satu unit), `categories` (kategori utama), `kondisiOptions`, `urut`, `arah`.
- `ReportRequest` dipakai ulang: aturan filter `unit_id`, `category_id`, `kondisi` tetap; `unit_id` di luar cakupan 422; ditambah `urut` (`Rule::in` whitelist) dan `arah` (`asc|desc`).
- `unduh` mengembalikan 422 bila hasil nol baris; filter dan cakupan sama dengan halaman, sehingga `ringkasan.jumlah` sama dengan jumlah baris Daftar Rinci.

### 4.4 Excel: `AssetRecapWorkbook`
Dipanggil oleh `unduh`. Nama file `laporan-aset-{Y-m-d}.xlsx`. Lima sheet, **hanya tabel**:

1. **Ringkasan:** tiga angka total dan tabel kondisi (jumlah, persen) dengan baris total.
2. **Daftar Rinci:** 17 kolom (No, Kode Barang, No. Register, Nama Aset, Kategori, Subkategori, Merk/Tipe, Unit, Pemegang, Kondisi, Status, Tanggal Perolehan, Sumber Perolehan, Nilai Perolehan, Nilai Buku, No. Dokumen, Keterangan), header beku, baris total nilai perolehan dan nilai buku.
3. **Rekap Kategori:** kategori utama, subkategori di bawahnya (judul dijorok), dan baris total.
4. **Rekap Unit:** satu baris per unit dan total; sheet **tidak dibuat** bila cakupan user satu unit.
5. **Tren Tahunan:** tahun, jumlah, nilai perolehan, nilai buku, dan baris total.

**Kop setiap sheet:** lambang Kota Batam (`public/images/lambang-kota-batam.png`) di kiri atas, lalu teks tebal `PEMERINTAH KOTA BATAM`, `KECAMATAN SAGULUNG`, judul sheet; di bawahnya `Cakupan:`, `Filter:` (label manusiawi: kategori, dan kondisi sebagai label bukan nilai mentah), dan `Dicetak:`; baris header tabel dimulai di bawah kop. Seluruh sel teks ditulis sebagai string eksplisit (menjaga `0007`, kode barang, dan mencegah injeksi rumus); uang `#,##0`; tanggal `dd/mm/yyyy`; lebar kolom otomatis, kolom teks panjang dibungkus. Pembuatan kop dan gaya dipisah di helper agar dipakai ulang oleh laporan mutasi dan rusak-hilang kelak.

`ponytail:` workbook dibangun di memori lewat PhpSpreadsheet; aman sampai puluhan ribu baris.

## 5. Frontend

### 5.1 Dependensi
`npm install chart.js react-chartjs-2 chartjs-plugin-datalabels`. Komponen Chart.js mendaftarkan hanya elemen yang dipakai (`BarElement`, `ArcElement`, skala, `Tooltip`, `Legend`, plugin datalabels).

### 5.2 `Pages/LaporanAset/Index.tsx`
Memakai `AuthenticatedLayout`, breadcrumb Home › Laporan › Laporan Aset, judul halaman. Urutan blok dari atas:

1. **Filter + aksi:** Unit (hanya bila `units` tidak kosong; opsi "Semua unit" lalu Kecamatan dan kelurahan), Kategori, Kondisi, tombol "Terapkan filter", teks "N baris akan diunduh", dan tombol **Unduh Excel** (nonaktif bila nol atau filter di form belum diterapkan, mengikuti perilaku halaman Laporan yang sudah ada). Pesan galat validasi ditampilkan sebagai banner; `preserveState: 'errors'`.
2. **Ringkasan:** tiga kartu (Jumlah Aset, Total Nilai Perolehan, Total Nilai Buku), angka `tabular-nums`.
3. **Persentase per kondisi:** donat Chart.js dengan keterangan di sampingnya (warna semantik panduan: baik hijau, rusak ringan amber, rusak berat merah, hilang abu), daftar jumlah dan persen per kondisi.
4. **Tren per tahun perolehan:** `TrenAsetChart`, batang vertikal per tahun dengan tinggi = jumlah aset; label di atas batang berisi jumlah dan nilai perolehan dalam format ringkas (mis. `1,2 M`, locale `id-ID`); tooltip menampilkan nilai lengkap dalam rupiah dan nilai buku. Area grafik dapat digeser horizontal bila tahunnya banyak. Keadaan kosong: teks "Belum ada data".
5. **Rekap per kategori:** tabel kategori utama dengan subkategori menjorok, kolom Jumlah, Nilai Perolehan, Nilai Buku, baris Total.
6. **Rekap per unit:** tabel unit dan baris Total; hanya tampil bila `rekap_unit` bukan null.
7. **Daftar rinci:** tabel 10 kolom (No, Kode Barang, No. Register, Nama/Merk, Kategori, Unit, Tahun Perolehan, Kondisi, Nilai Perolehan, Nilai Buku); judul kolom yang bisa diurutkan dapat diklik (indikator arah, `aria-sort`); klik baris membuka baris detail (pemegang, status, sumber perolehan, no. dokumen, keterangan); paginasi 25 baris dengan nomor halaman (pagination helper yang ada). Badge kondisi memakai warna semantik panduan.

Semua angka dan label mengikuti `tabular-nums`, kartu `rounded-lg` tanpa bayangan, badge `rounded` (4px). Di HP: kartu satu kolom, tabel dan grafik dapat digeser horizontal. Warna dan teks grafik memenuhi kontras; label grafik tidak mengandalkan warna saja.

### 5.3 Komponen dan tipe
`Components/Charts/TrenAsetChart.tsx`, `Components/Charts/KondisiChart.tsx`; tipe `LaporanAsetData` dan `AssetRekapRow` di `types/index.d.ts`. Util format ringkas rupiah di `lib/format.ts`.

## 6. Pengujian (Pest)

- **`AssetRecapServiceTest`:** angka per role (Kasubag, Camat, admin kelurahan) dan per filter (unit, kategori induk, kondisi); persen kondisi berjumlah 100 (atau 0 bila kosong); tahun kosong diisi nol dan urut menaik; total ringkasan = total rekap kategori = total rekap unit = total tren; `rekap_unit` null untuk cakupan satu unit; kategori tanpa induk diperlakukan sebagai kategori utama.
- **`LaporanAsetControllerTest`:** props halaman; paginasi 25 baris; urutan dan whitelist (nilai di luar whitelist 422); `unit_id` di luar cakupan 422; tamu diarahkan ke login; `ringkasan.jumlah` sama dengan `asets.total`.
- **`LaporanAsetDownloadTest`:** file dibuka kembali; lima nama sheet (empat bila cakupan satu unit); kop (teks resmi, cakupan, filter berlabel) ada di setiap sheet; baris total tiap sheet sama dengan angka halaman; `0007` dan kode barang tetap teks; nama aset berawalan `=` tetap teks; nol baris 422; jenis `aset` tidak lagi dilayani oleh `/laporan/aset/unduh` (404).
- **Regresi:** `ReportDownloadTest` dan `ReportQueryTest` disesuaikan untuk jenis yang tersisa.
- **Frontend:** `tsc` dan build; cek UI manual (HP dan desktop, grafik, klik baris, unduh dan buka di Excel) menunggu perintah pemilik proyek.

## 7. Di Luar Cakupan
Filter lanjutan (rentang tahun perolehan, status, pemegang, sumber, pencarian), panel kelengkapan data, grafik di Excel, PDF/cetak, pemilih kolom, penggantian batang CSS dashboard dengan Chart.js, serta pemindahan Laporan Mutasi dan Laporan Rusak & Hilang ke route dan halaman sendiri.
