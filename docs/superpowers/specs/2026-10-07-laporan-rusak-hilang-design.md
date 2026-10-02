# Desain: Laporan Rusak & Hilang (grup menu LAPORAN)

Status: Disetujui (siap diimplementasikan).  
Tanggal: 2026-10-07  

Bagian ketiga dan penutup dari restrukturisasi menu LAPORAN (setelah Laporan Aset `2026-10-05-laporan-aset-design.md` dan Laporan Mutasi `2026-10-06-laporan-mutasi-design.md`). Modul ini menggantikan sisa tab pada halaman `/laporan` lama dan memensiunkan seluruh controller/request peninggalan tersebut.

---

## 1. Konteks & Tujuan

Sebelumnya, halaman `/laporan` hanya menyajikan form filter unduh sederhana tanpa pratinjau data interaktif. Setelah Laporan Aset dan Laporan Mutasi dipindahkan ke rute mandiri (`/laporan-aset` dan `/laporan-mutasi`), pelaporan aset rusak dan hilang masih tertinggal sebagai sisa tab di `/laporan?laporan=rusak-hilang`.

Tujuan spesifikasi ini:
1. Menyediakan halaman **Laporan Rusak & Hilang** mandiri di `/laporan-rusak-hilang` yang komprehensif, cepat, mudah dipahami, dan interaktif.
2. Menyajikan visualisasi data kerusakan dan kehilangan: kartu ringkasan dampak finansial (nilai perolehan dan nilai buku), dua donat komposisi (status dan kondisi/insiden), grafik tren insiden per bulan, tabel sebaran kerusakan/kehilangan antar-unit, daftar laporan yang masih berjalan (*in-flight*), serta tabel daftar rinci dengan baris yang dapat dibuka (*expandable*).
3. Menyediakan ekspor Excel satu sheet **"Daftar Rusak & Hilang"** berkop resmi Lambang Kota Batam, siap digunakan untuk pertanggungjawaban penatausahaan BMD.
4. Menegakkan otorisasi wilayah (*dual-layer unit scoping*) secara ketat per peran pengguna.
5. Memensiunkan seluruh peninggalan kode lama (`/laporan`, `ReportController`, `ReportRequest`, `Report/Index.tsx`, dan method lama di `ReportExporter`).

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| **Menu & Route** | Item menu sidebar **Laporan Rusak & Hilang** di grup `LAPORAN`, route `/laporan-rusak-hilang` (halaman) dan `/laporan-rusak-hilang/unduh` (ekspor Excel). Rute `/laporan` lama dihapus total. |
| **Blok Halaman** | Filter lengkap, kartu ringkasan, dua grafik donat (Status & Kondisi/Insiden), grafik tren insiden bulanan, tabel sebaran per unit, panel antrean persetujuan (masih berjalan), dan tabel daftar rinci yang dapat diurutkan. |
| **Filter** | Rentang tanggal kejadian (`dari`, `sampai`), Kondisi/Insiden (`kondisi`: Rusak Ringan, Rusak Berat, Hilang), Status Persetujuan (`status`: Pending, Approved, Rejected, Cancelled), Unit Kerja (`unit_id`), dan Kategori Aset (`category_id`). |
| **Valuasi & Basis Hitung** | Angka dampak finansial (nilai perolehan & nilai buku pada ringkasan, tren, dan rekap unit) dihitung dari laporan yang berstatus **Disetujui** (`approved`). Status lain tetap terlihat pada komposisi status dan tabel daftar rinci. |
| **Grafik** | Chart.js (`react-chartjs-2`, memanfaatkan pustaka yang sudah ada: komponen `DonutChart` dan komponen bar chart). |
| **Excel** | **Satu sheet "Daftar Rusak & Hilang"**, berkop resmi lambang Kota Batam, nomor dokumen dan kode barang aman sebagai teks, nilai uang diformat rupiah `#,##0`, dilengkapi baris "Total Semua Status" dan "Total Disetujui". |
| **Pembersihan Kode** | `ReportController.php`, `ReportRequest.php`, `Report/Index.tsx`, serta method ekspor lama dihapus sepenuhnya dari codebase. |
| **Di Luar Cakupan** | Cetak dokumen berita acara fisik per insiden sebagai PDF, pengajuan penghapusan buku inventaris (SK Penghapusan BMD / write-off berjenjang). |

---

## 3. Navigasi dan Route

### 3.1 Navigasi (`resources/js/config/navigation.ts`)
Item menu `Laporan Rusak & Hilang` diperbarui tautannya:
```typescript
{ label: 'Laporan Rusak & Hilang', href: '/laporan-rusak-hilang', icon: 'alert-triangle' },
```

### 3.2 Rute (`routes/web.php`)
Di dalam grup middleware `auth`:
- `GET /laporan-rusak-hilang` $\rightarrow$ `LaporanRusakHilangController@index` (nama rute: `laporan-rusak-hilang.index`)
- `GET /laporan-rusak-hilang/unduh` $\rightarrow$ `LaporanRusakHilangController@unduh` (nama rute: `laporan-rusak-hilang.download`)
- Rute lama `/laporan` dan `/laporan/{laporan}/unduh` dihapus.

---

## 4. Backend

### 4.1 Filter di `ReportQuery` (jenis `rusak-hilang`)
Menyempurnakan `ReportQuery::build('rusak-hilang', $filters)`:
- Scoping wilayah: `asset_reports.unit_id` dibatasi `accessibleUnitIds()` pengguna (Kasubag bebas tanpa batas; Camat: unit kecamatan + kelurahan; Admin/Lurah: unit sendiri).
- Filter yang didukung:
  - `dari` & `sampai`: Tanggal kejadian (`tanggal_kejadian`).
  - `kondisi`: Menggunakan enum `Kondisi` (`rusak_ringan`, `rusak_berat`, `hilang`). Mengingat model `AssetReport` menyimpan `kondisi_baru`, filter mencocokkan `asset_reports.kondisi_baru`.
  - `status`: Nilai enum `AssetReportStatus` (`pending`, `approved`, `rejected`, `cancelled`).
  - `unit_id`: Filter unit kerja pemilik aset (dibatasi oleh cakupan role user).
  - `category_id`: Filter kategori aset melalui relasi aset (`assets.category_id` atau kategori induknya).

### 4.2 Form Request: `LaporanRusakHilangRequest`
Menyediakan validasi dan pembersihan parameter input:
- `dari`, `sampai`: Tanggal valid (`date`), `sampai` harus $\ge$ `dari`.
- `kondisi`: `Rule::enum(Kondisi::class)` (hanya menerima `rusak_ringan`, `rusak_berat`, `hilang`).
- `status`: `Rule::enum(AssetReportStatus::class)`.
- `unit_id`: `integer`, `exists:units,id`.
- `category_id`: `integer`, `exists:asset_categories,id`.
- `urut`: Whitelist: `nomor_laporan`, `tanggal_kejadian`, `nama_aset`, `kondisi_baru`, `nilai_perolehan`, `nilai_buku`, `status` (default: `tanggal_kejadian`).
- `arah`: `asc` atau `desc` (default: `desc`).
- Method pembantu: `filters()` (mengembalikan array filter bersih) dan `sorting()` (mengembalikan urut & arah).

### 4.3 Service: `AssetReportRecapService::for(User $user, array $filters): array`
Menghasilkan struktur data analitik siap saji dengan kueri teragregasi yang portabel antara SQLite dan MySQL:
- `ringkasan`:
  - `jumlah_laporan`: Total seluruh laporan dalam filter.
  - `disetujui`: Jumlah laporan yang berstatus `approved`.
  - `nilai_perolehan`: Akumulasi nilai perolehan aset dari laporan yang disetujui (`float`).
  - `nilai_buku`: Akumulasi nilai buku aset dari laporan yang disetujui (`float`).
  - `rata_lama_proses`: Rata-rata hari pemrosesan approval (dari pengajuan hingga approve akhir), dibulatkan di akhir satu desimal.
  - `terlama_proses`: Lama proses terpanjang dalam hari.
- `status`: Array 4 status (`pending`, `approved`, `rejected`, `cancelled`) lengkap dengan `status`, `label`, `jumlah`, dan `persen`.
- `kondisi`: Array 3 kondisi insiden (`rusak_ringan`, `rusak_berat`, `hilang`) lengkap dengan `kondisi`, `label`, `jumlah`, dan `persen`.
- `tren`: Agregasi bulanan (`bulan` format `YYYY-MM`), jumlah laporan disetujui dan nilai perolehan, urut menaik.
- `sebaran_unit`: Matriks unit kerja dalam cakupan user, memuat `id`, `name`, `jumlah_rusak`, `jumlah_hilang`, `total_laporan`, dan `nilai_buku_terdampak`, plus baris `total`. Bernilai `null` jika cakupan user hanya satu unit kerja.
- `masih_berjalan`: Daftar hingga 20 laporan berstatus `pending` terlama, berisi `id`, `nomor`, `kondisi_label`, `nama_aset`, `unit`, `pemegang`, `langkah` (label langkah persetujuan aktif), `menunggu` (nama/peran approver), `umur_hari`, dan `url` ke halaman show transaksi.
- `jumlah_masih_berjalan`: Total keseluruhan laporan pending untuk indikator "Menampilkan 20 dari N".

### 4.4 Controller: `LaporanRusakHilangController`
- `index(LaporanRusakHilangRequest $request, AssetReportRecapService $recap)`:
  - Mengambil data rekapitulasi dan paginasi daftar rinci (25 baris per halaman, `withQueryString()`).
  - Mengirim opsi dropdown: `unitOptions`, `categoryOptions`, `kondisiOptions`, `statusOptions`.
  - Merender halaman `Inertia::render('LaporanRusakHilang/Index', [...])`.
- `unduh(LaporanRusakHilangRequest $request, AssetReportExcel $excel)`:
  - Membangun kueri laporan berdasarkan filter.
  - Memvalidasi data tidak kosong (mengembalikan 422 bila 0 baris).
  - Mengembalikan `StreamedResponse` berkas `.xlsx` dengan nama `laporan-rusak-hilang-{Y-m-d}.xlsx`.

### 4.5 Excel: `AssetReportExcel`
Memanfaatkan `ReportSheetWriter` untuk menulis berkas Excel standar:
- Sheet tunggal: **"Daftar Rusak & Hilang"**.
- Kop resmi: Lambang Kota Batam, teks instansi, judul laporan, cakupan unit, filter aktif, dan tanggal cetak.
- Kolom tabel (16 kolom):
  1. No
  2. No. Laporan
  3. Tanggal Kejadian
  4. Kode Barang
  5. Nama Aset
  6. Merk / Tipe
  7. Kategori
  8. Unit Kerja
  9. Pemegang Aset
  10. Jenis Laporan
  11. Kondisi Dilaporkan
  12. Nilai Perolehan
  13. Nilai Buku
  14. Status Persetujuan
  15. Tanggal Selesai
  16. Kronologi / Catatan
- Baris Total:
  - **Total Semua Status**: Jumlah baris laporan.
  - **Total Disetujui**: Menghitung jumlah aset disetujui, akumulasi nilai perolehan, dan akumulasi nilai buku (tervalidasi sama persis dengan angka di kartu ringkasan).

---

## 5. Frontend (`resources/js/Pages/LaporanRusakHilang/Index.tsx`)

Struktur halaman diurutkan secara hierarkis:
1. **Header & Breadcrumb**: `Home › Laporan › Laporan Rusak & Hilang`.
2. **Formulir Filter**:
   - Kontrol input: Tanggal Dari, Tanggal Sampai, Kondisi, Status, Unit Kerja (jika multi-unit), Kategori Aset.
   - Semua input memiliki `<label htmlFor="...">` dan `<select id="...">` demi kepatuhan aksesibilitas (a11y).
   - Tombol *Terapkan filter*, teks *N baris akan diunduh*, dan tombol *Unduh Excel* (dinonaktifkan jika form belum diterapkan atau data 0).
3. **5 Kartu Statistik Ringkasan**:
   - Total Laporan
   - Laporan Disetujui
   - Nilai Perolehan Terdampak
   - Nilai Buku Terdampak
   - Rata-rata Lama Proses
4. **Grid Grafik Komposisi (2 Kolom)**:
   - DonutChart Komposisi per Status Persetujuan.
   - DonutChart Komposisi per Kondisi Insiden (warna: amber untuk rusak ringan, merah untuk rusak berat, slate untuk hilang).
5. **Grafik Tren Insiden per Bulan**:
   - `TrenInsidenChart` (grafik batang bulanan laporan yang disetujui).
6. **Matriks Sebaran Unit Kerja**:
   - Tabel ringkasan unit (Kecamatan & Kelurahan), menampilkan jumlah rusak, jumlah hilang, dan total nilai buku terdampak.
7. **Panel Antrean Masih Berjalan**:
   - Tabel laporan berstatus pending yang sedang menunggu persetujuan pejabat/atasan unit.
8. **Daftar Rinci Interaktif**:
   - Tabel sortable 10 kolom dengan paginasi 25 baris.
   - Baris dapat diklik (*expandable*) untuk membuka rincian kronologi, foto bukti insiden (bila ada), dan linimasa riwayat persetujuan.

---

## 6. Rencana Pengujian (Pest)

1. **`AssetReportRecapServiceTest`**:
   - Verifikasi scoping unit per role (Kasubag, Camat, Admin Kelurahan).
   - Verifikasi akurasi filter rentang tanggal kejadian, kondisi, status, unit, dan kategori.
   - Verifikasi perhitungan nilai finansial hanya mengambil laporan yang berstatus `approved`.
   - Verifikasi total entri status dan kondisi sama dengan total laporan.
2. **`LaporanRusakHilangControllerTest`**:
   - Verifikasi akses route terproteksi autentikasi.
   - Verifikasi pengiriman seluruh props ke Inertia.
   - Verifikasi validasi whitelist pengurutan (`urut`) dan filter (`unit_id` di luar cakupan $\rightarrow$ 422).
3. **`LaporanRusakHilangDownloadTest`**:
   - Verifikasi unduh file `.xlsx` dengan kop resmi dan sheet tunggal.
   - Verifikasi angka baris total cocok dengan angka ringkasan halaman.
   - Verifikasi respon 422 jika data 0.
4. **Pembersihan Rute Lama**:
   - Verifikasi rute `/laporan` lama sudah tidak dapat diakses (404).
5. **Frontend Build Check**:
   - `npx tsc --noEmit` dan `npm run build` lulus tanpa error.

---

## 7. Di Luar Cakupan

- Penerbitan Surat Keputusan (SK) Penghapusan BMD / pemusnahan aset.
- Integrasi langsung ke SIPD / SIMDA BMD.
