# Desain Perbaikan Penomoran Kode Barang & Nomor Register Penerimaan Aset

- **Dokumen**: `docs/superpowers/specs/2026-10-05-penerimaan-aset-kode-barang-register-design.md`
- **Tanggal**: 2026-10-05
- **Status**: Draft (Menunggu Review Pengguna)
- **Topik**: Perbaikan penetapan `kode_barang` dan `nomor_register` pada alur persetujuan Berita Acara Penerimaan Aset serta peningkatan UX input nama aset.

---

## 1. Latar Belakang & Masalah

### 1.1 Masalah di Lapangan
Pada Berita Acara Penerimaan Aset, satu baris item penerimaan dapat memiliki jumlah unit fisik lebih dari 1 (`jumlah_unit > 1`). Misalnya: item **"Laptop asus #1"** dengan `jumlah_unit = 5`.

Saat Berita Acara tersebut disetujui (*final approval*) oleh Camat, aset fisik di-generate ke tabel `assets`. Namun ditemukan kejanggalan kritis:
1. **Nomor register kembar semua**: Seluruh 5 unit laptop mendapatkan `nomor_register: 1` (ditampilkan di label/tabel sebagai `0001` atau `001`).
2. **Kode barang terpecah di setiap unit**: Setiap laptop malah diberi `kode_barang` baru yang berbeda-beda (`.005`, `.006`, `.007`, `.008`, `.009`).

### 1.2 Akar Masalah (*Root Cause*)
Pada [`app/Services/PenerimaanAsetEffect.php`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/app/Services/PenerimaanAsetEffect.php#L38-L46):

```php
$suffix = $this->assets->maxKodeBarangSuffix($category->code);

for ($i = 0; $i < $item->jumlah_unit; $i++) {
    $suffix++; // <-- Increment dilakukan di dalam loop per unit fisik
    $kodeBarang = $category->code.'.'.str_pad((string) $suffix, 3, '0', STR_PAD_LEFT);
    $noDokumenSeq++;

    $asset = $this->assets->create([
        'kode_barang' => $kodeBarang,
        'nomor_register' => $this->assets->maxRegisterNumber($kodeBarang) + 1,
        ...
```

Di dalam loop per unit fisik, `$suffix` bertambah 1 setiap kali iterasi. Akibatnya:
- Setiap unit fisik dianggap sebagai entitas kode klasifikasi barang baru.
- Karena `$kodeBarang` selalu baru dan belum pernah tersimpan di database, panggilan `$this->assets->maxRegisterNumber($kodeBarang)` selalu mengembalikan `0`.
- Hasilnya `0 + 1 = 1` untuk setiap unit fisik.

Bahkan file pengujian terdahulu [`tests/Feature/PenerimaanAsetEffectTest.php`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/tests/Feature/PenerimaanAsetEffectTest.php#L50-L64) menulis ekspektasi yang keliru (mengharuskan 3 unit AC menghasilkan 3 kode barang berbeda `.001`, `.002`, `.003`).

### 1.3 Standar Penatausahaan BMD (Berdasarkan File Master Excel)
Pemeriksaan pada [`docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx) membuktikan:
- **`Kode Barang KIB`**: Menunjukkan **klasifikasi jenis barang** di bawah subkategori.
  - Contoh: Seluruh unit `Lap Top` (baik Asus, Lenovo, maupun Acer) memiliki kode barang yang sama: `1.3.2.10.01.02.002`.
  - Seluruh unit `Printer` (Epson, HP) memiliki kode barang yang sama: `1.3.2.10.02.03.003`.
  - Seluruh unit `Pick Up` (Suzuki, Toyota) memiliki kode barang yang sama: `1.3.2.02.01.03.002`.
- **`Nomor Register`**: Menunjukkan nomor urut unit fisik untuk jenis barang tersebut (1, 2, 3, 4, 5...).
- **Integritas Database**: Sesuai skema tabel `assets`, terdapat indeks unik `unique(['kode_barang', 'nomor_register'])`.

---

## 2. Tujuan & Sasaran Perbaikan

1. **Satu Kode Barang per Item Penerimaan**: Seluruh unit fisik dalam 1 baris item Berita Acara Penerimaan harus berbagi satu `kode_barang` yang sama.
2. **Nomor Register Berurutan Unik**: Unit fisik ke-1 s.d. ke-N mendapatkan nomor register berurutan (`+1, +2, ..., +N`) tanpa duplikasi.
3. **Pencocokan Otomatis Barang Lama**: Jika barang yang diterima memiliki `nama_aset` yang sudah ada di bawah subkategori terkait, sistem otomatis memakai `kode_barang` yang sudah ada dan melanjutkan nomor register dari urutan tertinggi sebelumnya.
4. **UX Input Nama Aset (Datalist / Autocomplete)**: Form penerimaan aset menyediakan saran nama aset yang sudah terdaftar di subkategori yang dipilih agar operator mudah memilih nama baku dan meminimalkan variasi pengetikan liar.
5. **Perbaikan Data Historis**: Memperbaiki data contoh `Laptop asus #1` (ID 332–336) di database lokal agar memiliki satu `kode_barang` dengan nomor register urut 1–5.

---

## 3. Desain Teknis Arsitektur

### 3.1 Logika Backend (`PenerimaanAsetEffect.php`)

Untuk setiap `$item` di `$approvable->items`:

```
                 +---------------------------------------------+
                 | Baca $item->category_id & $item->nama_aset  |
                 +---------------------------------------------+
                                        |
                                        v
                 +---------------------------------------------+
                 | Cari aset di category_id dengan nama sama?  |
                 +---------------------------------------------+
                                /               \
                        [Ya]   /                 \  [Tidak / Barang Baru]
                              v                   v
     +--------------------------------+   +------------------------------------+
     | Pakai kode_barang yang ada     |   | Ambil maxKodeBarangSuffix(prefix)  |
     | $kodeBarang = $existing->kode  |   | $suffix = $maxSuffix + 1           |
     +--------------------------------+   | $kodeBarang = "$prefix.$suffix"   |
                                          +------------------------------------+
                                      \   /
                                       \ /
                                        v
                 +---------------------------------------------+
                 | $baseRegister = maxRegisterNumber($kode)    |
                 +---------------------------------------------+
                                        |
                                        v
                 +---------------------------------------------+
                 | Loop $i dari 0 s.d. ($item->jumlah_unit - 1)|
                 | - nomor_register = $baseRegister + $i + 1   |
                 | - Buat record Asset & AssetHistory         |
                 +---------------------------------------------+
```

Detail implementasi:
1. **Pencarian Kode Barang Eksisting**:
   - Query: `Asset::where('category_id', $item->category_id)->whereRaw('LOWER(TRIM(nama_aset)) = ?', [strtolower(trim($item->nama_aset))])->value('kode_barang')`.
   - Menggunakan `TRIM` dan `LOWER` untuk toleransi spasi ekstra dan kapitalisasi.
2. **Penentuan Suffix Baru (Jika Belum Ada)**:
   - Jika belum ada, panggil `$this->assets->maxKodeBarangSuffix($category->code) + 1`.
   - Kode barang baru dibentuk: `$category->code . '.' . str_pad($newSuffix, 3, '0', STR_PAD_LEFT)`.
3. **Penetapan Nomor Register Berurutan**:
   - Ambil `$startRegister = $this->assets->maxRegisterNumber($kodeBarang)`.
   - Untuk setiap `$i = 0; $i < $item->jumlah_unit; $i++`:
     - `$nomorRegister = $startRegister + $i + 1;`
     - Simpan record aset dengan `$kodeBarang` dan `$nomorRegister`.
     - No. dokumen aset tetap menggunakan sequence dokumen penerimaan: `$approvable->no_berita_acara . '-' . str_pad((string) ++$noDokumenSeq, 3, '0', STR_PAD_LEFT)`.

### 3.2 Desain Antarmuka & UX Form Penerimaan (`PenerimaanForm.tsx`)

#### Permasalahan Saat Ini:
Kolom `nama_aset` saat ini hanyalah input teks bebas tanpa panduan. Operator sering menulis variasi seperti `"Laptop asus #1"`, `"Laptop Asus"`, padahal standar KIB adalah `"Lap Top"`.

#### Solusi UX:
1. **Data Suggestions dari Backend**:
   - Di `PenerimaanAsetController@create` dan `@edit`, sertakan pemetaan nama aset unik per kategori:
     `$existingAssetNames = Asset::select('category_id', 'nama_aset')->distinct()->orderBy('nama_aset')->get()->groupBy('category_id')->map(fn($group) => $group->pluck('nama_aset'));`
2. **HTML5 `<datalist>` Dinamis pada Input Nama Aset**:
   - Setiap baris item diikat ke `<datalist id={`suggestions-${index}`}>`.
   - Ketika operator memilih `category_id` (misal *Peralatan Personal Komputer*), opsi datalist menampilkan nama-nama barang yang sudah ada di kategori tersebut.
   - **Kelebihan `<datalist>`**:
     - *Zero heavy library*: Menggunakan standar web native tanpa menambah dependensi external npm.
     - *Dual flexibility*: Pengguna bisa langsung memilih dari dropdown saran pencarian (autocomplete), atau tetap bebas mengetik nama baru jika barang tersebut memang belum pernah ada.
3. **Klarifikasi Kolom Merek/Tipe**:
   - Di bawah input `nama_aset`, berikan placeholder jelas: `"Contoh: Lap Top, P.C Unit, Printer"`.
   - Pada kolom `merk_type`, berikan placeholder: `"Contoh: Asus Vivobook 14, Epson L3210"`.

---

## 4. Perbaikan Data Eksisting (Data Patch)

Aset ID 332 s.d. 336 ("Laptop asus #1") yang saat ini ada di database lokal:
- Dilakukan update satu kali (bisa via migration patch atau command perbaikan):
  - Ubah `kode_barang` menjadi seragam: `1.3.2.10.02.03.005`.
  - Ubah `nomor_register` menjadi urut: `1, 2, 3, 4, 5`.
  - Selaraskan `nama_aset` menjadi seragam (`Laptop asus #1`).

---

## 5. Rencana Pengujian (*Testing Strategy*)

### 5.1 Unit & Feature Tests (`PenerimaanAsetEffectTest.php`)
1. **Pengujian 1 Item Multi-Unit**:
   - Penerimaan 1 item dengan `jumlah_unit = 3` menghasilkan 3 record aset dengan `kode_barang` yang **sama** dan `nomor_register` yang **berurutan** (`1, 2, 3`).
2. **Pengujian Penerimaan Lanjutan Barang yang Sama**:
   - Jika sudah ada aset dengan nama dan kategori sama (misal register 1 s.d. 3), penerimaan baru sebanyak 2 unit harus menggunakan `kode_barang` yang sama dan nomor register berlanjut ke `4` dan `5`.
3. **Pengujian Barang Berbeda di Kategori yang Sama**:
   - Item A ("AC Split", qty 2) dan Item B ("Kulkas", qty 2) dalam kategori yang sama menghasilkan dua `kode_barang` berbeda, masing-masing dengan nomor register 1 s.d. 2.
4. **Verifikasi Full Test Suite**:
   - Menjalankan seluruh 578+ tes untuk memastikan tidak ada efek samping ke modul mutasi, scan, permohonan, atau laporan.

---

## 6. Pertanyaan / Review Gate

Dokumen spesifikasi ini telah siap. Mohon ditinjau apakah alur pencocokan kode barang, penomoran register, dan UX input datalist ini sudah sesuai sebelum kita lanjutkan ke pembuatan rencana implementasi.
