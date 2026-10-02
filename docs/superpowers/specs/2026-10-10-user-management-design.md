# Desain Sistem: Manajemen Pengguna & Hak Akses (User Management Dedicated Pages)

Tanggal: 2026-10-10  
Status: Draf Usulan Arsitektur  
Target: Modul Pengaturan Pengguna SIBIMA (Sprint 5+)

---

## 1. Konteks & Latar Belakang

Pada modul sebelumnya, sistem otorisasi SIBIMA telah ditingkatkan menjadi **Dynamic RBAC v2**, di mana:
- Admin dapat membuat role baru dan mengonfigurasi matriks permission secara dinamis via `/pengaturan/roles`.
- Setiap pengguna (`User`) dapat diberikan hak akses bawaan dari Role serta izin khusus tambahan (*user direct permissions override*).

Namun, manajemen akun pengguna saat ini masih tersebar dan memiliki beberapa batasan:
1. **Belum Ada Halaman Khusus Pengguna**: Menu di sidebar `PENGATURAN` baru memuat *Pengaturan Alur* dan *Pengaturan Role*. Pengaturan akses user masih menempel di tabel Data Pegawai (`/pegawais`) melalui modal.
2. **Kebutuhan Halaman Penuh (No Modals)**: Untuk kemudahan peninjauan rincian akun dan audit izin pengguna secara komprehensif, dibutuhkan halaman mandiri berstruktur standar SIBIMA: **Index** (daftar), **Show** (detail akun & izin aktif), dan **Edit** (form lengkap ubah hak akses & kredensial).
3. **Fitur Nonaktifkan Akun (*Deactivation*)**: Diperlukan mekanisme penonaktifan akun (`is_active = false`) agar akses login dapat diblokir seketika tanpa menghapus akun dari basis data, demi menjaga integritas data historis dan jejak audit dokumen (seperti tanda tangan persetujuan pada `approval_actions`).
4. **Foto Profil Pengguna**: Menampilkan foto profil pengguna yang bersumber langsung dari data pegawai (`pegawais.foto_profile`), baik di tabel user, halaman detail, maupun avatar header navbar SIBIMA.
5. **Keamanan Login & Rate Limiting**: Memperkuat endpoint autentikasi `/login` dengan *dual-layer rate limiting* (pembatasan IP dan pembatasan kombinasi kredensial) serta penolakan login untuk akun nonaktif.

---

## 2. Prinsip Desain & Batasan Global

1. **Pembuatan Akun Tetap Eksklusif dari Data Pegawai**:
   - Akun login `User` di SIBIMA wajib memiliki relasi 1-to-1 dengan data `Pegawai` (`pegawais.user_id`).
   - Pembuatan akun baru tidak dilakukan di `/pengaturan/users/create`, melainkan tetap dilakukan melalui menu Data Pegawai (`/pegawais`) untuk menjaga integritas data kepegawaian. Di halaman manajemen pengguna disediakan tombol pintasan informatif ke Data Pegawai.
2. **Dedicated Full Pages (Tanpa Modal)**:
   - Alur navigasi menggunakan halaman penuh:
     - `Index`: Daftar seluruh pengguna dengan filter dan status.
     - `Show`: Tampilan rincian akun, data pegawai terhubung, dan matriks izin aktif.
     - `Edit`: Form lengkap untuk mengubah status akun, reset password, role utama, cakupan unit data (*unit scope*), dan matriks izin tambahan khusus (*user override*).
3. **Foto Profil Otomatis dari Pegawai**:
   - Model `User` menyediakan accessor `foto_profile_url` yang membaca berkas foto dari relasi `Pegawai`.
   - Jika pegawai belum memiliki foto, sistem menampilkan fallback inisial nama pengguna.
4. **Proteksi Integritas & Anti-Lockout**:
   - Pengguna tidak dapat menonaktifkan atau menghapus akunnya sendiri (*self-guard*).
   - Akun Kasubag sistem (`kasubag`) diproteksi agar tidak bisa dinonaktifkan atau dihapus untuk mencegah sistem kehilangan administrator utama.
   - Akun yang pernah memiliki jejak audit persetujuan transaksi (`approval_actions`) tidak dapat dihapus secara fisik, melainkan diarahkan untuk dinonaktifkan (*safe deactivation*).
5. **Keamanan Login Berlapis**:
   - Rate limit route-level pada `POST /login` (`throttle:6,1`).
   - Rate limit identifier-level di `LoginRequest` (5 kali salah = lockout 60 detik).
   - Force logout aktif bagi pengguna yang dinonaktifkan saat sesi sedang berjalan.

---

## 3. Skema Basis Data & Katalog Hak Akses

### 3.1. Penambahan Kolom pada Tabel `users`
Menggunakan migrasi `add_is_active_to_users_table`:
```php
Schema::table('users', function (Blueprint $table) {
    $table->boolean('is_active')->default(true)->after('unit_scope_override');
});
```
- Seluruh akun eksisting otomatis bernilai `true` (aktif).

### 3.2. Katalog Permission Granular (`PermissionSeeder`)
Memperbarui kelompok `Pengaturan` pada `database/seeders/PermissionSeeder.php`:
```php
'Pengaturan' => [
    'pengaturan.alur',
    'pengaturan.role',
    'user.view',            // Melihat halaman /pengaturan/users dan detail akun
    'user.manage-access',   // Mengubah role dan direct permissions pengguna
    'user.reset-password',  // Mengatur ulang password akun pengguna
    'user.toggle-status',   // Mengaktifkan atau menonaktifkan akun
    'user.delete',          // Menghapus akun login pengguna
],
```
*Catatan:* Alias `pengaturan.user` tetap dipertahankan untuk backward compatibility sebagai ekuivalen `user.view`.

---

## 4. Keamanan Autentikasi & Active Session Guard

### 4.1. Dual-Layer Rate Limiting pada Login
1. **Lapisan Rute (`routes/auth.php`)**:
   ```php
   Route::post('login', [AuthenticatedSessionController::class, 'store'])
       ->middleware('throttle:6,1');
   ```
2. **Lapisan Kredensial (`LoginRequest.php`)**:
   - Membatasi 5 percobaan gagal per identifier (`email/nip + IP`).
   - Setelah percobaan ke-5 gagal, memicu event `Lockout` dan mengunci percobaan selama 60 detik.

### 4.2. Pengecekan Akun Aktif saat Autentikasi (`LoginRequest::authenticate`)
Setelah kredensial password valid diverifikasi:
```php
$user = Auth::user();
if ($user && ! $user->is_active) {
    Auth::logout();
    RateLimiter::hit($this->throttleKey());

    throw ValidationException::withMessages([
        'email' => 'Akun Anda sedang dinonaktifkan oleh administrator. Silakan hubungi Kasubag.',
    ]);
}
```

### 4.3. Active Session Guard (Middleware `EnsureUserIsActive`)
Middleware terdaftar pada grup web `auth`:
- Memeriksa apakah `Auth::check() && ! Auth::user()->is_active`.
- Jika terdeteksi akun dinonaktifkan, panggil `Auth::logout()`, batalkan sesi (`$request->session()->invalidate()`), dan arahkan ke rute `login` dengan pesan flash error: *"Sesi Anda telah berakhir karena akun dinonaktifkan."*

---

## 5. Backend Routing & Controller

### 5.1. Rute Aplikasi (`routes/web.php`)
Di dalam grup `middleware(['auth', 'active'])`:
```php
Route::prefix('pengaturan/users')->name('users.')->group(function () {
    Route::get('/', [UserController::class, 'index'])->name('index');
    Route::get('/{user}', [UserController::class, 'show'])->name('show');
    Route::get('/{user}/edit', [UserController::class, 'edit'])->name('edit');
    Route::put('/{user}', [UserController::class, 'update'])->name('update');
    Route::patch('/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('toggle-status');
    Route::delete('/{user}', [UserController::class, 'destroy'])->name('destroy');
});
```

### 5.2. Controller `UserController`
1. **`index(Request $request): Response`**
   - Izin: `$user->can('user.view')`.
   - Mengambil data pengguna berpaginasi (15 per halaman) dengan eager loading: `pegawai.unit`, `roles.permissions`, `permissions`.
   - Filter query: `search` (nama user, email, NIP pegawai), `role` (nama role), `unit_id` (unit kerja), dan `status` (`active` / `inactive`).
   - Menerapkan cakupan data unit pengguna (`accessibleUnitIds()`).
   - Menyediakan props: `users`, `roles`, `units`, `filters`, dan matriks `can`.
2. **`show(User $user, Request $request): Response`**
   - Izin: `$request->user()->can('user.view')`.
   - Memastikan unit user berada dalam cakupan unit yang dapat diakses oleh admin peninjau.
   - Memuat detail pegawai terhubung (`pegawai.unit`), role aktif, dan permission langsung.
   - Menghasilkan daftar seluruh permission efektif (gabungan bawaan role + izin khusus).
3. **`edit(User $user, Request $request): Response`**
   - Izin: `$request->user()->can('user.manage-access')`.
   - Memuat data user, seluruh pilihan Role, seluruh pilihan Unit, dan `PermissionSeeder::PERMISSION_GROUPS`.
4. **`update(UpdateUserRequest $request, User $user): RedirectResponse`**
   - Izin: `$request->user()->can('user.manage-access')`.
   - Validasi:
     - `email`: required, email, unique (kecuali user sendiri).
     - `password`: nullable, string, min 8, confirmed.
     - `is_active`: required, boolean.
     - `role`: required, exists in roles.
     - `direct_permissions`: array, nullable.
     - `unit_scope_override`: nullable, in:all,binaan,own.
   - Eksekusi:
     - Jika field password diisi, update password baru dengan `Hash::make()`.
     - Update email dan status `is_active`.
     - Panggil `PegawaiService::updateUserAccess` untuk sinkronisasi role, direct permissions, dan unit scope override.
     - Mencegah admin menonaktifkan akun sendiri atau mencabut role Kasubag dari akunnya sendiri.
   - Redirect ke `users.show` dengan pesan sukses.
5. **`toggleStatus(Request $request, User $user): RedirectResponse`**
   - Izin: `$request->user()->can('user.toggle-status')`.
   - Validasi proteksi anti-lockout:
     - Gagal jika `$user->id === $request->user()->id`.
     - Gagal jika `$user->hasRole('kasubag')`.
   - Toggle nilai `$user->is_active = ! $user->is_active`.
   - Redirect `back()` dengan pesan sukses.
6. **`destroy(Request $request, User $user): RedirectResponse`**
   - Izin: `$request->user()->can('user.delete')`.
   - Validasi proteksi:
     - Gagal jika `$user->id === $request->user()->id`.
     - Gagal jika `$user->hasRole('kasubag')`.
     - Gagal jika `$user->approvalActions()->exists()` (mengarahkan admin untuk menonaktifkan akun daripada menghapus fisik).
   - Pelepasan relasi `pegawai.user_id = null`, detach roles & permissions, lalu hapus `$user`.
   - Redirect ke `users.index` dengan notifikasi sukses.

---

## 6. Antarmuka Pengguna Frontend (Inertia + React)

### 6.1. Halaman Index (`resources/js/Pages/Users/Index.tsx`)
- **Header**: Breadcrumbs `Home > Pengaturan > Pengaturan Pengguna`, judul, dan link pintasan informatif ke Data Pegawai.
- **Filter Toolbar**:
  - Search input (pencarian instan dengan debounce).
  - Select filter Role, Unit, dan Status Akun.
- **Tabel Pengguna**:
  - Kolom **Pengguna**: Avatar foto profil bulat pegawai (fallback inisial jika null), Nama User, Email.
  - Kolom **Pegawai**: Nama Pegawai terhubung, NIP, Jabatan.
  - Kolom **Unit**: Nama Unit Kerja.
  - Kolom **Role Utama**: Badge Role.
  - Kolom **Hak Khusus**: Badge `+N Izin Khusus` jika memiliki direct permission override.
  - Kolom **Status**: Badge `Aktif` (hijau) atau `Nonaktif` (merah/abu).
  - Kolom **Aksi**:
    - Tombol *Lihat Detail* (ikon Mata).
    - Tombol *Edit* (ikon Pensil).
    - Tombol *Nonaktifkan / Aktifkan* (ikon Toggle).
- **Paginasi**: Komponen Pagination standar SIBIMA.

### 6.2. Halaman Show (`resources/js/Pages/Users/Show.tsx`)
- **Header Profil**:
  - Avatar besar foto profil pegawai, Nama Lengkap Akun, Email, Badge Status Akun, dan Badge Role Utama.
  - Tombol Aksi:
    - *Edit Pengguna & Hak Akses* (menuju `/pengaturan/users/{user}/edit`).
    - *Nonaktifkan / Aktifkan Akun*.
    - *Hapus Akun* (dengan dialog konfirmasi bahaya).
    - *Kembali ke Daftar Pengguna*.
- **Kartu 1: Informasi Pegawai Terkait**:
  - NIP, Jabatan, Unit Kerja, No. Telepon, dan link menuju profil pegawai.
- **Kartu 2: Ringkasan Hak Akses & Cakupan Data**:
  - Role Utama & Deskripsi Peran.
  - Cakupan Data Unit (*Unit Scope*): Keterangan jangkauan akses (*Semua Unit*, *Unit & Binaan*, atau *Unit Sendiri*).
  - Daftar Izin Tambahan Khusus (*User Overrides*) jika ada.
- **Kartu 3: Matriks Seluruh Izin Aktif**:
  - Daftar lengkap seluruh izin fungsional aktif yang dimiliki akun, dikelompokkan rapi per modul (Data Aset, Transaksi, Laporan, Pengaturan).

### 6.3. Halaman Edit (`resources/js/Pages/Users/Edit.tsx`)
- **Form Halaman Penuh**:
  1. **Bagian Akun & Kredensial**:
     - Nama Akun & Email.
     - Status Akun (Radio/Toggle Aktif vs Nonaktif).
     - Ganti / Reset Password (Password Baru & Konfirmasi Password Baru, bersifat opsional).
  2. **Bagian Penugasan Role & Cakupan Data**:
     - Dropdown Role Utama.
     - Radio Pilihan Override Cakupan Unit Kerja (*Ikuti Role*, *Semua Unit*, *Unit & Binaan*, *Unit Sendiri*).
  3. **Bagian Matriks Izin Tambahan Khusus (User Overrides)**:
     - Matriks permission per modul dengan checklist interaktif.
     - Izin yang otomatis diwarisi dari Role ditandai centang nonaktif (*disabled*) dengan label `[Bawaan Role]`.
     - Izin di luar role dapat dicentang mandiri untuk diberikan ke user dengan label `[Izin Khusus]`.
- **Tombol Form**:
  - *Simpan Perubahan* (Inertia `put`).
  - *Batal* (kembali ke halaman `Show`).

### 6.4. Sidebar Navigation & Layout Avatar
- **Sidebar (`resources/js/config/navigation.ts`)**:
  - Menambahkan item `Pengaturan Pengguna` (`/pengaturan/users`, icon `users`, permission: `user.view`).
- **Header Layout (`resources/js/Layouts/AuthenticatedLayout.tsx`)**:
  - Menampilkan foto profil pegawai jika `auth.user.foto_profile_url` tersedia (dengan fallback inisial teks).

---

## 7. Strategi Pengujian (Testing Strategy)

1. **Feature Tests (Pest PHP)**:
   - `UserManagementAccessTest.php`:
     - Akses halaman index, show, dan edit hanya untuk pengguna yang memiliki izin `user.view` dan `user.manage-access`.
     - Pengguna tanpa izin mendapatkan respon `403 Forbidden`.
   - `UserAccountSecurityTest.php`:
     - Autentikasi ditolak jika akun berstatus `is_active = false`.
     - Rate limit rute login (`throttle:6,1`) dan rate limit kredensial (`LoginRequest`).
     - Force logout saat akun aktif dinonaktifkan.
   - `UserLifecycleTest.php`:
     - Pembaruan status akun via `toggleStatus` (berhasil untuk user biasa, dicegah untuk self dan Kasubag).
     - Reset password akun via `update` (password terenkripsi dengan aman).
     - Sinkronisasi role dan direct permission override via `update`.
     - Penghapusan akun melepaskan tautan pegawai (`pegawai.user_id = null`), dan dicegah jika akun memiliki data pada `approval_actions`.
   - `UserProfilePhotoTest.php`:
     - User otomatis mendapatkan `foto_profile_url` yang valid dari relasi `Pegawai`.
2. **Frontend Typecheck & Build**:
   - `npx tsc --noEmit` bebas error tipe.
   - `npm run build` berhasil mengompilasi seluruh aset produksi secara bersih.

---

## 8. Verifikasi Diri (Spec Self-Review)

- **Placeholder scan**: Tidak ada placeholder "TODO" atau "TBD".
- **Internal consistency**: Alur penugasan role dan override izin konsisten dengan fondasi RBAC v2 yang sudah terpasang.
- **Scope check**: Terfokus pada manajemen akun pengguna, halaman Show/Edit terpisah (tanpa modal), keamanan login rate-limited, dan avatar foto profil.
- **Ambiguity check**: Mekanisme nonaktifkan akun terdefinisi jelas di level basis data, form edit, controller, dan middleware login.
