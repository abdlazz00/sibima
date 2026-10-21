# Spesifikasi Desain Fitur: Log Aktivitas Sistem (Audit Trail)

**Tanggal:** 21 Oktober 2026  
**Status:** Disetujui (Approved)  
**Target Rilis:** SIBIMA v1.1.0  
**Akses:** Eksklusif Super Admin (`role:super-admin`)

---

## 1. Ringkasan & Tujuan

Fitur **Log Aktivitas Sistem (Audit Trail)** dirancang untuk memberikan visibilitas penuh kepada **Super Admin** terhadap seluruh aktivitas dan perubahan data yang terjadi di dalam SIBIMA.

Sistem melacak secara otomatis:
1. **Siapa** yang melakukan aksi (*Causer*: nama user, role, IP address, dan user agent).
2. **Kapan** aksi dilakukan (*Timestamp* presisi).
3. **Data apa** yang terpengaruh (*Subject*: Aset, Pegawai, Berita Acara, Kategori, Mutasi, Akun User, Role, Alur Persetujuan).
4. **Apa** yang berubah (*Event*: Dibuat, Diperbarui, Dihapus) beserta perbandingan detail nilai lama vs nilai baru (*Diff Inspector*).

---

## 2. Arsitektur & Lapisan Data (Data Layer)

### 2.1 Package & Konfigurasi
* Menggunakan package industri resmi: `spatie/laravel-activitylog`.
* Tabel penyimpanan terpusat: `activity_log`.
* File konfigurasi: `config/activitylog.php`.

### 2.2 Kebijakan Retensi & Pembersihan Otomatis (90 Hari)
Untuk menjaga performa database MySQL dan kapasitas memori VPS (4 GB RAM, buffer pool 512 MB):
* **Batas Retensi:** Log disimpan selama **90 hari**.
* **Pembersihan Otomatis:** Konfigurasi `'delete_records_older_than_days' => 90`.
* **Penjadwalan Cron:** Pada `routes/console.php`:
  ```php
  Schedule::command('activitylog:clean')->dailyAt('02:00');
  ```
  *(Dijalankan setiap hari pukul 02:00 WIB oleh cron container SIBIMA).*

### 2.3 Model yang Dilacak & Konfigurasi Trait
Setiap model menerapkan trait `Spatie\Activitylog\Traits\LogsActivity` dengan konfigurasi:
* `logOnlyDirty()`: Hanya mencatat jika ada atribut yang benar-benar berubah.
* `dontSubmitEmptyLogs()`: Mencegah penulisan baris log kosong.

Daftar model dan field yang dilacak:
1. **`App\Models\Asset`**:
   - Kolom: `name`, `code`, `register_number`, `asset_category_id`, `unit_id`, `user_id`, `condition`, `status`, `book_value`, `acquisition_price`, `acquisition_date`, `source`.
   - Log Name: `asset`.
2. **`App\Models\Pegawai`**:
   - Kolom: `nama`, `nip`, `pangkat_golongan`, `jabatan`, `status_kepegawaian`, `unit_id`, `no_hp`, `email_dinas`.
   - Log Name: `pegawai`.
3. **`App\Models\User`**:
   - Kolom: `name`, `email`, `is_active`, `unit_id`, `unit_scope_override`.
   - **Aturan Keamanan:** Kolom `password` dan `remember_token` **MUTLAK DIKECUALIKAN** dari logging.
   - Log Name: `user`.
4. **`App\Models\AssetCategory`**:
   - Kolom: `name`, `code`, `parent_id`.
   - Log Name: `kategori`.
5. **`App\Models\BeritaAcaraPenerimaan`**:
   - Kolom: `nomor_surat`, `tanggal`, `rekanan`, `unit_id`, `status`.
   - Log Name: `berita-acara`.
6. **`App\Models\AssetMutation` & `App\Models\AssetReport`**:
   - Kolom: `nomor_mutasi` / `nomor_laporan`, `unit_asal_id`, `unit_tujuan_id`, `status`.
   - Log Name: `mutasi` / `laporan`.
7. **`App\Models\WorkflowDefinition` & `App\Models\WorkflowStep`**:
   - Kolom: `name`, `is_active`, `step_order`, `role_id`, `action`.
   - Log Name: `alur`.
8. **`App\Models\Role`**:
   - Kolom: `name`, relasi permissions.
   - Log Name: `role`.

---

## 3. Lapisan Aplikasi & Logika Bisnis (Backend)

### 3.1 Routing & Akses
* **URL:** `/pengaturan/log-aktivitas`
* **Route Name:** `activity-logs.index`
* **Middleware:** `['auth', 'verified']`
* **Policy / Gate:** Hanya user dengan role `super-admin` yang diizinkan (`abort_unless(auth()->user()->hasRole('super-admin'), 403)`).

### 3.2 Controller (`App\Http\Controllers\ActivityLogController`)
Menangani query pagination dengan eager loading `causer` dan `subject`:
* **Pencarian Bebas (`q`):** Mencari pada deskripsi, nama pelaku, atau nama objek.
* **Filter Modul (`modul`):** Menyaring berdasarkan `log_name` (`asset`, `pegawai`, `user`, dsb.).
* **Filter Aksi (`event`):** `created`, `updated`, `deleted`.
* **Filter Pelaku (`causer_id`):** ID user tertentu.
* **Filter Waktu (`start_date`, `end_date`):** Rentang tanggal ISO.
* **Pagination:** 15 log per halaman.

### 3.3 Smart Diff Presenter (`App\Services\ActivityLogPresenter`)
Menerjemahkan data JSON teknis menjadi teks Bahasa Indonesia yang informatif:
* Menerjemahkan nama field:
  - `name` $\rightarrow$ *"Nama"*
  - `condition` $\rightarrow$ *"Kondisi Fisik"*
  - `status` $\rightarrow$ *"Status Operasional"*
  - `unit_id` $\rightarrow$ *"Unit Penempatan"*
  - `book_value` $\rightarrow$ *"Nilai Buku"*
  - `is_active` $\rightarrow$ *"Status Akun"*
* Mengurai foreign key:
  - `unit_id: 3` $\rightarrow$ Menampilkan nama unit aslinya: *"Kelurahan Sungai Pelunggut"*.
  - `category_id: 5` $\rightarrow$ Menampilkan nama kategorinya: *"Alat Kantor"*.
* Mengurai boolean/enum:
  - `is_active: false` $\rightarrow$ *"Nonaktif"*.
  - `is_active: true` $\rightarrow$ *"Aktif"*.

---

## 4. Lapisan Antarmuka Pengguna (Frontend)

### 4.1 Menu Navigasi Sidebar (`resources/js/Layouts/AuthenticatedLayout.tsx`)
* Ditambahkan pada grup menu **PENGATURAN**.
* Diberi ikon riwayat/audit (*ClockRewind / Activity*).
* Dilindungi kondisi `auth.user.roles.includes('super-admin')`.

### 4.2 Halaman Utama (`resources/js/Pages/ActivityLogs/Index.tsx`)
* **Header:** Judul, deskripsi, dan total rekaman log.
* **Filter Bar:**
  - Input teks pencarian (*Search*).
  - Select Modul.
  - Select Aksi (*Created / Updated / Deleted*).
  - Input Tanggal Mulai & Tanggal Akhir.
  - Tombol Reset Filter.
* **Tabel Riwayat:**
  - Kolom Waktu: Tanggal format Indonesia + waktu relatif (*"15 menit yang lalu"*).
  - Kolom Pelaku: Nama, Avatar/Inisial, Badge Role.
  - Kolom Aksi: Badge warna hijau (*Dibuat*), biru (*Diperbarui*), merah (*Dihapus*).
  - Kolom Target: Nama objek & badge modul.
  - Kolom Rincian: Tombol *"Lihat Perubahan"*.
* **Pagination:** Navigasi halaman Inertia standar.

### 4.3 Modal Dialog Diff Inspector
* Muncul saat tombol *"Lihat Perubahan"* ditekan.
* Menampilkan informasi ringkas subjek & pelaku.
* Tabel 3 Kolom:
  1. **Kolom / Informasi** (nama field manusiawi).
  2. **Nilai Lama** (highlight merah lembut untuk data sebelum diedit).
  3. **Nilai Baru** (highlight hijau lembut untuk data setelah diedit).
* Jika aksi adalah **Dibuat (Created)**, modal menampilkan seluruh data awal yang diinput.
* Jika aksi adalah **Dihapus (Deleted)**, modal menampilkan rincian data sebelum dihapus.

---

## 5. Rencana Pengujian (Testing Strategy)

Menggunakan Pest Feature Tests (`tests/Feature/ActivityLogTest.php`):
1. **Otorisasi:**
   - Super Admin dapat mengakses `/pengaturan/log-aktivitas`.
   - Role Kasubag, Camat, Pengurus Barang, dan Staf mendapatkan respons `403 Forbidden`.
2. **Pencatatan Model Events:**
   - Membuat Aset baru menghasilkan log dengan event `created`.
   - Mengubah kondisi Aset menghasilkan log dengan event `updated` dan menyimpan diff `old` vs `attributes`.
   - Menghapus Kategori menghasilkan log dengan event `deleted`.
3. **Keamanan & Privasi Data:**
   - Mengubah password user tidak pernah menyimpan nilai password lama maupun baru ke dalam `properties`.
4. **Filter & Pencarian:**
   - Filter berdasarkan modul, event, dan rentang tanggal menyaring data secara presisi.
5. **Pembersihan Log (Prune):**
   - Command `activitylog:clean` menghapus log yang lebih tua dari 90 hari.

---

## 6. Pertimbangan Edge Cases & Kinerja

1. **Model yang Telah Dihapus Permanen (*Hard Deleted*):**
   - Jika data subjek dihapus permanen, relasi `subject` akan bernilai `null`.
   - UI dan Presenter menangani ini secara *graceful* dengan menampilkan nama fallback dari properti log tanpa menyebabkan error 500.
2. **Bulk Import:**
   - Saat import pegawai/aset ribuan baris dijalankan, logging per baris tetap efisien karena hanya menulis atribut yang masuk tanpa kueri tambahan yang berat.
3. **Ukuran Indeks Database:**
   - Foreign key polimorfik `(subject_type, subject_id)` dan `(causer_type, causer_id)` sudah diindeks secara native oleh Spatie.
   - Retensi 90 hari menjaga ukuran tabel tetap dalam batas aman (< 50 MB) di disk VPS.
