# Desain: Laporan Mutasi (grup menu Laporan)

Status: Diimplementasikan (plan 2026-10-06-laporan-mutasi.md).
Tanggal: 2026-10-06

Bagian kedua dari restrukturisasi menu Laporan, setelah Laporan Aset (`2026-10-05-laporan-aset-design.md`). Laporan Aset Rusak & Hilang menyusul pada siklus terpisah. Penyederhanaan Excel Laporan Aset juga dibahas terpisah.

---

## 1. Konteks & Tujuan

Halaman tab lama `/laporan` untuk Mutasi hanya berisi filter dan jumlah baris. Tujuan: halaman **Laporan Mutasi** yang lengkap, rinci, dan mudah dibaca (ringkasan, komposisi, tren, arus antar unit, kinerja persetujuan, daftar rinci) dengan satu file Excel berisi daftar mutasi, semuanya dibatasi cakupan unit role.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Menu & route | Item **Laporan Mutasi** di grup LAPORAN, route datar `/laporan-mutasi` dan `/laporan-mutasi/unduh`. Tab Mutasi di `/laporan` lama dihapus. |
| Blok halaman | Ringkasan + komposisi, tren per bulan, arus antar unit, kinerja persetujuan, daftar rinci. |
| Filter | Tanggal mutasi (dari, sampai), Jenis, Status, **Unit Asal**, **Unit Tujuan** (terpisah). |
| Basis hitung | Angka perpindahan (aset berpindah, nilai, tren, arus) hanya dari mutasi berstatus **Disetujui**. Status lain tetap terlihat di komposisi status dan daftar rinci. |
| Grafik | Chart.js (donat dan bar), memakai pustaka yang sudah terpasang. |
| Excel | **Satu sheet "Daftar Mutasi"**, berkop lambang Kota Batam. Tidak ada sheet ringkasan, tren, atau rincian lain. |
| Cakupan | Mutasi tampil bila unit asal **atau** tujuannya ada di cakupan role. |
| Di luar cakupan | PDF, filter kategori aset, pencarian teks, salinan nilai aset saat mutasi, migrasi Laporan Rusak & Hilang, penyederhanaan Excel Laporan Aset. |

## 3. Navigasi dan Route

- `navigation.ts`: item `Laporan Mutasi` di grup `LAPORAN` diubah dari `/laporan?laporan=mutasi` menjadi `/laporan-mutasi`.
- `GET /laporan-mutasi` → `laporan-mutasi.index`; `GET /laporan-mutasi/unduh` → `laporan-mutasi.download`. Keduanya di grup `auth`.
- Halaman tab lama (`/laporan`, `report.index`, `/laporan/{laporan}/unduh`) hanya melayani `rusak-hilang`: `ReportRequest::PAGE_KINDS` menjadi `['rusak-hilang']`, default kind `rusak-hilang`, dan route unduh dibatasi `rusak-hilang`. Tab "Riwayat Mutasi" dihapus dari `Report/Index.tsx`.
- Kode mutasi di `ReportExporter` (kolom, judul, relasi) dihapus karena tidak lagi dipakai.

## 4. Backend

### 4.1 Filter di `ReportQuery` (jenis `mutasi`)
Kunci filter yang dikenali: `dari`, `sampai` (inklusif, `tanggal_mutasi`), `jenis_mutasi` (nilai `MutationType`), `status`, `asal_id` (`origin_unit_id`), `tujuan_id` (`destination_unit_id`). Cakupan role tetap dipasang lebih dulu: `origin_unit_id` atau `destination_unit_id` ada di `accessibleUnitIds()` (Kasubag tanpa batas). Kunci `unit_id` lama untuk mutasi dihapus. `asal_id` dan `tujuan_id` hanya mempersempit baris yang sudah dibatasi cakupan, sehingga tidak membuka data baru dan tidak perlu diperiksa terhadap cakupan.

### 4.2 `LaporanMutasiRequest`
Request baru (bukan `ReportRequest`, agar `jenis` rusak/hilang dan `urut` aset tidak bentrok):
- `dari`, `sampai` (`date`, `sampai` ≥ `dari`), `jenis_mutasi` (`Rule::enum(MutationType::class)`), `status` (`pending|approved|rejected|cancelled`), `asal_id` dan `tujuan_id` (`integer`, `exists:units,id`), `urut` (whitelist: `nomor_mutasi`, `tanggal_mutasi`, `jumlah_aset`, `nilai`, `status`; default `tanggal_mutasi`), `arah` (`asc|desc`, default `desc`).
- `authorize()`: user punya role. `filters()` mengembalikan hanya kunci yang terisi; `sorting()` mengembalikan `urut` dan `arah`.

### 4.3 `MutationRecapService::for(User $user, array $filters): array`
Memakai `ReportQuery::build('mutasi', $filters)` sebagai satu-satunya sumber cakupan dan filter (agregat dengan `reorder()->toBase()` dan join), portabel untuk SQLite dan MySQL (hanya `COUNT`, `SUM`, `COALESCE`, `GROUP BY`; pengelompokan bulan di PHP). Keluaran:

- `ringkasan`: `jumlah_mutasi` (semua status dalam filter), `disetujui` (jumlah mutasi Disetujui), `aset_berpindah` (jumlah item pada mutasi Disetujui), `nilai_perolehan` (float; jumlah `assets.nilai_perolehan` aset pada mutasi Disetujui), `rata_lama_proses` dan `terlama_proses` (hari, satu desimal, dari mutasi Disetujui; `null` bila tidak ada).
- `status`: empat entri (`pending`, `approved`, `rejected`, `cancelled`) berisi `status`, `label`, `jumlah`, `persen` (satu desimal, 0 bila kosong), dengan urutan tetap.
- `jenis`: empat entri `MutationType` dengan `jenis`, `label`, `jumlah`, `persen`.
- `tren`: per bulan (`bulan` = `YYYY-MM`) dengan `jumlah_mutasi` dan `aset_berpindah`, hanya mutasi Disetujui, urut menaik, bulan kosong diisi nol. Bila rentang bulan pertama sampai terakhir melebihi 60 bulan, bulan kosong tidak diisi (mencegah grafik rusak akibat tanggal salah ketik), seperti pada tren Laporan Aset.
- `arus`: `{baris: [{asal_id, asal, tujuan_id, tujuan, jumlah_mutasi, aset, nilai}], total{jumlah_mutasi, aset, nilai}}` dari mutasi Disetujui, urut aset menurun lalu nama asal.
- `masih_berjalan`: mutasi `pending` dalam filter, urut `created_at` menaik (terlama dulu), maksimal 20; tiap entri `id`, `nomor`, `jenis` (label), `asal`, `tujuan`, `langkah` (label langkah persetujuan saat ini dari snapshot), `menunggu` (nama user bila langkah bertipe user, selain itu label peran), `umur_hari` (hari sejak diajukan), `url` (`asset-mutations.show`). `jumlah_masih_berjalan` dikirim terpisah agar halaman dapat menyebut "20 dari N".

**Lama proses** = selisih dari `approval_requests.created_at` sampai `created_at` aksi `approve` terakhir pada permintaan itu, dalam hari (satu desimal). Kunci pada `approval_requests.approvable_type = (new AssetMutation)->getMorphClass()`.

Seluruh total saling sama untuk filter yang sama: jumlah entri `status` = `jumlah_mutasi`; jumlah entri `jenis` = `jumlah_mutasi`; total `arus` dan jumlah `tren` = angka perpindahan pada `ringkasan`.

### 4.4 `LaporanMutasiController`
- `index(LaporanMutasiRequest, MutationRecapService)` merender `LaporanMutasi/Index` dengan props `filters`, `sort`, `ringkasan`, `status`, `jenis`, `tren`, `arus`, `masih_berjalan`, `jumlah_masih_berjalan`, `mutasis` (paginator 25 baris, `withQueryString()`), `unitOptions`, `jenisOptions`, `statusOptions`.
- `unitOptions`: unit yang muncul sebagai asal atau tujuan pada mutasi dalam cakupan user (`id`, `name`, `type`), diurutkan jenis lalu nama. Kosong bila tidak ada mutasi.
- Baris `mutasis`: `id`, `nomor_mutasi`, `tanggal_mutasi`, `jenis` (nilai enum), `jenis_label`, `asal`, `tujuan`, `jumlah_aset`, `nilai` (float), `status`, `pengaju`, dan `detail`: `keterangan`, `aset` (`kode_barang`, `nama_aset`, `kategori`, `kondisi`, `nilai_perolehan`, `pemegang_tujuan`, `catatan`), `persetujuan` (`langkah`, `aksi`, `oleh`, `waktu`, `catatan`, urut waktu). `jumlah_aset` dan `nilai` dihitung dengan subquery pada query terpaginasi; relasi detail di-eager load (tanpa N+1).
- `unduh(...)`: nol baris → 422; selain itu mengirim berkas dari `MutationExcel`.

### 4.5 Excel: `MutationExcel`
Nama file `laporan-mutasi-{Y-m-d}.xlsx`, satu sheet `Daftar Mutasi`, memakai `ReportSheetWriter` yang sudah ada (kop, tabel, label cakupan dan filter). Kop: lambang Kota Batam di kiri, teks `PEMERINTAH KOTA BATAM`, `KECAMATAN SAGULUNG`, `Laporan Mutasi Aset`, lalu `Cakupan:`, `Filter:`, `Dicetak:`.

Tabel satu baris per mutasi, urut tanggal menurun lalu id menurun, kolom: No, Nomor Mutasi, Tanggal, Jenis, Unit Asal, Unit Tujuan, Jumlah Aset, Daftar Aset (`kode - nama`, satu per baris dalam sel, dibungkus), Nilai Perolehan, Status, Diajukan Oleh, Tanggal Diajukan, Tanggal Selesai, Lama Proses (hari), Keterangan (dibungkus). Dua baris total di bawah: **Total Semua Status** (jumlah aset dan nilai seluruh baris) dan **Total Disetujui** (hanya mutasi Disetujui; sama dengan `ringkasan.aset_berpindah` dan `ringkasan.nilai_perolehan`).

`Filter:` memuat label terbaca: jenis mutasi, status, unit asal, unit tujuan, rentang tanggal. `ReportSheetWriter::filterLabel()` diperluas untuk kunci `jenis_mutasi`, `asal_id`, `tujuan_id` (nama unit) tanpa mengubah perilaku kunci yang sudah ada. Teks ditulis sebagai string eksplisit; uang `#,##0`; tanggal `dd/mm/yyyy`; header beku.

`ponytail:` dibangun di memori lewat PhpSpreadsheet; aman sampai beberapa ribu mutasi. Di atas itu pindah ke penulis streaming.

## 5. Frontend

### 5.1 Komponen dan tipe
- `Components/Charts/KondisiChart.tsx` digeneralisasi menjadi `DonutChart` (props: `data: {label, jumlah, persen, color}[]`, label ARIA); halaman Laporan Aset memakai `DonutChart` dengan warna kondisi yang sama seperti sekarang. `KONDISI_COLOR` tetap diekspor dari berkas yang sama.
- `Components/Charts/TrenMutasiChart.tsx`: bar vertikal jumlah mutasi per bulan; label data berisi jumlah mutasi dan jumlah aset berpindah; tooltip lengkap; dapat digeser horizontal; tabel `sr-only` sebagai alternatif; keadaan kosong "Belum ada data."
- Tipe `LaporanMutasiData` dan `LaporanMutasiRow` di `types/index.d.ts`; format bulan di `lib/format.ts`.

### 5.2 `Pages/LaporanMutasi/Index.tsx`
`AuthenticatedLayout`, breadcrumb Home › Laporan › Laporan Mutasi. Urutan blok:

1. **Filter + aksi:** Dari, Sampai, Jenis, Status, Unit Asal, Unit Tujuan, "Terapkan filter", teks "N baris akan diunduh", tombol **Unduh Excel** (nonaktif bila nol atau filter di form belum diterapkan; banner galat validasi; `preserveState: 'errors'`).
2. **Ringkasan:** kartu Jumlah Mutasi, Mutasi Disetujui, Aset Berpindah, Nilai Perolehan Aset Berpindah, Rata-rata Lama Proses (hari; "—" bila kosong). Keterangan kecil "Aset berpindah dan nilai hanya menghitung mutasi Disetujui."
3. **Komposisi:** dua donat (status dan jenis) dengan daftar jumlah dan persen. Warna status: Disetujui hijau, Menunggu amber, Ditolak merah, Dibatalkan abu; warna jenis: empat nada biru/netral yang dapat dibedakan.
4. **Tren per bulan:** `TrenMutasiChart`.
5. **Arus antar unit:** tabel Unit Asal → Unit Tujuan (mutasi, aset, nilai) dengan baris Total; keadaan kosong.
6. **Kinerja persetujuan:** rata-rata dan terlama lama proses, serta tabel **Masih Berjalan** (Nomor yang menaut ke halaman mutasi, Jenis, Asal → Tujuan, Langkah, Menunggu, Umur); teks "menampilkan 20 dari N" bila lebih banyak.
7. **Daftar rinci:** tabel 10 kolom (No, Nomor, Tanggal, Jenis, Asal, Tujuan, Jumlah Aset, Nilai, Status, Pengaju), judul kolom yang bisa diurutkan (`aria-sort`), paginasi 25 baris (pagination helper yang ada); klik baris membuka detail: keterangan, daftar aset, dan riwayat persetujuan. Badge status memakai warna semantik panduan.

Gaya mengikuti panduan: `tabular-nums`, kartu `rounded-lg` tanpa bayangan, badge 4px. Di HP: kartu satu kolom, tabel dan grafik dapat digeser. Dilarang memakai `role="tablist"`/`role="tab"` (Preline `autoInit()` membajaknya). Warna dan keterangan grafik tidak mengandalkan warna saja.

## 6. Pengujian (Pest)

- **`MutationRecapServiceTest`:** angka per role (Kasubag, Camat, admin kelurahan yang hanya menyentuh satu sisi); filter asal, tujuan, jenis, status, dan tanggal inklusif; hanya Disetujui yang masuk angka perpindahan; tren dengan bulan kosong terisi nol dan batas 60 bulan; arus dan totalnya; lama proses rata-rata dan terlama dari waktu aksi yang dibuat manual; `masih_berjalan` (urutan terlama, batas 20, langkah dan pihak yang ditunggu untuk langkah bertipe peran dan user); total konsisten (status = jenis = `jumlah_mutasi`; arus dan tren = angka perpindahan); keluaran nol saat tidak ada data.
- **`LaporanMutasiControllerTest`:** props halaman; paginasi 25 baris; urutan di-whitelist (nilai lain 422); `sampai` lebih awal dari `dari` 422; `jenis_mutasi` tidak valid 422; tamu diarahkan ke login; admin kelurahan hanya melihat mutasi yang menyentuh unitnya dan filter asal atau tujuan hanya mempersempit; `unitOptions` memuat pihak lawan; baris detail berisi aset dan riwayat persetujuan; `mutasis.total` sama dengan jumlah baris unduhan.
- **`MutationExcelTest`:** berkas dibuka kembali; tepat satu sheet bernama `Daftar Mutasi`; kop ada; jumlah baris data sama dengan jumlah mutasi; baris Total Semua Status dan Total Disetujui benar; `Daftar Aset` berisi `kode - nama` per baris; nomor mutasi dan teks bernilai awalan `=` tetap teks; filter berlabel terbaca; nol baris 422; hanya cakupan user.
- **Regresi:** `ReportDownloadTest` dan test halaman lama disesuaikan agar hanya melayani Rusak & Hilang (`/laporan/mutasi/unduh` dan `?laporan=mutasi` kini 404 dan 422); `ReportQueryTest` untuk kunci filter mutasi yang baru; test Laporan Aset tetap hijau setelah `KondisiChart` menjadi `DonutChart` (verifikasi lewat `tsc` dan build).
- **Frontend:** `tsc` dan build. Cek UI manual (HP dan desktop, grafik, klik baris, unduh dan buka di Excel) menunggu perintah pemilik proyek.

## 7. Di Luar Cakupan
PDF/cetak, filter kategori aset, pencarian teks, salinan nilai aset saat mutasi, sheet tambahan di Excel, penyederhanaan Excel Laporan Aset, dan migrasi Laporan Rusak & Hilang.
