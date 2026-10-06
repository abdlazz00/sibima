# Design Specification: Dynamic RBAC Decoupling & Permission Enforcement

## 1. Konteks & Latar Belakang

Sistem Informasi Barang Milik Daerah (SIBIMA) memiliki modul pengelolaan peran dan izin berbasis RBAC dinamis (`RoleController` dan Spatie Permission). Administrator dapat membuat role kustom, mengatur cakupan unit (`own`, `binaan`, `all`), serta mencentang/mencabut izin individual dari matriks izin (`PermissionSeeder::PERMISSION_GROUPS`).

Namun, audit menyeluruh codebase menunjukkan bahwa beberapa fitur bisnis masih memiliki penguncian (*locking*) berbasis nama role string literal (seperti `'kasubag'`, `'admin_kecamatan'`, `'admin_kelurahan'`), atau memeriksa sekadar `$user->getRoleNames()->isNotEmpty()`. Akibatnya:
1. Role kustom baru yang diberikan izin sah tetap tertolak oleh *business exception* atau tersembunyi dari alur kerja.
2. Pencabutan izin tertentu (misal cetak label atau unduh laporan) tidak berdampak karena sistem tidak memvalidasi permission spesifik Spatie pada level Form Request atau Controller.
3. Komponen antarmuka pengguna (UI) menampilkan tombol aksi yang memicu HTTP 403 karena tidak terikat dengan prop `can` / permission user.

Tujuan spesifikasi ini adalah menghapus seluruh penguncian role hardcode, menggantinya dengan verifikasi permission dinamis dan kapabilitas domain unit, serta menyelaraskan UI frontend dengan hak akses pengguna.

---

## 2. Prinsip Arsitektur Otorisasi

1. **Permission-First Principle**:
   Otorisasi kemampuan bertindak (Create, Read, Update, Delete, Fulfill, Print, Export) selalu ditentukan oleh *permission* Spatie (`$user->can('permission.name')`), **bukan** nama role.
2. **Structural / Contextual Domain Scoping**:
   Pembatasan alur kerja struktural (misal permohonan antar-organisasi) ditentukan oleh **karakteristik unit** pemohon/tujuan, bukan nama role pemohon.
   - Contoh: Apakah unit pemohon bertipe kelurahan? Menggunakan `$unit->isKelurahan()`.
   - Apakah unit aktor memiliki unit bawahan? Menggunakan `$unit->isKecamatan()` atau `$actor->resolveUnitScope() === 'binaan'`.
3. **Delegation Boundary & Self-Protection**:
   Untuk manajemen akun dan role, batas kewenangan ditentukan oleh delegasi matematis (`covers()` dan `canManageRole()`), serta proteksi akun root sistem (Kasubag root).
4. **Consistency Between Backend & Frontend**:
   Setiap tombol aksi yang memicu request terlindungi wajib disembunyikan atau dinonaktifkan di frontend jika permission terkait tidak dimiliki oleh user yang sedang login.

---

## 3. Rincian Perubahan Subsistem

### 3.1 Permohonan Aset (`AssetRequestService` & `AssetRequestController`)

#### Masalah Saat Ini:
- `AssetRequestService::create()` melempar exception jika aktor tidak memiliki role `admin_kecamatan` atau `admin_kelurahan`.
- Pengajuan permohonan unit dikunci ke role `admin_kelurahan`.
- `AssetRequestService::canFulfill()` dikunci ke role `admin_kecamatan` dan `admin_kelurahan`.
- `AssetRequestController::index()` meng-hardcode kueri binaan ke `hasRole('admin_kecamatan')`.
- `AssetRequestController::create()` meng-hardcode prop `'canUnit'` ke `hasRole('admin_kelurahan')`.

#### Desain Baru:
1. **`AssetRequestService::create`**:
   - Ganti validasi role dengan:
     ```php
     if (! $actor->can('permohonan.create') || $actor->unit_id === null) {
         throw new InvalidArgumentException('Anda tidak memiliki hak akses untuk membuat permohonan.');
     }
     ```
   - Untuk tipe `AssetRequestType::Unit`:
     ```php
     if (! $actor->unit?->isKelurahan()) {
         throw new InvalidArgumentException('Permohonan unit hanya dapat diajukan oleh unit tingkat kelurahan.');
     }
     ```
2. **`AssetRequestService::canFulfill`**:
   - Ganti validasi role dengan:
     ```php
     if (! $user->can('permohonan.fulfill')) {
         return false;
     }

     return match ($request->jenis) {
         AssetRequestType::Pegawai => $user->canAccessUnit($request->unit),
         AssetRequestType::Unit => $request->unit->parent_id === $user->unit_id && $user->canAccessUnit($user->unit),
     };
     ```
3. **`AssetRequestController::index`**:
   - Hitung `$binaanIds` berdasarkan kapabilitas unit dan cakupan akses user:
     ```php
     $canSeeBinaan = $user->unit?->isKecamatan() || in_array($user->resolveUnitScope(), ['binaan', 'all'], true);
     $binaanIds = $canSeeBinaan && $user->unit_id !== null
         ? Unit::where('parent_id', $user->unit_id)->pluck('id')->all()
         : [];
     ```
4. **`AssetRequestController::create`**:
   - Prop `'canUnit'` dikirim berdasarkan kapabilitas unit:
     ```php
     'canUnit' => $user->can('permohonan.create') && ($user->unit?->isKelurahan() ?? false),
     ```

---

### 3.2 Penerimaan Aset (`PenerimaanAsetController`)

#### Masalah Saat Ini:
- Kueri `index` mengecualikan unit scoping jika `! $user->hasRole('kasubag')`.
- Kueri `index` memaksa status `Submitted` jika `! $user->hasRole('admin_kecamatan')`, sehingga user unit pembuat draft (atau role custom dengan izin penerimaan) tidak dapat melihat draft miliknya.

#### Desain Baru:
1. **Unit Scoping**:
   Gunakan `$user->accessibleUnitIds() !== null` murni tanpa mengecek nama role `kasubag`:
   ```php
   ->when($user->accessibleUnitIds() !== null, fn (Builder $q) => $q->whereIn('unit_id', $user->accessibleUnitIds()))
   ```
2. **Status Draft Visibility**:
   Sesuai `BeritaAcaraPenerimaanPolicy`, dokumen berstatus `Draft` hanya boleh diakses oleh pembuatnya di unit yang sama dengan izin `penerimaan.update`/`create`, atau user berkewenangan global (`unit_scope === 'all'`).
   ```php
   ->when($user->resolveUnitScope() !== 'all', function (Builder $q) use ($user) {
       $canManageDraft = $user->can('penerimaan.update') || $user->can('penerimaan.create');
       $q->where(function (Builder $sub) use ($user, $canManageDraft) {
           $sub->where('status', '!=', BeritaAcaraStatus::Draft);
           if ($canManageDraft && $user->unit_id !== null) {
               $sub->orWhere(fn (Builder $d) => $d->where('status', BeritaAcaraStatus::Draft)->where('unit_id', $user->unit_id));
           }
       });
   })
   ```

---

### 3.3 Validasi Otorisasi Form Laporan

#### Masalah Saat Ini:
- `LaporanAsetRequest`, `LaporanMutasiRequest`, dan `LaporanRusakHilangRequest` mengizinkan akses selama user memiliki role apapun (`getRoleNames()->isNotEmpty()`), mengabaikan izin spesifik yang dikonfigurasi di RBAC.

#### Desain Baru:
1. **`LaporanAsetRequest::authorize()`**:
   ```php
   public function authorize(): bool
   {
       return $this->user()?->can('laporan.aset') ?? false;
   }
   ```
2. **`LaporanMutasiRequest::authorize()`**:
   ```php
   public function authorize(): bool
   {
       return $this->user()?->can('laporan.mutasi') ?? false;
   }
   ```
3. **`LaporanRusakHilangRequest::authorize()`**:
   ```php
   public function authorize(): bool
   {
       return $this->user()?->can('laporan.rusak-hilang') ?? false;
   }
   ```

---

### 3.4 Pembuatan Akun dari Pegawai & Delegasi Role

#### Masalah Saat Ini:
- `CreatePegawaiUserRequest` memvalidasi role dengan `Rule::in(['kasubag', 'camat', ...])`.
- `PegawaiController::index` mengecek `$request->user()->hasRole('kasubag') || $request->user()->can('pegawai.create-user')`.
- `PegawaiService::create` mengunci pemilihan `unit_id` pegawai ke `hasRole('kasubag')`.
- `Pegawai/Show.tsx` meng-hardcode opsi dropdown role.

#### Desain Baru:
1. **`CreatePegawaiUserRequest`**:
   - Rule role menggunakan database:
     ```php
     'role' => ['required', 'string', Rule::exists('roles', 'name')],
     ```
   - Di method `after()`, pastikan user hanya dapat mendelegasikan role yang berada dalam batas kewenangannya:
     ```php
     $role = Role::findByName($this->input('role'));
     if (! $this->user()->canManageRole($role)) {
         $validator->errors()->add('role', 'Anda tidak memiliki wewenang untuk memberikan role ini.');
     }
     ```
2. **`PegawaiController`**:
   - Di `index`: Ganti `'createUser'` murni menjadi `$request->user()->can('pegawai.create-user')`.
   - Di `show`: Muat daftar role yang diizinkan untuk didelegasikan:
     ```php
     $assignableRoles = Role::query()
         ->get()
         ->filter(fn (Role $r) => $request->user()->canManageRole($r))
         ->map(fn (Role $r) => ['value' => $r->name, 'label' => $r->display_name ?? $r->name])
         ->values();
     ```
     Kirim `assignableRoles` sebagai prop ke `Pegawai/Show.tsx`.
3. **`PegawaiService::create`**:
   - Ganti pemilihan `unit_id`:
     ```php
     'unit_id' => ($actor->resolveUnitScope() === 'all' && ! empty($data['unit_id']))
         ? $data['unit_id']
         : ($actor->unit_id ?? $data['unit_id']),
     ```
4. **`Pegawai/Show.tsx`**:
   - Ganti `<option>` hardcode dengan mapping `assignableRoles`.

---

### 3.5 Otorisasi Cetak Label & Sinkronisasi Tombol UI

#### Masalah Saat Ini:
- `PrintAssetLabelsRequest` mengecek `can('viewAny', Asset::class)` alih-alih `aset.print-label`.
- `Assets/Index.tsx` menampilkan tombol Cetak Label tanpa memeriksa permission `aset.print-label`, dan menampilkan tombol edit tanpa memeriksa `can.update`.
- `AssetCategories/Index.tsx` menampilkan tombol Tambah, Edit, dan Hapus tanpa memeriksa `kategori.create`, `kategori.update`, dan `kategori.delete`.
- `Pegawai/Index.tsx` mengikat tombol Hapus ke `can.create` alih-alih `can.delete`.

#### Desain Baru:
1. **`PrintAssetLabelsRequest`**:
   ```php
   public function authorize(): bool
   {
       return $this->user()?->can('aset.print-label') ?? false;
   }
   ```
2. **`AssetController::index` & `Assets/Index.tsx`**:
   - Controller mengirim prop:
     ```php
     'can' => [
         'create' => $request->user()->can('create', Asset::class),
         'printLabel' => $request->user()->can('aset.print-label'),
         'update' => $request->user()->can('aset.update'),
     ],
     ```
   - Di `Assets/Index.tsx`:
     - Tombol "Cetak Label" toolbar: `{selectedIds.length > 0 && can.printLabel && ( ... )}`
     - Tombol cetak baris tabel: hanya render jika `can.printLabel`.
     - Tombol ubah baris tabel: hanya render jika `can.update && asset.unit_id === auth.user?.unit_id`.
3. **`AssetCategoryController::index` & `AssetCategories/Index.tsx`**:
   - Controller mengirim prop:
     ```php
     'can' => [
         'create' => $request->user()->can('create', AssetCategory::class),
         'update' => $request->user()->can('kategori.update'),
         'delete' => $request->user()->can('kategori.delete'),
     ],
     ```
   - Di `AssetCategories/Index.tsx`:
     - Tombol "Tambah Kategori" dibungkus `{can.create && ( ... )}`.
     - Tombol pensil dibungkus `{can.update && ( ... )}`.
     - Tombol tong sampah dibungkus `{can.delete && ( ... )}`.
4. **`PegawaiController::index` & `Pegawai/Index.tsx`**:
   - Controller menyertakan `'delete' => $request->user()->can('delete', Pegawai::class)`.
   - Di `Pegawai/Index.tsx`: Ubah `{can.create && <button ... Hapus />}` menjadi `{can.delete && <button ... Hapus />}`.

---

### 3.6 Route Direct Access Protections & Helper Refinements

1. **`DashboardController`**:
   Tambahkan `abort_unless($request->user()->can('dashboard.view'), 403);` di awal `__invoke`.
2. **`PersetujuanController`**:
   Tambahkan `abort_unless($request->user()->can('persetujuan.view'), 403);` di awal `index`.
3. **`ScanController`**:
   Tambahkan `abort_unless($request->user()->can('scan.view'), 403);` di awal `index` dan `show`.
4. **`resources/js/Pages/Dashboard.tsx`**:
   Ubah:
   ```tsx
   const isApprover = permissions.includes('persetujuan.act');
   ```
   Menghapus fallback `['kasubag', 'camat', 'lurah'].includes(role)`.

---

## 4. Matriks Dampak & Berkas yang Disentuh

| Berkas | Tipe | Komponen Perubahan |
|---|---|---|
| `app/Services/AssetRequestService.php` | Backend Service | Decouple `create` & `canFulfill` dari nama role literal. |
| `app/Http/Controllers/AssetRequestController.php` | Backend Controller | Decouple `$binaanIds` & `'canUnit'` dari role literal. |
| `app/Http/Controllers/PenerimaanAsetController.php` | Backend Controller | Dynamic draft visibility & unit scoping. |
| `app/Http/Requests/LaporanAsetRequest.php` | Form Request | Authorize via `laporan.aset`. |
| `app/Http/Requests/LaporanMutasiRequest.php` | Form Request | Authorize via `laporan.mutasi`. |
| `app/Http/Requests/LaporanRusakHilangRequest.php` | Form Request | Authorize via `laporan.rusak-hilang`. |
| `app/Http/Requests/PrintAssetLabelsRequest.php` | Form Request | Authorize via `aset.print-label`. |
| `app/Http/Requests/CreatePegawaiUserRequest.php` | Form Request | Validate role via `exists:roles,name` & `canManageRole`. |
| `app/Http/Controllers/PegawaiController.php` | Backend Controller | Clean `createUser`, pass `can.delete` & `assignableRoles`. |
| `app/Services/PegawaiService.php` | Backend Service | Decouple `unit_id` assignment dari role `kasubag`. |
| `app/Http/Controllers/AssetController.php` | Backend Controller | Pass `printLabel` & `update` di prop `can`. |
| `app/Http/Controllers/AssetCategoryController.php` | Backend Controller | Pass `create`, `update`, `delete` di prop `can`. |
| `app/Http/Controllers/DashboardController.php` | Backend Controller | Check `dashboard.view`. |
| `app/Http/Controllers/PersetujuanController.php` | Backend Controller | Check `persetujuan.view`. |
| `app/Http/Controllers/ScanController.php` | Backend Controller | Check `scan.view`. |
| `resources/js/Pages/Pegawai/Show.tsx` | Frontend Page | Dynamic role select options. |
| `resources/js/Pages/Pegawai/Index.tsx` | Frontend Page | Fix delete button condition to `can.delete`. |
| `resources/js/Pages/Assets/Index.tsx` | Frontend Page | Bind print & edit buttons to permissions. |
| `resources/js/Pages/AssetCategories/Index.tsx` | Frontend Page | Bind add, edit, delete buttons to `can.*`. |
| `resources/js/Pages/Dashboard.tsx` | Frontend Page | Remove hardcoded role fallback on `isApprover`. |

---

## 5. Rencana Pengujian & Kriteria Keberhasilan

1. **Uji Otomatisasi Hak Akses (Pest PHP)**:
   - Buat test feature baru `tests/Feature/DynamicRbacDecouplingTest.php` yang memverifikasi:
     - User dengan role baru non-standar (misal `operator_kecamatan` dengan `permohonan.create`) dapat membuat permohonan aset.
     - User dengan role baru di kelurahan dapat membuat permohonan unit.
     - User dengan role baru dengan `permohonan.fulfill` dapat memenuhi permohonan pegawai dan permohonan unit.
     - User tanpa `laporan.aset` mendapatkan HTTP 403 saat mengakses laporan aset.
     - User tanpa `aset.print-label` mendapatkan HTTP 403 saat mencetak label aset.
     - User dengan izin delegasi dapat membuat akun login pegawai dengan role kustom baru.
2. **Uji Regresi Suite Lengkap**:
   - `php artisan test` wajib lulus 100% (semua 653+ test eksis tetap hijau).
3. **Frontend Type Check & Build**:
   - `npx tsc --noEmit` wajib lulus 0 error.
   - `npm run build` sukses tanpa issue.
