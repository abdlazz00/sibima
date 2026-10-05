# Desain: Pengurutan di Halaman Data Aset

Status: Menunggu review.
Tanggal: 2026-10-05

Menambah dropdown "Urutkan" di halaman Data Aset (`/assets`) supaya aset dapat diurutkan menurut tanggal ditambahkan dan beberapa kolom lain, tanpa mengubah urutan default yang sekarang.

---

## 1. Konteks & Tujuan

Permintaan klien setelah showcase: tabel Data Aset perlu diurutkan berdasarkan tanggal pembuatan data. Pengguna sekalian meminta opsi pengurutan lain yang berguna.

Kondisi kode saat ini:
- `EloquentAssetRepository::queryVisibleTo` memakai urutan tetap: `nama_aset`, `kode_barang`, `nomor_register`. Pengguna tidak bisa mengubahnya, sehingga aset yang baru diinput tenggelam di tengah daftar.
- Query yang sama dipakai oleh `AsetImporter::export` (dan `exportCount`), sehingga ekspor Excel otomatis mengikuti urutan query.
- Laporan Aset sudah punya pengurutan lewat header kolom dengan parameter `urut` dan `arah`; halaman Data Aset belum punya.
- Tabel `assets` sudah punya `created_at`, `tanggal_perolehan`, `nilai_perolehan`; tidak ada migrasi yang diperlukan.

Dua tanggal yang berbeda: `created_at` adalah kapan data masuk ke sistem ("tanggal ditambahkan"), sedangkan `tanggal_perolehan` adalah tanggal aset diperoleh. Keduanya ditawarkan, dengan nama yang tidak ambigu.

Tujuan:
1. Pengguna dapat mengurutkan Data Aset menurut tanggal ditambahkan, nama, tahun perolehan, nilai perolehan, dan kode BMD.
2. Urutan default tidak berubah (Nama A-Z).
3. Ekspor Excel dari halaman ini mengikuti urutan yang dipilih.
4. Perubahan sekecil mungkin: satu dropdown, satu daftar kunci urutan, tanpa migrasi.

Di luar cakupan: pengurutan lewat klik header kolom (pola Laporan Aset), pengurutan bertingkat oleh pengguna, menyimpan preferensi urutan per pengguna, dan pengurutan di halaman selain Data Aset.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Kontrol | Satu dropdown "Urutkan" di bar filter, sebagai kontrol keempat setelah Kategori, Unit, dan Kondisi. |
| Default | Tetap seperti sekarang: Nama A-Z (lalu kode barang, lalu nomor register). |
| Parameter | Satu parameter query `urut` bernilai kunci (bukan pasangan `urut`+`arah`), karena dropdown bersifat datar. |
| Nilai tak dikenal | Diam-diam jatuh ke default, tanpa error 422. |
| Ekspor | Mengikuti urutan yang dipilih, karena memakai query yang sama. |
| Pembeda | Setiap urutan diakhiri `id` agar hasil stabil (data hasil impor memiliki `created_at` hampir sama). |

---

## 3. Desain Backend

### 3.1 Daftar kunci urutan

`App\Models\Asset` mendapat konstanta `SORTS` (kunci => label dan urutan kolom) dan helper `sortOptions()` yang mengembalikan `[{value, label}]`, mengikuti pola `Kondisi::options()`.

| Kunci | Label | Urutan kolom |
|---|---|---|
| `nama_asc` (default) | Nama A-Z | `nama_aset`, `kode_barang`, `nomor_register` |
| `nama_desc` | Nama Z-A | `nama_aset` desc, `kode_barang`, `nomor_register` |
| `terbaru` | Terbaru ditambahkan | `created_at` desc, `id` desc |
| `terlama` | Terlama ditambahkan | `created_at` asc, `id` asc |
| `tahun_desc` | Tahun perolehan terbaru | `tanggal_perolehan` desc, `id` desc |
| `tahun_asc` | Tahun perolehan terlama | `tanggal_perolehan` asc, `id` asc |
| `nilai_desc` | Nilai perolehan tertinggi | `nilai_perolehan` desc, `id` desc |
| `nilai_asc` | Nilai perolehan terendah | `nilai_perolehan` asc, `id` asc |
| `kode` | Kode BMD | `kode_barang`, `nomor_register` |

### 3.2 Penerapan

- `EloquentAssetRepository::queryVisibleTo` mengganti tiga `orderBy` tetap dengan pengurutan yang dipilih dari `$filters['urut']` terhadap `Asset::SORTS`; kunci yang tidak ada di daftar memakai `nama_asc`.
- `AssetController::index` menambah `urut` ke `$request->only([...])` (sehingga ikut ke `filters` yang dikirim ke halaman dan ke `withQueryString`) dan mengirim `sortOptions` ke halaman.
- `ExportController::export` menambah `urut` ke `$request->only([...])`. Importer pegawai dan kategori tidak membaca `urut`, jadi tidak terpengaruh.
- `AsetImporter::export` memakai `lazy(500)` yang menghormati `orderBy` query; tidak perlu perubahan.
- Hak akses unit (`visibleTo`) dan semua filter yang ada tidak berubah.

### 3.3 Validasi

Tidak ada `FormRequest` baru. `urut` hanya dicocokkan terhadap daftar kunci di dalam repositori; nilai di luar daftar tidak pernah masuk ke SQL, jadi tidak ada risiko injeksi kolom.

---

## 4. Desain Frontend

- `Assets/Index.tsx`: tipe `Filters` bertambah `urut?: string`; props bertambah `sortOptions: { value: string; label: string }[]`.
- Satu `<select>` baru di bar filter dengan gaya yang sama seperti ketiga filter lain, `aria-label="Urutkan"`, nilai awal `filters.urut ?? 'nama_asc'`, opsi berlabel "Urutkan: {label}".
- Mengubah pilihan memanggil fungsi filter yang sudah ada, sehingga kembali ke halaman 1 dan filter lain tetap. Pagination yang ada (`{ ...filters, page }`) sudah membawa `urut`.
- Bar filter diubah ke grid yang menampung empat kontrol di layar lebar dan menumpuk di layar sempit.
- `ImportExportButtons` menerima `filters` yang kini memuat `urut`, sehingga ekspor mengikuti urutan layar.

---

## 5. Pengujian

Pest (SQLite `:memory:`), test ditulis lebih dulu, berkas baru `tests/Feature/AssetSortTest.php`:
- Setiap kunci mengurutkan dengan benar (nama, `created_at`, `tanggal_perolehan`, `nilai_perolehan`, kode).
- Urutan `terbaru` stabil ketika `created_at` sama (pembeda `id`).
- Tanpa `urut`, atau `urut` tidak dikenal, hasilnya sama dengan default.
- Urutan bertahan pada halaman 2 (`withQueryString`) dan bersama filter lain.
- Cakupan unit tidak berubah (pengguna hanya melihat aset unitnya, apa pun urutannya).
- Ekspor aset mengikuti `urut`.
- Halaman menerima `sortOptions` dengan sembilan opsi.
- Frontend: `npx tsc --noEmit` dan `npm run build`. Cek UI manual menunggu perintah pengguna.

---

## 6. Risiko & Catatan

- Data hasil impor Excel memiliki `created_at` hampir sama, jadi "Terbaru ditambahkan" di antara aset satu batch hanya bermakna sebagai satu kelompok; pembeda `id` menjaga urutan tetap stabil.
- Pengurutan menurut `nilai_perolehan`/`tanggal_perolehan` bergantung pada tipe kolom tanggal/desimal yang sudah ada; tidak ada indeks baru. Untuk puluhan ribu aset ini masih wajar karena sudah dibatasi `visibleTo` dan dipaginasi.
- Menambah opsi di masa depan cukup menambah satu baris di `Asset::SORTS`.
