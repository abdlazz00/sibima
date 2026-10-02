# Desain: Dashboard Enhancement & Chart.js Visualizations

Status: Disetujui (siap diimplementasikan).  
Tanggal: 2026-10-07  

Peningkatan halaman utama (Dashboard) SIBIMA untuk menghadirkan visualisasi data interaktif berbasis pustaka Chart.js, tren aktivitas transaksi 6 bulan terakhir, serta panel aktivitas transaksi terbaru bertab (Penerimaan, Mutasi, Rusak/Hilang, dan Permohonan).

---

## 1. Konteks & Tujuan

Sebelumnya, halaman `Dashboard` (`resources/js/Pages/Dashboard.tsx`) menampilkan data statistik aset menggunakan progress bar HTML manual (`<div style={{ width: '...' }}>`) yang statis dan kaku. Selain itu, daftar "Transaksi Terbaru" hanya mengambil data dari mutasi dan penerimaan, mengabaikan transaksi permohonan aset dan laporan kerusakan/kehilangan.

Tujuan dari spesifikasi ini:
1. Mengganti seluruh visualisasi bar HTML lama dengan komponen grafik **Chart.js** yang modern, interaktif, responsif, dan konsisten dengan modul laporan yang sudah ada.
2. Menyajikan 4 grafik analitik utama dalam grid 2x2:
   - **Komposisi Kondisi Aset** (*Donut Chart*).
   - **Top Kategori Aset** (*Horizontal Bar Chart*).
   - **Sebaran Aset per Unit Kerja** (*Stacked Bar Chart*).
   - **Tren Transaksi Bulanan** (*Grouped Bar Chart* 6 bulan terakhir).
3. Memperluas widget aktivitas terbaru menjadi panel bertab (*Semua*, *Penerimaan*, *Mutasi*, *Rusak & Hilang*, *Permohonan*) dengan tautan langsung ke detail dokumen.
4. Menjaga kepatuhan aksesibilitas dan memastikan integrasi bebas dari konflik skrip (khususnya *Preline UI*).
5. Mempertahankan hak akses dan *unit scoping* (Kecamatan & Kelurahan) yang ketat per peran pengguna.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| **Pustaka Visualisasi** | Menggunakan pustaka Chart.js (`react-chartjs-2`, `chart.js`, `chartjs-plugin-datalabels`) yang sudah terpasang di proyek. |
| **Grafik Dashboard (Grid 2x2)** | 1. **DonutChart**: Kondisi aset (*Baik*, *Rusak Ringan*, *Rusak Berat*, *Hilang*).<br>2. **KategoriAsetChart**: Top kategori aset (*horizontal bar*).<br>3. **SebaranUnitChart**: Distribusi aset per unit kerja (*stacked bar* kondisi baik vs bermasalah).<br>4. **TrenAktivitasChart**: Tren aktivitas transaksi 6 bulan terakhir (*grouped bar* 4 jenis transaksi). |
| **Aktivitas Transaksi Bertab** | Tab interaktif: `Semua`, `Penerimaan`, `Mutasi`, `Rusak & Hilang`, `Permohonan`. Setiap tab memiliki indikator hitung data. |
| **Cakupan Transaksi** | Menggabungkan 4 transaksi SIBIMA: `BeritaAcaraPenerimaan`, `AssetMutation`, `AssetReport`, `AssetRequest`. |
| **Kepatuhan Preline UI** | Pengalihan tab diimplementasikan dengan state murni React (`useState`), **tanpa** atribut `role="tablist"` atau `role="tab"` untuk mencegah pembajakan event oleh `autoInit()` Preline. |
| **Unit Scoping** | Filter dropdown unit kerja tetap berfungsi reaktif: memilih kelurahan tertentu akan menyaring seluruh metrik, grafik, dan aktivitas transaksi ke unit tersebut. |

---

## 3. Backend (`app/Services/DashboardService.php`)

### 3.1 Agregasi Tren Transaksi Bulanan (`trenAktivitas`)

Menambahkan metode untuk menghitung frekuensi transaksi dalam rentang 6 bulan terakhir (bulan saat ini mundur 5 bulan):

```php
/**
 * @param  list<int>  $scopeIds
 * @return list<array{bulan: string, penerimaan: int, mutasi: int, rusak_hilang: int, permohonan: int}>
 */
public function trenAktivitas(array $scopeIds, int $months = 6): array
```

- **Query**:
  - `penerimaan`: `BeritaAcaraPenerimaan` dengan `unit_id IN ($scopeIds)` dan `status = submitted`.
  - `mutasi`: `AssetMutation` dengan `origin_unit_id IN ($scopeIds) OR destination_unit_id IN ($scopeIds)`.
  - `rusak_hilang`: `AssetReport` dengan `unit_id IN ($scopeIds)`.
  - `permohonan`: `AssetRequest` dengan `unit_id IN ($scopeIds)`.
- Mengembalikan array terisi penuh berurutan kronologis, nilai 0 jika tidak ada kejadian pada bulan terkait.

### 3.2 Ekspansi Transaksi Terbaru (`transaksi`)

Mengambil masing-masing hingga 5 rekaman terbaru dari 4 entitas di dalam cakupan unit:
1. `AssetMutation`: `nomor_mutasi`, `asal → tujuan`, `tanggal_mutasi`, status.
2. `BeritaAcaraPenerimaan`: `no_berita_acara`, unit penerima, `tanggal_penerimaan`, status.
3. `AssetReport`: `nomor_laporan`, nama aset, `tanggal_kejadian`, kondisi & status.
4. `AssetRequest`: `nomor_permohonan`, unit pemohon, `tanggal_permohonan`, status.

Struktur output ternormalisasi:
```php
[
    'id' => (string|int),
    'jenis' => 'penerimaan'|'mutasi'|'rusak_hilang'|'permohonan',
    'nomor' => (string),
    'ringkasan' => (string),
    'tanggal' => (string|null),
    'status' => (string),
    'status_label' => (string),
    'url' => (string),
    'created_at' => (string),
]
```

---

## 4. Komponen Frontend (`resources/js/Components/Charts/`)

### 4.1 `DonutChart.tsx` (Reuse)
Menampilkan proporsi kondisi fisik aset:
- `baik`: `#047857` (Emerald-700)
- `rusak_ringan`: `#B45309` (Amber-700)
- `rusak_berat`: `#B91C1C` (Red-700)
- `hilang`: `#4B5563` (Slate-600)
- Menampilkan legend di bawah chart berisi jumlah dan persentase.

### 4.2 `KategoriAsetChart.tsx` (Baru)
Grafik horizontal (`indexAxis: 'y'`) untuk menampilkan 6–8 kategori aset terbanyak:
- Label sumbu Y: Nama kategori aset.
- Nilai batang: Jumlah aset.
- Tooltip: Jumlah unit aset dan total nilai buku (`rupiah(nilai_buku)`).

### 4.3 `SebaranUnitChart.tsx` (Baru)
Grafik *Stacked Bar* untuk sebaran aset per unit kerja (Kecamatan Sagulung & Kelurahan):
- Kategori sumbu X: Nama unit kerja.
- Stack 1 (Bawah): Kondisi Baik (Warna `#047857`).
- Stack 2 (Atas): Bermasalah (Rusak/Hilang, Warna `#B91C1C`).
- Jika mode single-unit aktif, menampilkan rincian kondisi unit tersebut secara elegan.

### 4.4 `TrenAktivitasChart.tsx` (Baru)
Grafik batang multi-dataset (*grouped bar*) aktivitas operasional 6 bulan terakhir:
- Label X: Label bulan (`bulanLabel(bulan)`).
- Dataset 1: Penerimaan Aset (`#2563EB`, Biru).
- Dataset 2: Mutasi Aset (`#4F46E5`, Indigo).
- Dataset 3: Rusak & Hilang (`#DC2626`, Merah).
- Dataset 4: Permohonan Aset (`#D97706`, Amber).
- Legend interaktif yang dapat diklik untuk menyaring dataset tertentu.
- Aksesibilitas: Tabel tersembunyi `sr-only` yang memetakan data per bulan.

---

## 5. Halaman `Dashboard.tsx`

Struktur tata letak:
1. **Header & Context Bar**:
   - Greeting, role badge, unit badge, unit switcher dropdown.
2. **Prioritas Approval**:
   - Alert banner peringatan berkas menunggu persetujuan (khusus pejabat approver).
3. **Aksi Cepat**:
   - 4 Tombol aksi cepat sesuai wewenang role pengguna.
4. **4 Kartu KPI Ringkasan**:
   - *Total Aset*, *Total Nilai Aset* (caption nilai buku), *Aset Baik* (% badge), *Aset Rusak/Hilang* (% badge).
5. **4 Kartu Antrean Operasional**:
   - *Persetujuan Menunggu*, *Permohonan Menunggu Pemenuhan*, *Laporan Rusak Pending*, *Mutasi Pending*.
6. **Grid Grafik 2x2**:
   - Kolom 1 Baris 1: `DonutChart` (Kondisi Aset).
   - Kolom 2 Baris 1: `KategoriAsetChart` (Top Kategori Aset).
   - Kolom 1 Baris 2: `SebaranUnitChart` (Sebaran Aset per Unit).
   - Kolom 2 Baris 2: `TrenAktivitasChart` (Tren Transaksi 6 Bulan).
7. **Panel Aktivitas Transaksi Terbaru (Tabbed)**:
   - Tab navigasi: `Semua`, `Penerimaan`, `Mutasi`, `Rusak & Hilang`, `Permohonan`.
   - Menggunakan state React (`activeTab`), tidak ada reload halaman.
   - Tabel responsif (desktop) dan kartu ringkas (mobile).
   - Link langsung menuju detail masing-masing transaksi (`show` page).

---

## 6. Rencana Pengujian

1. **`DashboardTest.php`**:
   - Verifikasi status 200 untuk peran `kasubag`, `camat`, dan `admin_kelurahan`.
   - Verifikasi kelengkapan props Inertia: `dashboard.totals`, `dashboard.per_kondisi`, `dashboard.per_kategori`, `dashboard.per_unit`, `dashboard.tren_aktivitas`, `dashboard.transaksi`, `dashboard.antrean`, `dashboard.units`.
   - Verifikasi data `tren_aktivitas` tepat berjumlah 6 entri bulan berurutan.
   - Verifikasi data `transaksi` mencakup jenis `penerimaan`, `mutasi`, `rusak_hilang`, dan `permohonan`.
   - Verifikasi filter `unit_id` mengisolasi perhitungan metrik sesuai unit yang dipilih.
2. **TypeScript & Bundling**:
   - `npx tsc --noEmit` lolos tanpa error.
   - `npm run build` sukses melakukan kompilasi bundel aset.
3. **Pest Regression Test**:
   - Menjalankan seluruh test suite (`php artisan test`) untuk memastikan seluruh fungsionalitas aplikasi tetap 100% lulus.
