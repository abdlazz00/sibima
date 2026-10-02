# Desain Sistem: Dynamic RBAC v2 (Manajemen Role & Hak Akses Fleksibel)

Tanggal: 2026-10-09  
Status: Draf Usulan Arsitektur  
Target: Sprint 5+ (Fondasi Keamanan Dinamis SIBIMA)

---

## 1. Konteks & Latar Belakang

Pada versi SIBIMA sebelumnya, otorisasi pengguna berbasis pada *role statis yang di-hardcode* (`kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`) langsung di berbagai layer aplikasi:
- **Policy**: `AssetPolicy`, `AssetCategoryPolicy`, `PegawaiPolicy`, `BeritaAcaraPenerimaanPolicy`, dll. memeriksa nama role menggunakan `hasRole(...)` atau array statis.
- **Workflow Engine**: `ApprovalWorkflowService` menyimpan nama role pada `workflow_steps.approver_role`.
- **Cakupan Data**: `User::accessibleUnitIds()` memeriksa `if ($this->hasRole('kasubag'))` dan `if ($this->hasRole('camat'))`.
- **Navigasi Frontend**: `resources/js/config/navigation.ts` menyaring menu sidebar berdasarkan array string `roles: ['kasubag', ...]`.

### Masalah yang Diselesaikan:
1. Tidak dapat membuat role baru dari antarmuka pengguna (misal: *Operator Aset Kelurahan*, *Staf Verifikasi*, *Auditor BPKAD*).
2. Pengguna dengan role yang sama tidak dapat memiliki hak akses yang berbeda (contoh: dua user sama-sama `Admin Kecamatan`, tetapi salah satunya memiliki hak istimewa untuk mengimpor atau mengelola kategori aset).
3. Penambahan fitur baru membutuhkan modifikasi file TypeScript navigasi frontend dan policy backend secara manual.

---

## 2. Prinsip Desain & Arsitektur (*Ponytail Minimalist*)

1. **Leverage Standard Laravel & Spatie (`spatie/laravel-permission`)**:
   - Memaksimalkan fitur bawaan Spatie yang sudah terpasang:
     - `Role` memiliki banyak `Permission` (relasi `role_has_permissions`).
     - `User` memiliki `Role` (`model_has_roles`).
     - `User` dapat memiliki `Permission` langsung / override (`model_has_permissions`).
   - Pengecekan otorisasi menggunakan `$user->can('permission.name')` standar Laravel Gate/Policy.
2. **Dua Dimensi Hak Akses**:
   - **Dimensi Fungsional (Permission)**: Mengatur tombol, menu, aksi CRUD, dan eksekusi transaksi.
   - **Dimensi Cakupan Data (Unit Scope)**: Mengatur data unit mana saja yang boleh dilihat/dikelola:
     - `all`: Seluruh unit (Kecamatan + semua Kelurahan).
     - `binaan`: Unit Kecamatan + seluruh Kelurahan binaannya.
     - `own`: Unit kerja akun pengguna itu sendiri.
3. **Proteksi Role Sistem (System Roles)**:
   - Role inti (`kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`) ditandai dengan flag `is_system = true`.
   - Role sistem **tidak dapat dihapus** dan namanya tidak dapat diubah agar keutuhan data historis dan alur approval bawaan tetap terjaga. Namun, permission-nya tetap dapat disesuaikan jika diperlukan.
4. **Zero Overhead Dynamic Navigation**:
   - Menu sidebar di frontend mengecek permission (`auth.user.permissions`), bukan role.

---

## 3. Skema Basis Data (Database Schema)

### 3.1. Penambahan Kolom pada Tabel `roles`
Menggunakan migrasi `add_scope_and_system_to_roles_table`:
```php
Schema::table('roles', function (Blueprint $table) {
    $table->string('display_name')->nullable()->after('name');
    $table->string('unit_scope', 20)->default('own')->after('guard_name'); // 'all', 'binaan', 'own'
    $table->boolean('is_system')->default(false)->after('unit_scope');
    $table->string('description', 255)->nullable()->after('is_system');
});
```

### 3.2. Penambahan Kolom pada Tabel `users`
Menggunakan migrasi `add_unit_scope_override_to_users_table`:
```php
Schema::table('users', function (Blueprint $table) {
    $table->string('unit_scope_override', 20)->nullable()->after('unit_id'); // null, 'all', 'binaan', 'own'
});
```

---

## 4. Katalog Hak Akses (Granular Permissions)

Hak akses dikelompokkan ke dalam modul-modul fungsional:

### A. Dashboard & Data Master
- `dashboard.view`: Melihat ringkasan data, statistik, dan grafik tren di `/dashboard`.
- `scan.view`: Mengakses kamera pemindai barcode / QR code di `/scan`.
- `aset.view`: Melihat daftar dan detail aset di `/assets`.
- `aset.create`: Menambahkan aset baru secara manual.
- `aset.update`: Mengubah informasi aset (kondisi, nilai, penanggung jawab, dll.).
- `aset.delete`: Menghapus data aset.
- `aset.import`: Mengunggah berkas Excel import aset di `/import/aset`.
- `aset.export`: Mengunduh berkas Excel daftar aset di `/export/aset`.
- `aset.print-label`: Mencetak barcode/QR label aset.
- `kategori.view`: Melihat daftar kategori & subkategori di `/asset-categories`.
- `kategori.create`: Menambah kategori atau subkategori baru.
- `kategori.update`: Mengedit kategori atau subkategori.
- `kategori.delete`: Menghapus kategori atau subkategori.
- `kategori.import`: Mengunggah berkas Excel import kategori.
- `kategori.export`: Mengunduh data kategori ke Excel.
- `pegawai.view`: Melihat daftar pegawai di `/pegawais`.
- `pegawai.create`: Menambah data pegawai baru.
- `pegawai.update`: Mengubah data pegawai.
- `pegawai.delete`: Menghapus data pegawai.
- `pegawai.create-user`: Membuat atau menghubungkan akun user login untuk pegawai.
- `pegawai.import`: Mengunggah berkas Excel import pegawai.
- `pegawai.export`: Mengunduh data pegawai ke Excel.

### B. Transaksi Aset
- `penerimaan.view`: Melihat daftar dan rincian Berita Acara Penerimaan di `/penerimaan-aset`.
- `penerimaan.create`: Membuat draft Berita Acara Penerimaan aset baru.
- `penerimaan.update`: Mengubah draft Berita Acara Penerimaan.
- `penerimaan.delete`: Menghapus draft Berita Acara Penerimaan.
- `penerimaan.submit`: Mengajukan Berita Acara Penerimaan ke alur persetujuan.
- `mutasi.view`: Melihat riwayat mutasi aset di `/asset-mutations`.
- `mutasi.create`: Mengajukan mutasi aset antar-unit atau internal.
- `permohonan.view`: Melihat daftar antrean permohonan aset di `/asset-requests`.
- `permohonan.create`: Membuat permohonan aset baru (pegawai / unit).
- `permohonan.fulfill`: Menyerahkan aset untuk memenuhi permohonan yang disetujui.
- `permohonan.close`: Menutup permohonan yang selesai atau dibatalkan.
- `laporan-insiden.view`: Melihat riwayat laporan kerusakan/kehilangan di `/asset-reports`.
- `laporan-insiden.create`: Membuat laporan kerusakan atau kehilangan aset.
- `persetujuan.view`: Melihat kotak masuk pengajuan di `/persetujuan`.
- `persetujuan.act`: Melakukan aksi Setujui (*Approve*) atau Tolak (*Reject*) pada pengajuan.

### C. Laporan & Rekapitulasi
- `laporan.aset`: Mengakses halaman rekapitulasi Laporan Aset di `/laporan-aset`.
- `laporan.mutasi`: Mengakses halaman rekapitulasi Laporan Mutasi di `/laporan-mutasi`.
- `laporan.rusak-hilang`: Mengakses halaman rekapitulasi Laporan Kerusakan & Kehilangan di `/laporan-rusak-hilang`.

### D. Pengaturan Sistem
- `pengaturan.alur`: Mengonfigurasi tahapan alur persetujuan workflow di `/pengaturan/alur`.
- `pengaturan.role`: Mengelola Role, Permission, dan Unit Scope di `/pengaturan/roles`.
- `pengaturan.user`: Mengelola akun pengguna dan permission khusus per user di `/pengaturan/users`.

---

## 5. Resolusi Cakupan Data Unit (`accessibleUnitIds`)

Metode `accessibleUnitIds()` pada model `User` direfaktor menjadi dinamis:

```php
public function resolveUnitScope(): string
{
    if ($this->unit_scope_override) {
        return $this->unit_scope_override;
    }

    $role = $this->roles->first();
    return $role?->unit_scope ?? 'own';
}

public function accessibleUnitIds(): ?array
{
    if ($this->getRoleNames()->isEmpty() || $this->unit_id === null) {
        return [];
    }

    $scope = $this->resolveUnitScope();

    if ($scope === 'all') {
        return null; // Akses seluruh unit tanpa batas
    }

    if ($scope === 'binaan') {
        return Unit::query()
            ->where('id', $this->unit_id)
            ->orWhere('parent_id', $this->unit_id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    return [$this->unit_id];
}
```

---

## 6. Antarmuka Pengguna (UI / UX)

### 6.1. Halaman Manajemen Role (`/pengaturan/roles`)
1. **Index (`Index.tsx`)**:
   - Header: Tombol *"Tambah Role Baru"*.
   - Tabel: Nama Role, Display Name, Unit Scope Badge, Tipe (*Sistem / Kustom*), Jumlah Pengguna, Tombol Aksi (*Edit*, *Hapus*).
   - Validasi Hapus: Role sistem (`is_system = true`) atau role yang masih digunakan oleh user tidak dapat dihapus.
2. **Form Create / Edit (`RoleForm.tsx` / `Create.tsx` / `Edit.tsx`)**:
   - Input Nama Role teknis & Display Name ramah pengguna.
   - Pilihan Unit Scope: Radio button (*Semua Unit*, *Unit & Binaan Kelurahan*, *Unit Sendiri Saja*).
   - Deskripsi peran.
   - **Matriks Checkbox Permission**: Dikelompokkan per modul (Dashboard, Aset, Pegawai, Transaksi, Laporan, Pengaturan).
   - Tombol *"Pilih Semua"* / *"Hapus Semua"* per modul.

### 6.2. Halaman / Modal Pengaturan Akses User
1. Di modal pembuatan / edit akun user (`CreatePegawaiUserModal` / Halaman User):
   - Dropdown **Role Utama**.
   - Kotak Opsi Lanjutan: **Hak Akses Tambahan (User Overrides)**.
   - Menampilkan checklist permission:
     - Permission yang sudah didapatkan dari Role ditandai centang nonaktif dengan label `[Dari Role]`.
     - Permission tambahan dapat dicentang secara mandiri untuk user spesial tersebut dengan label `[Izin Khusus]`.

### 6.3. Navigasi Sidebar Dinamis
File `resources/js/config/navigation.ts` diperbarui:
- Properti `roles?: Role[]` pada `NavItem` digantikan oleh `permission?: string`.
- Fungsi `navGroupsForUser(permissions: string[])`: Menyaring menu berdasarkan apakah `permissions.includes(item.permission)`. Menu tanpa permission eksplisit (seperti Dashboard) selalu tampil jika user login.

---

## 7. Penanganan Alur Persetujuan (Workflow Compatibility)

- Pada alur persetujuan (`ApprovalWorkflowService`), penentuan approver saat ini bergantung pada kolom `workflow_steps.approver_role`.
- Dropdown pemilihan approver di form pengaturan alur otomatis menampilkan seluruh Role yang memiliki permission `persetujuan.act`.
- Pengecekan otorisasi menyetujui pengajuan memeriksa:
  1. Apakah user memiliki permission `persetujuan.act`?
  2. Apakah user memiliki role yang sesuai dengan step alur approval (`$user->hasRole($step->approver_role)`)?
  3. Apakah unit user sesuai dengan cakupan dokumen yang disetujui?

---

## 8. Rencana Pengujian (Testing Strategy)

1. **Unit & Feature Test (Pest)**:
   - Pembuatan custom role dengan sekumpulan permission acak.
   - Pemberian direct permission khusus kepada user dan verifikasi bahwa `$user->can()` mengembalikan `true`.
   - Verifikasi bahwa user dengan role yang sama tetapi tanpa direct permission ditolak (`403 Forbidden`).
   - Verifikasi proteksi role sistem: percobaan hapus role `kasubag` atau `camat` menghasilkan error validasi.
   - Uji resolusi `accessibleUnitIds()` untuk cakupan `all`, `binaan`, dan `own`.
   - Regresi: seluruh fitur yang sudah ada (Aset, Pegawai, Kategori, Mutasi, Penerimaan, Permohonan, Laporan, Import/Export) tetap berjalan hijau.
2. **Frontend Typecheck & Build**:
   - `npx tsc --noEmit` & `npm run build` bebas dari error tipe.

---

## 9. Mitigasi Risiko & Transisi Data (Migration Strategy)

1. **Seeding Aman & Idempotent**:
   - Seluruh permission baru didaftarkan lewat `PermissionSeeder`.
   - Role bawaan (`kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`) otomatis disinkronkan dengan kumpulan permission default-nya sehingga sistem langsung siap pakai tanpa merusak akun yang sudah ada.
2. **Backward Compatibility**:
   - Akun user yang sudah ada tetap memegang role-nya saat ini dan langsung mewarisi permission lengkap sesuai matriks default.
