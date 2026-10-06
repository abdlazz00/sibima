# Desain Komponen Modal Tabel Pemilih Aset untuk Transaksi (Senior-Friendly UI/UX)

**Tanggal:** 2026-10-06  
**Status:** Validated  
**Author:** Pair Programming Antigravity & User  
**Tujuan:** Menggantikan input pemilihan aset berbasis dropdown `<select>` dan list sempit dengan komponen popup modal berbasis tabel data interaktif (`<AssetSelectModal>`) yang mudah digunakan oleh pegawai senior di seluruh fitur transaksi (Mutasi Aset, Pemenuhan Permohonan Aset, dan Laporan Kerusakan/Kehilangan).

---

## 1. Latar Belakang & Masalah

Pada modul transaksi SIBIMA:
1. **Mutasi Aset (`AssetMutations/Create.tsx`)**: Menggunakan `<select>` dropdown konvensional yang bertumpuk per baris kartu. Jika unit memiliki puluhan atau ratusan aset aktif, pegawai kesulitan mencari barang, teks mudah terpotong, dan untuk memutasikan 5 barang pegawai harus menekan tombol tambah baris dan memilih dari dropdown 5 kali berturut-turut.
2. **Pemenuhan Permohonan (`AssetRequests/Show.tsx`)**: Menggunakan listbox sempit vertikal dengan batas tinggi `max-h-64`. Informasi yang termuat terbatas dan sulit membedakan nomor register unit fisik.
3. **Lapor Rusak / Hilang (`AssetReports/Create.tsx`)**: Menggunakan `<select>` dropdown sederhana tanpa detail lengkap mengenai nomor register dan pemegang aset saat ini.

Sebagian besar pengguna sistem di tingkat kelurahan dan kecamatan adalah pegawai negeri senior. Antarmuka dropdown sempit menghadirkan kendala ergonomis (area klik terlalu kecil, keterbacaan rendah, dan risiko salah memilih unit fisik ber-register beda).

---

## 2. Solusi & Prinsip Desain

1. **Komponen Bersama `<AssetSelectModal>`**:
   Satu komponen modal popup terpusat berbasis tabel data aset yang dapat digunakan kembali di seluruh form transaksi.
2. **Senior-Friendly Ergonomics**:
   - Area klik lapang (*clickable entire table rows*), tidak memaksa pengguna harus mengeklik tepat di kotak kecil checkbox.
   - Tipografi jelas, kontras tinggi, dan badge warna yang intuitif untuk status kondisi barang (Hijau = Baik, Kuning = Rusak Ringan, Merah = Rusak Berat).
   - Kotak pencarian besar dan instan (*real-time client-side search*) yang mencari nama aset, kode barang, nomor register, merk, maupun nama pemegang tanpa jeda jaringan.
   - Paginasi lokal (10–15 baris per halaman) agar modal tidak lag dan mudah ditelusuri baris per baris.
   - Header & Footer *sticky* sehingga status jumlah aset terpilih dan tombol aksi *"Gunakan Aset Terpilih"* selalu terlihat tanpa harus menggulir ke dasar layar.
3. **Tabel Ringkasan Barang Terpilih di Form Utama**:
   Setelah aset dipilih dari modal, form transaksi menampilkan **Tabel Ringkasan Barang Terpilih** yang rapi menggantikan form kartu bertumpuk, lengkap dengan tombol untuk menambah/mengubah pilihan serta menghapus per baris.

---

## 3. Spesifikasi Komponen `<AssetSelectModal>`

### 3.1 Antarmuka Data (Interfaces)

File: `resources/js/Components/AssetSelectModal.tsx`

```typescript
export interface SelectableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type?: string | null;
    kondisi: string;
    holder?: string | null;
    unit_id?: number;
    unit_name?: string | null;
}

export interface AssetSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: SelectableAsset[];
    selectedIds: number[];
    onConfirm: (selected: SelectableAsset[]) => void;
    mode?: 'single' | 'multiple'; // default: 'multiple'
    maxSelection?: number;        // Batas maksimal pemilihan (opsional)
    title?: string;
    description?: string;
    disabledIds?: number[];       // Aset yang tidak dapat dipilih
}
```

### 3.2 Layout & Fitur Modal

1. **Dialog Shell**:
   - Backdrop semi-transparan dengan `z-50` dan transisi halus.
   - Kontainer modal ukuran lebar `max-w-4xl` atau `max-w-5xl`, tinggi maksimal `max-h-[85vh]` fleksibel.
2. **Sticky Header**:
   - Judul jelas (contoh: *"Pilih Aset untuk Dimutasi"*).
   - Deskripsi petunjuk (contoh: *"Centang aset yang ingin dipindahkan, lalu klik Simpan Pilihan."*).
   - Tombol tutup silang `(X)` besar dengan keyboard shortcut `Escape`.
3. **Toolbar Pencarian & Info**:
   - Input teks pencarian dengan ikon kaca pembesar, placeholder: `"Cari berdasarkan nama aset, kode barang, no. register, merk..."`.
   - Tombol cepat untuk mengosongkan teks pencarian jika terisi.
   - Info counter hasil pencarian: *"Menampilkan X aset"*.
4. **Tabel Data Aset**:
   - Kolom 1 (**Pilih**): Checkbox (mode multiple) atau Radio button (mode single) ukuran nyaman `h-4.5 w-4.5`.
   - Kolom 2 (**Kode & Register**): Kode barang di baris atas, badge `Reg. #0001` di baris bawah.
   - Kolom 3 (**Nama Aset & Merk**): Nama aset dicetak tebal (`font-semibold text-slate-900`), merk/tipe di bawahnya (`text-xs text-slate-500`).
   - Kolom 4 (**Kondisi**): Badge status kontras (`Baik`, `Rusak Ringan`, `Rusak Berat`).
   - Kolom 5 (**Pemegang Saat Ini**): Nama pegawai yang memegang atau badge netral *"Inventaris Unit"*.
   - **Interaksi Baris**: Mengklik sembarang area baris akan otomatis mencentang/memilih baris tersebut. Baris yang terpilih diberi highlight warna latar biru muda lembut (`bg-blue-50/60`).
5. **Paginasi Lokal**:
   - Menampilkan 10 atau 15 baris per halaman.
   - Navigasi tombol `"Sebelumnya"` dan `"Berikutnya"` yang jelas dengan indikator halaman `"Halaman X dari Y"`.
6. **Sticky Footer**:
   - Kiri: Counter status: **`X aset dipilih`** (jika ada `maxSelection`, contoh: *"Pilih tepat 3 aset (2/3 dipilih)"*).
   - Kanan:
     - Tombol sekunder **`Batal`**.
     - Tombol primer **`Gunakan X Aset Terpilih`** (warna biru `#1E40AF`, disabled jika 0 aset dipilih atau melanggar kuota `maxSelection`).

---

## 4. Integrasi di Halaman Transaksi

### 4.1 Mutasi Aset (`resources/js/Pages/AssetMutations/Create.tsx`)
- **Mode Modal**: `multiple`.
- **Daftar Aset Modal**: `availableAssets` (difilter berdasarkan `origin_unit_id` dan kondisi aktif).
- **Alur Antarmuka Form**:
  1. *Empty state*: Kotak bergaris putus-putus dengan tombol besar **`[ + Buka Daftar & Pilih Aset ]`** disertai info jumlah aset tersedia di unit asal.
  2. *Populated state*:
     - Toolbar atas: Info *"Total X aset akan dimutasi"* dan tombol **`[ + Tambah / Ubah Pilihan Aset ]`**.
     - **Tabel Ringkasan Barang Terpilih**:
       - Kolom Identitas Barang (Nama, Kode, Register, Merk).
       - Kolom Pemegang Asal (Readonly, dari aset).
       - Kolom Pemegang Baru (Dropdown pegawai unit tujuan).
       - Kolom Catatan (Input teks singkat per barang).
       - Kolom Aksi (Tombol Hapus baris).
  3. *Perubahan Unit Asal*: Menampilkan konfirmasi untuk mengosongkan aset terpilih jika unit asal diubah agar tidak terjadi inkonsistensi data antar unit.

### 4.2 Pemenuhan Permohonan Aset (`resources/js/Pages/AssetRequests/Show.tsx`)
- **Mode Modal**:
  - Permohonan Pegawai: `single`.
  - Permohonan Unit: `multiple` dengan `maxSelection = assetRequest.jumlah`.
- **Daftar Aset Modal**: `eligibleAssets` (aset di unit pemenuh dalam subkategori terkait yang belum memiliki pemegang).
- **Alur Antarmuka Form**:
  - Tombol **`[ Buka Daftar Aset untuk Dipenuhi ]`** membuka `<AssetSelectModal>`.
  - Setelah dikonfirmasi, aset terpilih tampil dalam tabel ringkasan pemenuhan dengan tombol **`[ Ganti Pilihan ]`**.
  - Tombol **`[ Serahkan ke Pegawai ]`** atau **`[ Ajukan Mutasi Pemenuhan ]`** diaktifkan sesuai kuota pemenuhan.

### 4.3 Lapor Kerusakan / Kehilangan (`resources/js/Pages/AssetReports/Create.tsx`)
- **Mode Modal**: `single`.
- **Daftar Aset Modal**: `assets` yang dapat dilaporkan di unit pengguna.
- **Alur Antarmuka Form**:
  - Tombol **`[ + Pilih Aset yang Dilaporkan ]`** membuka modal.
  - Setelah dipilih, menampilkan **Panel Ringkasan Aset Terpilih** (Nama, Kode, Register, Merk, Kondisi Saat Ini, Pemegang) lengkap dengan tombol **`[ Ganti Aset ]`**.
  - Kolom jenis laporan, kondisi baru, kronologi, dan foto bukti tetap diisi di bawahnya.

---

## 5. Perubahan Backend (Controller & Props)

1. **`app/Http/Controllers/AssetReportController.php` (Method `create`)**:
   Menambahkan `'nomor_register' => $a->nomor_register` pada pemetaan array `$assets`.
2. **`app/Http/Controllers/AssetRequestController.php` (Method `show`)**:
   Menambahkan `'nomor_register' => $a->nomor_register` pada pemetaan array `'eligibleAssets'`.
3. **`app/Http/Controllers/AssetMutationController.php` (Method `create`)**:
   Model `Asset` sudah dimuat penuh via Eloquent dan sudah menyertakan `nomor_register`.

---

## 6. Rencana Pengujian & Kriteria Keberhasilan

1. **Backend Testing (Pest PHP)**:
   - `tests/Feature/AssetReportControllerTest.php`: Memverifikasi properti `nomor_register` terkirim pada props `assets`.
   - `tests/Feature/AssetRequestControllerTest.php`: Memverifikasi properti `nomor_register` terkirim pada props `eligibleAssets`.
   - `tests/Feature/AssetMutationControllerTest.php`: Memverifikasi proses pembuatan mutasi multi-item tetap tersimpan sempurna dengan data pemegang baru dan catatan.
2. **Frontend Type Safety & Build**:
   - `npx tsc --noEmit` wajib lulus 0 error.
   - `npm run build` berhasil melakukan kompilasi bundel aset Vite dalam waktu < 4 detik.
3. **Full Regression**:
   - `php artisan test` seluruh suite lulus 100%.
