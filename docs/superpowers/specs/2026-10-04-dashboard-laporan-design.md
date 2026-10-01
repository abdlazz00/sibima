# Desain: Dashboard Rekap & Laporan Excel

Status: Diimplementasikan (plan 2026-10-04-dashboard-laporan.md).
Tanggal: 2026-10-04

---

## 1. Konteks & Tujuan

`/dashboard` saat ini hanya sapaan. Spec utama (§i Modul Pendukung) dan dokumen RBAC mensyaratkan dashboard rekap per role serta laporan Excel. Tujuan:

- **Dashboard:** rekap aset (jumlah, kondisi, kategori, per unit, nilai), antrean kerja, dan aktivitas terbaru, semuanya mengikuti cakupan unit role.
- **Laporan:** halaman terpisah untuk mengunduh Excel: daftar aset, riwayat mutasi, aset rusak & hilang.

Cakupan data memakai aturan yang sudah ada (`User::accessibleUnitIds()`, `Asset::visibleTo`): Kasubag semua unit, Camat kecamatan beserta kelurahan binaan, Admin Kecamatan unit kecamatan, Admin Kelurahan dan Lurah unit kelurahan sendiri.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Isi dashboard | Rekap aset, antrean kerja, aktivitas terbaru, nilai aset. |
| Laporan | Daftar aset, riwayat mutasi, aset rusak & hilang. Rekap per kategori/unit tidak dibuat sebagai laporan Excel (sudah ada di dashboard). |
| Lokasi laporan | Menu "Laporan" terpisah di sidebar; dashboard tidak memuat panel unduh. |
| Unit | Tabel rekap per unit selalu menampilkan seluruh cakupan; filter unit (hanya bila cakupan > 1 unit) menyaring kartu dan batang. |
| Grafik | Batang horizontal dari CSS, tanpa library grafik. |
| Library Excel | `phpoffice/phpspreadsheet` langsung (tanpa `maatwebsite/excel`); dipakai lagi untuk import Excel di Sprint 5. |
| Akses | Dashboard dan Laporan untuk semua role yang login, dibatasi cakupan unit. |

## 3. Dashboard

### 3.1 `DashboardService::for(User $user, ?int $unitId): array`
Satu kelas yang menghitung semua angka dengan query agregat (`COUNT/SUM ... GROUP BY`), tanpa memuat seluruh aset ke memori. `unitId` hanya berlaku bila termasuk cakupan user dan cakupan lebih dari satu unit; selain itu diabaikan (cakupan penuh dipakai), sehingga unit di luar cakupan tidak pernah bocor.

Keluaran:
- `totals`: `jumlah_aset`, `nilai_perolehan`, `nilai_buku` (jumlah aset dengan `kondisi = hilang` tetap terhitung).
- `per_kondisi`: jumlah per `Kondisi` (empat nilai, nol bila kosong).
- `per_kategori`: kategori utama (induk dari subkategori) dengan `jumlah` dan `nilai_buku`, urut jumlah menurun.
- `per_unit`: seluruh unit dalam cakupan (tidak terpengaruh filter unit) dengan `jumlah`, rincian empat kondisi, `nilai_buku`; `null` bila cakupan hanya satu unit.
- `antrean`: `persetujuan_menunggu` (nilai `ApprovalWorkflowService::pendingFor` untuk user), `permohonan_menunggu_pemenuhan` (permohonan `approved` tanpa `mutation_id` yang dapat dipenuhi user lewat `AssetRequestService::canFulfill`), `laporan_pending` dan `mutasi_pending` (status `pending` di cakupan; mutasi bila unit asal atau tujuan dalam cakupan).
- `aktivitas`: 10 entri `asset_histories` terbaru dengan `unit_id` dalam cakupan: nama aset, event, pelaku, waktu. Tidak ada keterangan bebas.
- `units`: unit yang boleh dipilih untuk filter (kosong bila cakupan satu unit).

### 3.2 Route dan halaman
- `GET /dashboard` (route `dashboard` yang ada) memanggil `DashboardController`, mengirim hasil service ke `Pages/Dashboard.tsx`. Query `?unit_id=`.
- Halaman: kartu total, kondisi dan nilai di atas; batang kondisi dan kategori; tabel per unit; kartu antrean dengan tautan (`/persetujuan`, `/asset-requests?menunggu_pemenuhan=1`, `/asset-reports?status=pending`, `/asset-mutations` (indeks mutasi belum punya filter status)); daftar aktivitas. Mobile-first, `lg` dua kolom. Sapaan nama/role tetap ada di header.

## 4. Laporan Excel

### 4.1 Route
- `GET /laporan` -> `report.index`: halaman filter dengan parameter `laporan` (`aset`|`mutasi`|`rusak-hilang`, default `aset`; bukan `jenis`, yang sudah menjadi filter laporan rusak-hilang) dan filter jenis tersebut di query string; prop `rowCount` dihitung server dari filter.
- `GET /laporan/{laporan}/unduh` -> `report.download`: mengunduh xlsx; 404 untuk jenis tak dikenal; 422 bila `rowCount = 0`.

### 4.2 Filter (divalidasi `ReportRequest`)
| Jenis | Filter |
|---|---|
| aset | `unit_id` (dalam cakupan), `category_id`, `kondisi` |
| mutasi | `dari`, `sampai` (tanggal mutasi), `unit_id` (cocok unit asal atau tujuan, dalam cakupan), `status` |
| rusak-hilang | `dari`, `sampai` (tanggal kejadian), `unit_id`, `jenis` (rusak/hilang), `status` |

`unit_id` di luar cakupan: respons 422 (bukan diabaikan), agar pengguna tahu filternya tidak berlaku. `sampai` tidak boleh lebih awal dari `dari`.

### 4.3 `ReportQuery`
Satu-satunya tempat cakupan dan filter diterapkan. Metode per jenis mengembalikan `Builder`: `aset()` (`Asset::visibleTo`), `mutasi()` (mutasi dengan `origin_unit_id` atau `destination_unit_id` dalam cakupan), `rusakHilang()` (laporan dengan `unit_id` dalam cakupan). Dipakai oleh halaman (untuk `count()`) dan oleh unduhan (untuk isi file), sehingga angka di halaman sama dengan isi file.

### 4.4 Kolom
- **Daftar aset:** No, Kode Barang, No. Register, Nama Aset, Kategori, Subkategori, Merk/Tipe, Unit, Pemegang, Kondisi, Status, Tanggal Perolehan, Sumber Perolehan, Nilai Perolehan, Nilai Buku, No. Dokumen, Keterangan.
- **Riwayat mutasi:** No, Nomor Mutasi, Jenis, Unit Asal, Unit Tujuan, Tanggal, Status, Jumlah Aset, Daftar Aset (`kode - nama`, dipisah baris baru), Diajukan Oleh, Keterangan.
- **Aset rusak & hilang:** No, Nomor Laporan, Aset, Kode Barang, Unit, Jenis, Kondisi Baru, Tanggal Kejadian, Status, Pelapor, Pemegang, Kronologi.

Data nilai finansial hanya tampil di Daftar aset, mengikuti cakupan role.

### 4.5 `ReportExporter` (PhpSpreadsheet)
Satu sheet. Baris 1-4: judul laporan, cakupan (nama unit atau "Seluruh unit"), filter aktif, tanggal cetak. Baris 6: header tebal dengan latar, baris beku di bawahnya, lebar kolom diatur, nilai uang `#,##0`, tanggal `dd/mm/yyyy`, teks panjang (keterangan, kronologi, daftar aset) dibungkus. Nama file `laporan-{jenis}-{Y-m-d}.xlsx`. Respons di-stream sebagai unduhan.

`ponytail:` penulisan dibangun di memori lewat PhpSpreadsheet; aman sampai puluhan ribu baris, di atasnya pindah ke penulisan streaming (`chunk` + writer streaming).

### 4.6 Halaman `Pages/Report/Index.tsx`
Pemilih jenis (tab), form filter sesuai jenis (filter unit hanya bila cakupan > 1 unit), teks "N baris akan diunduh", tombol **Unduh Excel** (tautan GET biasa, nonaktif bila nol). Filter dikirim lewat `router.get` dengan `preserveState`. Memakai `AuthenticatedLayout`.

## 5. Navigasi dan Akses
- Item "Laporan" di sidebar untuk semua role (`/laporan`, ikon baru `bar-chart` di `NavIcon`). Dashboard tetap di grup UTAMA.
- Tidak ada Policy khusus: otorisasi adalah cakupan unit di `DashboardService` dan `ReportQuery`. Semua role login boleh membuka, dan hasilnya selalu terbatas cakupan.

## 6. Dependensi
Tambah `phpoffice/phpspreadsheet` (composer). Memerlukan ekstensi PHP `zip` dan `gd` (gd sudah dipakai untuk QR); `zip` diperiksa saat implementasi.

## 7. Pengujian (Pest)
- **Dashboard:** untuk tiap role (Kasubag, Camat, Admin Kecamatan, Admin Kelurahan, Lurah) dengan data lintas unit: total, kondisi, kategori, nilai, per unit, dan antrean sesuai cakupan. Filter unit dalam cakupan menyaring kartu tapi tidak tabel per unit; filter di luar cakupan diabaikan tanpa membocorkan unit lain. Aktivitas maksimal 10, hanya unit dalam cakupan, urut terbaru. Cakupan satu unit: `per_unit` null dan `units` kosong.
- **Laporan:** file dibuka kembali dengan PhpSpreadsheet: judul, header, jumlah dan isi baris, total nilai untuk tiap jenis; baris unit lain tidak ada. Setiap filter menyaring dengan benar (kategori induk menyertakan subkategori, tanggal inklusif, mutasi cocok asal atau tujuan). `rowCount` di halaman sama dengan jumlah baris data di file. Filter unit di luar cakupan 422; jenis tak dikenal 404; `rowCount = 0` pada unduhan 422.
- **Frontend:** `tsc`, build, cek manual (HP dan desktop, buka file di Excel).

## 8. Di Luar Cakupan
Laporan rekap per kategori/unit sebagai file, ekspor PDF, jadwal/pengiriman laporan otomatis, grafik interaktif, filter tanggal pada dashboard, perbandingan antar periode, dan import Excel (Sprint 5).
