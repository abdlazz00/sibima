# Dynamic RBAC Decoupling & Permission Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus seluruh penguncian role hardcode pada codebase SIBIMA dan menggantinya dengan verifikasi permission Spatie serta kapabilitas struktural unit agar semua hak akses CRUD dapat dikonfigurasi penuh via RBAC dinamis.

**Architecture:** Menerapkan *Permission-First Principle* pada setiap otorisasi aksi bisnis, menggunakan metode domain struktural (`$unit->isKelurahan()`, `$user->canAccessUnit()`, `$user->resolveUnitScope()`) untuk pembatasan wilayah organisasi, dan mengamankan batas delegasi role via `$user->canManageRole()`. Menyinkronkan visibilitas tombol aksi di antarmuka frontend dengan prop `can` / permission user.

**Tech Stack:** Laravel 11, PHP 8.2+, Spatie Laravel-Permission, Inertia.js React, TypeScript, Tailwind CSS, Pest PHP.

**Spec:** [`docs/superpowers/specs/2026-10-06-dynamic-rbac-decoupling-design.md`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/superpowers/specs/2026-10-06-dynamic-rbac-decoupling-design.md)

## Global Constraints

- Jangan mengubah skema database migration jika tidak diperlukan; gunakan model & relasi yang ada.
- Jangan mengubah kontrak enkripsi atau hashing password.
- Pertahankan seluruh tes eksis tetap hijau (`php artisan test` 653+ lulus).
- Zero AI Attribution pada commit message (tanpa `Co-Authored-By`, Gemini, atau Claude).
- Frontend type safety: `npx tsc --noEmit` wajib 0 error.

---

### Task 1: Decouple Permohonan Aset from Literal Roles

**Files:**
- Modify: `app/Services/AssetRequestService.php:33-106`
- Modify: `app/Http/Controllers/AssetRequestController.php:40-80`
- Test: `tests/Feature/AssetRequestControllerTest.php`

**Interfaces:**
- Consumes: `$actor->can('permohonan.create')`, `$actor->unit->isKelurahan()`, `$user->can('permohonan.fulfill')`
- Produces: `AssetRequestService::create()` & `AssetRequestService::canFulfill()` bekerja untuk role kustom baru tanpa ketergantungan pada string `'admin_kecamatan'` / `'admin_kelurahan'`.

- [ ] **Step 1: Write failing test for custom role creating and fulfilling asset requests**

Tambahkan pengujian di `tests/Feature/AssetRequestControllerTest.php`:
```php
test('user dengan role kustom dan permission permohonan.create dapat membuat permohonan', function () {
    $unit = Unit::factory()->create(['type' => 'kelurahan']);
    $role = Role::create(['name' => 'pengurus_kelurahan', 'guard_name' => 'web']);
    $role->givePermissionTo('permohonan.create');
    
    $user = User::factory()->create(['unit_id' => $unit->id]);
    $user->assignRole($role);
    $category = AssetCategory::factory()->create(['parent_id' => AssetCategory::factory()->create()->id]);

    $response = $this->actingAs($user)->post(route('asset-requests.store'), [
        'jenis' => 'unit',
        'category_id' => $category->id,
        'jumlah' => 2,
        'keterangan' => 'Kebutuhan mendesak inventaris kelurahan',
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('asset_requests', ['unit_id' => $unit->id, 'jumlah' => 2]);
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `php artisan test --filter=AssetRequestControllerTest`
Expected: FAIL dengan `InvalidArgumentException: Hanya admin unit yang dapat membuat permohonan.`

- [ ] **Step 3: Refactor `AssetRequestService.php`**

Ubah baris 33-72 di `app/Services/AssetRequestService.php`:
1. Ganti `! $actor->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) || $actor->unit_id === null` dengan:
   ```php
   if (! $actor->can('permohonan.create') || $actor->unit_id === null) {
       throw new InvalidArgumentException('Hanya pengguna berwenang yang dapat membuat permohonan.');
   }
   ```
2. Ganti `! $actor->hasRole('admin_kelurahan')` pada `AssetRequestType::Unit` dengan:
   ```php
   if (! $actor->unit?->isKelurahan()) {
       throw new InvalidArgumentException('Permohonan unit hanya dapat diajukan oleh unit tingkat kelurahan.');
   }
   ```
3. Ubah `canFulfill(User $user, AssetRequest $request): bool` (baris 95-105):
   ```php
   public function canFulfill(User $user, AssetRequest $request): bool
   {
       if (! $user->can('permohonan.fulfill')) {
           return false;
       }

       return match ($request->jenis) {
           AssetRequestType::Pegawai => $user->canAccessUnit($request->unit),
           AssetRequestType::Unit => $request->unit->parent_id === $user->unit_id && $user->canAccessUnit($user->unit),
       };
   }
   ```

- [ ] **Step 4: Refactor `AssetRequestController.php`**

Ubah kueri `index` dan `create` di `app/Http/Controllers/AssetRequestController.php`:
1. Baris 43:
   ```php
   $canSeeBinaan = $user->unit?->isKecamatan() || in_array($user->resolveUnitScope(), ['binaan', 'all'], true);
   $binaanIds = $canSeeBinaan && $user->unit_id !== null
       ? Unit::where('parent_id', $user->unit_id)->pluck('id')->all()
       : [];
   ```
2. Baris 78:
   ```php
   'canUnit' => $user->can('permohonan.create') && ($user->unit?->isKelurahan() ?? false),
   ```

- [ ] **Step 5: Verify test passes**

Run: `php artisan test --filter=AssetRequestControllerTest`
Expected: PASS (seluruh test hijau).

- [ ] **Step 6: Commit Task 1**

```bash
git add app/Services/AssetRequestService.php app/Http/Controllers/AssetRequestController.php tests/Feature/AssetRequestControllerTest.php
git commit -m "feat(permohonan): decouple asset request authorization from hardcoded roles"
```

---

### Task 2: Dynamic Draft Visibility & Scoping in Penerimaan Aset

**Files:**
- Modify: `app/Http/Controllers/PenerimaanAsetController.php:38-42`
- Test: `tests/Feature/PenerimaanAsetControllerTest.php`

**Interfaces:**
- Consumes: `$user->accessibleUnitIds()`, `$user->resolveUnitScope()`, `$user->can('penerimaan.update')`
- Produces: Kueri index penerimaan aset dinamis menampilkan draft kepada pembuat yang berwenang di unitnya tanpa membedakan nama role.

- [ ] **Step 1: Write test for custom role viewing drafts in their unit**

Di `tests/Feature/PenerimaanAsetControllerTest.php`:
```php
test('user dengan izin penerimaan.create dapat melihat draft penerimaan di unitnya', function () {
    $unit = Unit::factory()->create();
    $role = Role::create(['name' => 'staf_pengadaan', 'guard_name' => 'web']);
    $role->givePermissionTo(['penerimaan.view', 'penerimaan.create']);

    $user = User::factory()->create(['unit_id' => $unit->id]);
    $user->assignRole($role);

    $draft = BeritaAcaraPenerimaan::factory()->create([
        'unit_id' => $unit->id,
        'created_by' => $user->id,
        'status' => BeritaAcaraStatus::Draft,
    ]);

    $response = $this->actingAs($user)->get(route('penerimaan-aset.index'));
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('items.data', 1));
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `php artisan test --filter=PenerimaanAsetControllerTest`
Expected: FAIL (draft tidak muncul di `items.data` karena user bukan `admin_kecamatan`).

- [ ] **Step 3: Refactor `PenerimaanAsetController.php` index query**

Ubah baris 38-42 di `app/Http/Controllers/PenerimaanAsetController.php`:
```php
        $query = BeritaAcaraPenerimaan::with(['unit', 'creator', 'items.category', 'approvalRequest'])
            ->when($user->accessibleUnitIds() !== null, fn (Builder $q) => $q->whereIn('unit_id', $user->accessibleUnitIds()))
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

- [ ] **Step 4: Verify test passes**

Run: `php artisan test --filter=PenerimaanAsetControllerTest`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add app/Http/Controllers/PenerimaanAsetController.php tests/Feature/PenerimaanAsetControllerTest.php
git commit -m "feat(penerimaan): enable dynamic draft visibility based on user permissions"
```

---

### Task 3: Enforce Specific Permissions in Laporan FormRequests & Print Label

**Files:**
- Modify: `app/Http/Requests/LaporanAsetRequest.php:25-28`
- Modify: `app/Http/Requests/LaporanMutasiRequest.php:15-18`
- Modify: `app/Http/Requests/LaporanRusakHilangRequest.php:24-27`
- Modify: `app/Http/Requests/PrintAssetLabelsRequest.php:14-17`
- Test: `tests/Feature/LaporanControllerTest.php`, `tests/Feature/AssetLabelControllerTest.php`

**Interfaces:**
- Consumes: `$user->can('laporan.aset')`, `$user->can('laporan.mutasi')`, `$user->can('laporan.rusak-hilang')`, `$user->can('aset.print-label')`
- Produces: Otorisasi Form Request terikat 100% pada permission spesifik.

- [ ] **Step 1: Write test verifying permission enforcement**

Tambahkan pengujian pada form requests laporan dan cetak label:
- User dengan role tanpa `laporan.aset` ditolak 403 saat mengakses `route('laporan-aset.index')`.
- User tanpa `aset.print-label` ditolak 403 saat mengakses `route('assets.labels')`.

- [ ] **Step 2: Update `LaporanAsetRequest.php`**

```php
    public function authorize(): bool
    {
        return $this->user()?->can('laporan.aset') ?? false;
    }
```

- [ ] **Step 3: Update `LaporanMutasiRequest.php`**

```php
    public function authorize(): bool
    {
        return $this->user()?->can('laporan.mutasi') ?? false;
    }
```

- [ ] **Step 4: Update `LaporanRusakHilangRequest.php`**

```php
    public function authorize(): bool
    {
        return $this->user()?->can('laporan.rusak-hilang') ?? false;
    }
```

- [ ] **Step 5: Update `PrintAssetLabelsRequest.php`**

```php
    public function authorize(): bool
    {
        return $this->user()?->can('aset.print-label') ?? false;
    }
```

- [ ] **Step 6: Run tests and ensure all pass**

Run: `php artisan test --filter=Laporan`
Run: `php artisan test --filter=AssetLabel`
Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add app/Http/Requests/LaporanAsetRequest.php app/Http/Requests/LaporanMutasiRequest.php app/Http/Requests/LaporanRusakHilangRequest.php app/Http/Requests/PrintAssetLabelsRequest.php tests/Feature/
git commit -m "feat(security): enforce granular permissions on reports and label printing"
```

---

### Task 4: Dynamic Role Delegation on Pegawai User Creation

**Files:**
- Modify: `app/Http/Requests/CreatePegawaiUserRequest.php:20-25`
- Modify: `app/Http/Controllers/PegawaiController.php:30-40,55-75`
- Modify: `app/Services/PegawaiService.php:24-28`
- Modify: `resources/js/Pages/Pegawai/Show.tsx:60-75,515-560`
- Test: `tests/Feature/PegawaiControllerTest.php`

**Interfaces:**
- Consumes: `Rule::exists('roles', 'name')`, `$user->canManageRole($role)`
- Produces: Pembuatan akun login pegawai menerima role kustom apa pun yang boleh didelegasikan oleh user login.

- [ ] **Step 1: Write test for creating pegawai login with a custom role**

Di `tests/Feature/PegawaiControllerTest.php`:
```php
test('admin dapat membuatkan akun login pegawai dengan role kustom', function () {
    $kasubag = User::factory()->create();
    $kasubag->assignRole(Role::findByName('kasubag'));

    $roleCustom = Role::create(['name' => 'operator_bmd', 'display_name' => 'Operator BMD', 'guard_name' => 'web', 'unit_scope' => 'own']);
    $roleCustom->givePermissionTo('aset.view');

    $pegawai = Pegawai::factory()->create(['unit_id' => $kasubag->unit_id]);

    $response = $this->actingAs($kasubag)->post(route('pegawais.create-user', $pegawai->id), [
        'email' => 'operator@example.com',
        'password' => 'password123',
        'role' => 'operator_bmd',
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('users', ['email' => 'operator@example.com']);
    $user = User::where('email', 'operator@example.com')->first();
    expect($user->hasRole('operator_bmd'))->toBeTrue();
});
```

- [ ] **Step 2: Update `CreatePegawaiUserRequest.php`**

```php
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $role = Role::where('name', $this->input('role'))->first();
            if ($role && ! $this->user()->canManageRole($role)) {
                $validator->errors()->add('role', 'Anda tidak memiliki wewenang untuk memberikan role ini.');
            }
        }];
    }
```

- [ ] **Step 3: Update `PegawaiController.php`**

1. Di `index`:
   ```php
   'createUser' => $request->user()->can('pegawai.create-user'),
   'delete' => $request->user()->can('delete', Pegawai::class),
   ```
2. Di `show`:
   ```php
   $assignableRoles = Role::query()
       ->get()
       ->filter(fn (Role $r) => $request->user()->canManageRole($r))
       ->map(fn (Role $r) => ['value' => $r->name, 'label' => $r->display_name ?? $r->name])
       ->values();

   return Inertia::render('Pegawai/Show', [
       'pegawai' => $pegawai,
       'roles' => $assignableRoles,
       'can' => [
           'update' => $request->user()->can('update', $pegawai),
           'delete' => $request->user()->can('delete', $pegawai),
           'createUser' => $request->user()->can('createUser', $pegawai),
       ],
   ]);
   ```

- [ ] **Step 4: Update `PegawaiService.php`**

Di baris 26:
```php
        $unitId = ($actor->resolveUnitScope() === 'all' && ! empty($data['unit_id']))
            ? $data['unit_id']
            : ($actor->unit_id ?? ($data['unit_id'] ?? null));

        $pegawai = $this->pegawais->create([
            ...Arr::only($data, self::FIELDS),
            'unit_id' => $unitId,
        ]);
```

- [ ] **Step 5: Update `resources/js/Pages/Pegawai/Show.tsx`**

1. Tambahkan `roles: { value: string; label: string }[]` ke `ShowProps`.
2. Di `createAccountForm`, defaultkan `role` ke `roles[0]?.value || ''`.
3. Ganti hardcoded `<option>` di modal Create Account dengan:
   ```tsx
   {roles.map((r) => (
       <option key={r.value} value={r.value}>
           {r.label}
       </option>
   ))}
   ```

- [ ] **Step 6: Verify TypeScript & Pest**

Run: `npx tsc --noEmit`
Run: `php artisan test --filter=PegawaiControllerTest`
Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add app/Http/Requests/CreatePegawaiUserRequest.php app/Http/Controllers/PegawaiController.php app/Services/PegawaiService.php resources/js/Pages/Pegawai/Show.tsx tests/Feature/PegawaiControllerTest.php
git commit -m "feat(pegawai): support dynamic roles when creating employee login account"
```

---

### Task 5: UI Action Button Permission Binding & Scoping

**Files:**
- Modify: `app/Http/Controllers/AssetController.php:40-47`
- Modify: `resources/js/Pages/Assets/Index.tsx:130-165,370-395`
- Modify: `app/Http/Controllers/AssetCategoryController.php:20-30`
- Modify: `resources/js/Pages/AssetCategories/Index.tsx:180-190,355-380`
- Modify: `resources/js/Pages/Pegawai/Index.tsx:320-360`
- Modify: `resources/js/Pages/Dashboard.tsx:70-75`

**Interfaces:**
- Consumes: `can.printLabel`, `can.update`, `can.create`, `can.delete`
- Produces: Tampilan antarmuka hanya menampilkan tombol aksi yang diizinkan untuk akun login.

- [ ] **Step 1: Update `AssetController.php` & `Assets/Index.tsx`**

1. Di `AssetController::index`:
   ```php
   'can' => [
       'create' => $request->user()->can('create', Asset::class),
       'printLabel' => $request->user()->can('aset.print-label'),
       'update' => $request->user()->can('aset.update'),
   ],
   ```
2. Di `Assets/Index.tsx`:
   - Tambahkan `printLabel: boolean; update: boolean;` ke interface `can`.
   - Bungkus tombol toolbar "Cetak Label": `{selectedIds.length > 0 && can.printLabel && ( ... )}`.
   - Di baris tabel:
     - Render tombol Pencil (Edit) hanya jika `can.update && (asset.unit_id === auth.user?.unit_id || auth.user?.roles?.[0] === 'kasubag')`.
     - Render tombol Printer hanya jika `can.printLabel`.

- [ ] **Step 2: Update `AssetCategoryController.php` & `AssetCategories/Index.tsx`**

1. Di `AssetCategoryController::index`:
   ```php
   return Inertia::render('AssetCategories/Index', [
       'categories' => $this->categories->tree(),
       'can' => [
           'create' => Gate::allows('create', AssetCategory::class),
           'update' => Gate::allows('update', new AssetCategory),
           'delete' => Gate::allows('delete', new AssetCategory),
       ],
   ]);
   ```
2. Di `AssetCategories/Index.tsx`:
   - Tambahkan `can: { create: boolean; update: boolean; delete: boolean }` ke props.
   - Bungkus tombol "Tambah Kategori" dengan `{can.create && ( ... )}`.
   - Bungkus tombol Edit dengan `{can.update && ( ... )}`.
   - Bungkus tombol Delete dengan `{can.delete && ( ... )}`.

- [ ] **Step 3: Update `Pegawai/Index.tsx`**

Di baris 344:
Ganti `{can.create && (` dengan `{can.delete && (` untuk tombol hapus pegawai.
Tambahkan juga pengecekan `{can.createUser && (` untuk tombol create account jika relevan.

- [ ] **Step 4: Update `Dashboard.tsx`**

Di `resources/js/Pages/Dashboard.tsx` baris 71-73:
```tsx
    const isApprover = permissions.includes('persetujuan.act');
```
Hapus fallback hardcode `['kasubag', 'camat', 'lurah'].includes(role)`.

- [ ] **Step 5: Verify with TypeScript and Vite build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: PASS 0 error.

- [ ] **Step 6: Commit Task 5**

```bash
git add app/Http/Controllers/AssetController.php resources/js/Pages/Assets/Index.tsx app/Http/Controllers/AssetCategoryController.php resources/js/Pages/AssetCategories/Index.tsx resources/js/Pages/Pegawai/Index.tsx resources/js/Pages/Dashboard.tsx
git commit -m "feat(ui): bind action buttons to granular permissions across index views"
```

---

### Task 6: Direct Controller Route Access Protections

**Files:**
- Modify: `app/Http/Controllers/DashboardController.php`
- Modify: `app/Http/Controllers/PersetujuanController.php`
- Modify: `app/Http/Controllers/ScanController.php`
- Test: `tests/Feature/RoutePermissionProtectionTest.php`

**Interfaces:**
- Consumes: `$request->user()->can('dashboard.view')`, `$request->user()->can('persetujuan.view')`, `$request->user()->can('scan.view')`
- Produces: Akses URL langsung tertolak 403 jika izin view tidak dimiliki akun.

- [ ] **Step 1: Write test verifying direct URL protection**

Buat `tests/Feature/RoutePermissionProtectionTest.php`:
- User tanpa `dashboard.view` mendapatkan 403 saat `GET /dashboard`.
- User tanpa `persetujuan.view` mendapatkan 403 saat `GET /persetujuan`.
- User tanpa `scan.view` mendapatkan 403 saat `GET /scan`.

- [ ] **Step 2: Add abort checks in controllers**

1. Di `DashboardController::__invoke`:
   ```php
   abort_unless($request->user()->can('dashboard.view'), 403);
   ```
2. Di `PersetujuanController::index`:
   ```php
   abort_unless($request->user()->can('persetujuan.view'), 403);
   ```
3. Di `ScanController`:
   Di `index` dan `show`:
   ```php
   abort_unless($request->user()->can('scan.view'), 403);
   ```

- [ ] **Step 3: Verify test passes**

Run: `php artisan test --filter=RoutePermissionProtectionTest`
Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add app/Http/Controllers/DashboardController.php app/Http/Controllers/PersetujuanController.php app/Http/Controllers/ScanController.php tests/Feature/RoutePermissionProtectionTest.php
git commit -m "feat(auth): protect dashboard, scan, and approval routes with explicit permissions"
```

---

### Task 7: Comprehensive Test Suite & Verification

**Files:**
- Create: `tests/Feature/DynamicRbacDecouplingTest.php`
- Run: all existing tests in `tests/`

- [ ] **Step 1: Create comprehensive end-to-end dynamic RBAC decoupling test**

Tulis test yang membuat:
1. Role kustom: `staf_kelurahan_mandiri` dengan izin `['permohonan.create', 'permohonan.view', 'laporan.mutasi']`.
2. Verifikasi dapat membuat permohonan unit.
3. Verifikasi dapat mengakses laporan mutasi tetapi 403 saat mengakses laporan aset.
4. Verifikasi tombol cetak label tidak dapat diakses tanpa izin `aset.print-label`.

- [ ] **Step 2: Run full regression test suite**

Run: `php artisan test`
Expected: 655+ tests passed, 0 failures.

- [ ] **Step 3: Run production frontend build**

Run: `npm run build`
Expected: Vite build succeeds with 0 errors.

- [ ] **Step 4: Commit Task 7**

```bash
git add tests/Feature/DynamicRbacDecouplingTest.php
git commit -m "test(rbac): add comprehensive verification suite for dynamic RBAC decoupling"
```
