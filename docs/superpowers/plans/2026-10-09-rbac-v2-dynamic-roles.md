# Dynamic RBAC v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti otorisasi role statis dengan Dynamic RBAC v2 yang memungkinkan pembuatan role kustom dari UI, penugasan permission berbutir halus (granular) per modul, direct permission override pada tingkat user individual, dan cakupan data unit dinamis.

**Architecture:** Memanfaatkan pustaka `spatie/laravel-permission` yang sudah terpasang. Menambahkan metadata cakupan unit (`unit_scope`) dan proteksi role sistem (`is_system`) pada tabel `roles` serta `unit_scope_override` pada tabel `users`. Merefaktor seluruh policy dari `$user->hasRole(...)` ke `$user->can(...)`, dan menyajikan antarmuka manajemen role serta override akses user di frontend.

**Tech Stack:** Laravel 11, Spatie Laravel Permission, Inertia.js, React, TypeScript, Tailwind CSS, Pest.

**Spec:** `docs/superpowers/specs/2026-10-09-rbac-v2-dynamic-roles-design.md`

## Global Constraints
- Tetap menjaga keutuhan 536 passing tests tanpa ada regresi.
- Mencegah penghapusan atau penggantian nama teknis pada role sistem bawaan (`kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`).
- Kompatibilitas mundur penuh untuk permission import/ekspor yang sudah ada (`import-{modul}`, `export-{modul}`).
- Kode ringkas dan bersih mengikuti prinsip Ponytail (zero over-engineering, standard Laravel/Spatie first).

---

### Task 1: Migrasi Skema Basis Data & Model Scope Dinamis

**Files:**
- Create: `database/migrations/2026_10_09_000001_add_scope_and_system_to_roles_and_users_tables.php`
- Modify: `app/Models/User.php:48-73`
- Modify: `app/Models/Role.php` (atau extend Spatie Role)
- Test: `tests/Feature/UnitScopeResolutionTest.php`

**Interfaces:**
- Consumes: Tabel `roles` dan `users`.
- Produces: Kolom `display_name`, `unit_scope`, `is_system`, `description` pada `roles`; kolom `unit_scope_override` pada `users`; method `User::resolveUnitScope(): string` dan `User::accessibleUnitIds(): ?array`.

- [ ] **Step 1: Tulis failing test untuk resolusi Unit Scope**

`tests/Feature/UnitScopeResolutionTest.php`:
```php
<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->kelB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
});

it('resolves unit scope all correctly returning null for full access', function () {
    $role = Role::findByName('kasubag');
    $role->update(['unit_scope' => 'all']);

    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('all')
        ->and($user->accessibleUnitIds())->toBeNull();
});

it('resolves unit scope binaan returning parent and child units', function () {
    $role = Role::findByName('camat');
    $role->update(['unit_scope' => 'binaan']);

    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('binaan')
        ->and($user->accessibleUnitIds())->toEqualCanonicalizing([
            $this->kecamatan->id,
            $this->kelA->id,
            $this->kelB->id,
        ]);
});

it('resolves unit scope own returning only user unit', function () {
    $role = Role::findByName('admin_kelurahan');
    $role->update(['unit_scope' => 'own']);

    $user = User::factory()->create(['unit_id' => $this->kelA->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('own')
        ->and($user->accessibleUnitIds())->toBe([$this->kelA->id]);
});

it('allows user_scope_override to take precedence over role unit_scope', function () {
    $role = Role::findByName('admin_kelurahan');
    $role->update(['unit_scope' => 'own']);

    $user = User::factory()->create([
        'unit_id' => $this->kelA->id,
        'unit_scope_override' => 'all',
    ]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('all')
        ->and($user->accessibleUnitIds())->toBeNull();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=UnitScopeResolutionTest`  
Expected: FAIL (kolom `unit_scope` dan `unit_scope_override` belum ada).

- [ ] **Step 3: Buat file migrasi dan update Model**

`database/migrations/2026_10_09_000001_add_scope_and_system_to_roles_and_users_tables.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('display_name')->nullable()->after('name');
            $table->string('unit_scope', 20)->default('own')->after('guard_name');
            $table->boolean('is_system')->default(false)->after('unit_scope');
            $table->string('description', 255)->nullable()->after('is_system');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('unit_scope_override', 20)->nullable()->after('unit_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('unit_scope_override');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'unit_scope', 'is_system', 'description']);
        });
    }
};
```

Update `app/Models/User.php`:
Tambahkan `'unit_scope_override'` ke `#[Fillable]` dan implementasikan `resolveUnitScope()` serta `accessibleUnitIds()`:
```php
    public function resolveUnitScope(): string
    {
        if ($this->unit_scope_override) {
            return $this->unit_scope_override;
        }

        /** @var \Spatie\Permission\Models\Role|null $role */
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
            return null;
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

Jalankan migrasi di database testing:
`php artisan migrate`

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=UnitScopeResolutionTest`  
Expected: PASS (4 tests passed).

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_09_000001_add_scope_and_system_to_roles_and_users_tables.php app/Models/User.php tests/Feature/UnitScopeResolutionTest.php
git commit -m "feat(rbac): add unit scope and system flags to roles and users with dynamic scope resolution"
```

---

### Task 2: Katalog Permissions Lengkap & Seeder Idempotent

**Files:**
- Modify: `database/seeders/RoleSeeder.php`
- Modify: `database/seeders/PermissionSeeder.php`
- Test: `tests/Feature/PermissionCatalogSeederTest.php`

**Interfaces:**
- Consumes: Model `Spatie\Permission\Models\Role` dan `Permission`.
- Produces: 34 permissions berbutir halus dan default role permissions untuk 5 role sistem.

- [ ] **Step 1: Tulis test katalog permission**

`tests/Feature/PermissionCatalogSeederTest.php`:
```php
<?php

use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
});

it('seeds all core granular permissions', function () {
    $expected = [
        'dashboard.view', 'scan.view',
        'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
        'kategori.view', 'kategori.create', 'kategori.update', 'kategori.delete', 'import-kategori', 'export-kategori',
        'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'pegawai.create-user', 'import-pegawai', 'export-pegawai',
        'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
        'mutasi.view', 'mutasi.create',
        'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
        'laporan-insiden.view', 'laporan-insiden.create',
        'persetujuan.view', 'persetujuan.act',
        'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        'pengaturan.alur', 'pengaturan.role', 'pengaturan.user',
    ];

    foreach ($expected as $perm) {
        expect(Permission::where('name', $perm)->exists())->toBeTrue("Permission {$perm} does not exist");
    }
});

it('protects system roles with is_system flag and default unit_scope', function () {
    $kasubag = Role::findByName('kasubag');
    expect($kasubag->is_system)->toBeTrue()
        ->and($kasubag->unit_scope)->toBe('all')
        ->and($kasubag->hasPermissionTo('pengaturan.role'))->toBeTrue();

    $camat = Role::findByName('camat');
    expect($camat->is_system)->toBeTrue()
        ->and($camat->unit_scope)->toBe('binaan')
        ->and($camat->hasPermissionTo('persetujuan.act'))->toBeTrue();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=PermissionCatalogSeederTest`  
Expected: FAIL.

- [ ] **Step 3: Implementasikan update pada RoleSeeder dan PermissionSeeder**

`database/seeders/RoleSeeder.php`:
```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public const SYSTEM_ROLES = [
        'kasubag' => [
            'display_name' => 'Kasubag Kepegawaian & Umum',
            'unit_scope' => 'all',
            'description' => 'Administrator penuh seluruh modul dan unit kerja.',
        ],
        'camat' => [
            'display_name' => 'Camat Sagulung',
            'unit_scope' => 'binaan',
            'description' => 'Pimpinan kecamatan, dapat melihat unit kecamatan dan kelurahan binaan.',
        ],
        'admin_kecamatan' => [
            'display_name' => 'Admin Kecamatan',
            'unit_scope' => 'own',
            'description' => 'Operator pengelola aset dan mutasi di tingkat kecamatan.',
        ],
        'admin_kelurahan' => [
            'display_name' => 'Admin Kelurahan',
            'unit_scope' => 'own',
            'description' => 'Operator pengelola aset dan permohonan di tingkat kelurahan.',
        ],
        'lurah' => [
            'display_name' => 'Lurah',
            'unit_scope' => 'own',
            'description' => 'Pimpinan kelurahan untuk persetujuan dokumen tingkat kelurahan.',
        ],
    ];

    public function run(): void
    {
        foreach (self::SYSTEM_ROLES as $name => $meta) {
            $role = Role::findOrCreate($name);
            $role->update([
                'display_name' => $meta['display_name'],
                'unit_scope' => $meta['unit_scope'],
                'is_system' => true,
                'description' => $meta['description'],
            ]);
        }
    }
}
```

`database/seeders/PermissionSeeder.php`:
Perbarui daftar permission dan pemetaan default ke role bawaan:
```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    public const PERMISSION_GROUPS = [
        'Dashboard' => ['dashboard.view'],
        'Data Aset' => [
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label',
            'import-aset', 'export-aset',
        ],
        'Scan QR' => ['scan.view'],
        'Kategori Aset' => [
            'kategori.view', 'kategori.create', 'kategori.update', 'kategori.delete',
            'import-kategori', 'export-kategori',
        ],
        'Data Pegawai' => [
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete',
            'pegawai.create-user', 'import-pegawai', 'export-pegawai',
        ],
        'Penerimaan Aset' => [
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
        ],
        'Mutasi Aset' => ['mutasi.view', 'mutasi.create'],
        'Permohonan Aset' => ['permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close'],
        'Lapor Insiden' => ['laporan-insiden.view', 'laporan-insiden.create'],
        'Persetujuan' => ['persetujuan.view', 'persetujuan.act'],
        'Laporan' => ['laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang'],
        'Pengaturan' => ['pengaturan.alur', 'pengaturan.role', 'pengaturan.user'],
    ];

    public function run(): void
    {
        // 1. Buat semua permission
        foreach (self::PERMISSION_GROUPS as $group => $permissions) {
            foreach ($permissions as $perm) {
                Permission::findOrCreate($perm);
            }
        }

        // 2. Beri hak default ke role sistem
        $kasubag = Role::findOrCreate('kasubag');
        $kasubag->syncPermissions(Permission::all());

        $camat = Role::findOrCreate('camat');
        $camat->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $adminKecamatan = Role::findOrCreate('admin_kecamatan');
        $adminKecamatan->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $adminKelurahan = Role::findOrCreate('admin_kelurahan');
        $adminKelurahan->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $lurah = Role::findOrCreate('lurah');
        $lurah->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=PermissionCatalogSeederTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/seeders/RoleSeeder.php database/seeders/PermissionSeeder.php tests/Feature/PermissionCatalogSeederTest.php
git commit -m "feat(rbac): expand permission catalog and define default grants for system roles"
```

---

### Task 3: Refaktor Policies dari Hardcoded Role ke Dynamic Permission

**Files:**
- Modify: `app/Policies/AssetPolicy.php`
- Modify: `app/Policies/AssetCategoryPolicy.php`
- Modify: `app/Policies/PegawaiPolicy.php`
- Modify: `app/Policies/AssetMutationPolicy.php`
- Modify: `app/Policies/AssetReportPolicy.php`
- Modify: `app/Policies/BeritaAcaraPenerimaanPolicy.php`
- Modify: `app/Policies/WorkflowDefinitionPolicy.php`
- Test: `tests/Feature/PolicyDynamicPermissionTest.php`

**Interfaces:**
- Consumes: `$user->can('permission_name')` dan `$user->canAccessUnit($model->unit)`.
- Produces: Seluruh Gate check terhubung ke database permission dan scope unit.

- [ ] **Step 1: Tulis test policy dengan permission dinamis**

`tests/Feature/PolicyDynamicPermissionTest.php`:
```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->unit = Unit::create(['name' => 'Unit Uji', 'type' => 'kelurahan']);
    $this->category = AssetCategory::create(['name' => 'Elektronik']);
});

it('allows custom role with aset.create permission to create assets', function () {
    $customRole = Role::create(['name' => 'operator_khusus', 'unit_scope' => 'own']);
    $customRole->givePermissionTo('aset.create', 'aset.view');

    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', Asset::class))->toBeTrue();
});

it('denies user without aset.create permission even if in valid unit', function () {
    $customRole = Role::create(['name' => 'viewer_only', 'unit_scope' => 'own']);
    $customRole->givePermissionTo('aset.view');

    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', Asset::class))->toBeFalse();
});

it('allows user with direct permission override to manage categories', function () {
    $customRole = Role::create(['name' => 'staff_biasa', 'unit_scope' => 'own']);
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', AssetCategory::class))->toBeFalse();

    // Beri izin langsung ke user (user override)
    $user->givePermissionTo('kategori.create');

    expect($user->can('create', AssetCategory::class))->toBeTrue();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=PolicyDynamicPermissionTest`  
Expected: FAIL (`AssetCategoryPolicy` masih mengecek `hasRole('kasubag')`).

- [ ] **Step 3: Refaktor seluruh policy agar memeriksa permission**

Update `app/Policies/AssetCategoryPolicy.php`:
```php
<?php

namespace App\Policies;

use App\Models\AssetCategory;
use App\Models\User;

class AssetCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('kategori.view');
    }

    public function view(User $user, AssetCategory $category): bool
    {
        return $user->hasPermissionTo('kategori.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('kategori.create');
    }

    public function update(User $user, AssetCategory $category): bool
    {
        return $user->hasPermissionTo('kategori.update');
    }

    public function delete(User $user, AssetCategory $category): bool
    {
        return $user->hasPermissionTo('kategori.delete');
    }
}
```

Update `app/Policies/AssetPolicy.php`:
Ganti pengecekan `hasAnyRole(self::VIEWERS)` dan `self::EDITORS` dengan permission:
```php
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('aset.view');
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->hasPermissionTo('aset.view') && $user->canAccessUnit($asset->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('aset.create') && $user->unit_id !== null;
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->hasPermissionTo('aset.update') && $user->canAccessUnit($asset->unit);
    }

    public function delete(User $user, Asset $asset): bool
    {
        return $user->hasPermissionTo('aset.delete') && $user->canAccessUnit($asset->unit);
    }
```

Lakukan refaktor serupa pada:
- `PegawaiPolicy.php`: periksa `pegawai.view`, `pegawai.create`, `pegawai.update`, `pegawai.delete`, `pegawai.create-user`.
- `AssetMutationPolicy.php`: periksa `mutasi.create` + `canAccessUnit`.
- `AssetReportPolicy.php`: periksa `laporan-insiden.create` + `canAccessUnit`.
- `BeritaAcaraPenerimaanPolicy.php`: periksa `penerimaan.view`, `penerimaan.create`, `penerimaan.update`, `penerimaan.delete`, `penerimaan.submit`.
- `WorkflowDefinitionPolicy.php`: periksa `pengaturan.alur`.

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=PolicyDynamicPermissionTest`  
Expected: PASS.

- [ ] **Step 5: Verifikasi regresi seluruh test**

Run: `php artisan test`  
Expected: Seluruh test suite tetap PASS (karena role bawaan telah memiliki permission lengkap dari Seeder).

- [ ] **Step 6: Commit**

```bash
git add app/Policies/ tests/Feature/PolicyDynamicPermissionTest.php
git commit -m "refactor(rbac): migrate authorization policies from hardcoded roles to granular permissions"
```

---

### Task 4: Backend Manajemen Role (Controller, Request, Policy, Routes)

**Files:**
- Create: `app/Http/Requests/StoreRoleRequest.php`
- Create: `app/Http/Requests/UpdateRoleRequest.php`
- Create: `app/Http/Controllers/RoleController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/RoleManagementBackendTest.php`

**Interfaces:**
- Consumes: `$request->validated()` dari form input role & permissions.
- Produces: Endpoint `/pengaturan/roles` (index, store, update, destroy).

- [ ] **Step 1: Tulis test backend manajemen role**

`tests/Feature/RoleManagementBackendTest.php`:
```php
<?php

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create();
    $this->operator->assignRole('admin_kecamatan');
});

it('denies access to role management for users without pengaturan.role permission', function () {
    $this->actingAs($this->operator)
        ->get(route('roles.index'))
        ->assertForbidden();
});

it('allows kasubag to create a new custom role with permissions and unit scope', function () {
    $this->actingAs($this->kasubag)
        ->post(route('roles.store'), [
            'name' => 'auditor_aset',
            'display_name' => 'Auditor Aset BPKAD',
            'unit_scope' => 'all',
            'description' => 'Role audit khusus membaca seluruh aset',
            'permissions' => ['aset.view', 'export-aset', 'laporan.aset'],
        ])
        ->assertRedirect(route('roles.index'));

    $role = Role::findByName('auditor_aset');
    expect($role->display_name)->toBe('Auditor Aset BPKAD')
        ->and($role->is_system)->toBeFalse()
        ->and($role->unit_scope)->toBe('all')
        ->and($role->hasPermissionTo('aset.view'))->toBeTrue()
        ->and($role->hasPermissionTo('aset.create'))->toBeFalse();
});

it('prevents deleting system roles', function () {
    $kasubagRole = Role::findByName('kasubag');

    $this->actingAs($this->kasubag)
        ->delete(route('roles.destroy', $kasubagRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'kasubag')->exists())->toBeTrue();
});

it('prevents deleting custom roles that have active users assigned', function () {
    $customRole = Role::create(['name' => 'staff_khusus', 'unit_scope' => 'own']);
    $user = User::factory()->create();
    $user->assignRole($customRole);

    $this->actingAs($this->kasubag)
        ->delete(route('roles.destroy', $customRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'staff_khusus')->exists())->toBeTrue();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=RoleManagementBackendTest`  
Expected: FAIL (route `roles.index` belum ada).

- [ ] **Step 3: Buat Request dan Controller**

`app/Http/Requests/StoreRoleRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('pengaturan.role');
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:50|regex:/^[a-z0-9_]+$/|unique:roles,name',
            'display_name' => 'required|string|max:100',
            'unit_scope' => 'required|in:all,binaan,own',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ];
    }
}
```

`app/Http/Requests/UpdateRoleRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('pengaturan.role');
    }

    public function rules(): array
    {
        $role = $this->route('role');
        $nameRule = $role->is_system
            ? 'prohibited'
            : 'required|string|max:50|regex:/^[a-z0-9_]+$/|unique:roles,name,'.$role->id;

        return [
            'name' => $nameRule,
            'display_name' => 'required|string|max:100',
            'unit_scope' => 'required|in:all,binaan,own',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ];
    }
}
```

`app/Http/Controllers/RoleController.php`:
```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\UpdateRoleRequest;
use Database\Seeders\PermissionSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('pengaturan.role'), 403);

        $roles = Role::withCount('users')
            ->with('permissions')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name ?? $r->name,
                'unit_scope' => $r->unit_scope,
                'is_system' => (bool) $r->is_system,
                'description' => $r->description,
                'users_count' => $r->users_count,
                'permissions_count' => $r->permissions->count(),
            ]);

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $role = Role::create([
            'name' => $request->validated('name'),
            'display_name' => $request->validated('display_name'),
            'unit_scope' => $request->validated('unit_scope'),
            'description' => $request->validated('description'),
            'is_system' => false,
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->validated('permissions'));
        }

        return redirect()->route('roles.index')->with('success', "Role {$role->display_name} berhasil dibuat.");
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $data = [
            'display_name' => $request->validated('display_name'),
            'unit_scope' => $request->validated('unit_scope'),
            'description' => $request->validated('description'),
        ];

        if (! $role->is_system && $request->filled('name')) {
            $data['name'] = $request->validated('name');
        }

        $role->update($data);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->validated('permissions'));
        }

        return redirect()->route('roles.index')->with('success', "Role {$role->display_name} berhasil diperbarui.");
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->can('pengaturan.role'), 403);

        if ($role->is_system) {
            return back()->with('error', 'Role sistem tidak boleh dihapus.');
        }

        if ($role->users()->exists()) {
            return back()->with('error', 'Role ini masih digunakan oleh pengguna aktif dan tidak dapat dihapus.');
        }

        $role->delete();

        return redirect()->route('roles.index')->with('success', 'Role berhasil dihapus.');
    }
}
```

Daftarkan rute di `routes/web.php` di dalam grup `middleware('auth')`:
```php
Route::resource('pengaturan/roles', RoleController::class)->except(['create', 'edit', 'show'])->names('roles');
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=RoleManagementBackendTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/StoreRoleRequest.php app/Http/Requests/UpdateRoleRequest.php app/Http/Controllers/RoleController.php routes/web.php tests/Feature/RoleManagementBackendTest.php
git commit -m "feat(rbac): implement role management controller, requests, and routes"
```

---

### Task 5: Backend User Permission Override (Pengguna Spesial)

**Files:**
- Create: `app/Http/Requests/UpdateUserAccessRequest.php`
- Modify: `app/Http/Controllers/PegawaiController.php`
- Modify: `app/Services/PegawaiService.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/UserAccessOverrideTest.php`

**Interfaces:**
- Consumes: User ID, `role`, `direct_permissions`, `unit_scope_override`.
- Produces: Sinkronisasi role dan direct permission pada model `User`.

- [ ] **Step 1: Tulis test override akses user**

`tests/Feature/UserAccessOverrideTest.php`:
```php
<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');

    $this->unit = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan']);
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->unit->id]);
});

it('allows kasubag to grant direct permissions to a specific user on top of base role', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole('admin_kelurahan');
    $this->pegawai->update(['user_id' => $user->id]);

    expect($user->can('import-kategori'))->toBeFalse();

    $this->actingAs($this->kasubag)
        ->post(route('pegawais.user-access', $this->pegawai), [
            'role' => 'admin_kelurahan',
            'direct_permissions' => ['import-kategori'],
            'unit_scope_override' => null,
        ])
        ->assertRedirect();

    $user->refresh();
    expect($user->hasRole('admin_kelurahan'))->toBeTrue()
        ->and($user->hasDirectPermission('import-kategori'))->toBeTrue()
        ->and($user->can('import-kategori'))->toBeTrue();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=UserAccessOverrideTest`  
Expected: FAIL.

- [ ] **Step 3: Implementasikan FormRequest dan Controller endpoint**

`app/Http/Requests/UpdateUserAccessRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('pegawai.create-user') || $this->user()->can('pengaturan.user');
    }

    public function rules(): array
    {
        return [
            'role' => 'required|string|exists:roles,name',
            'direct_permissions' => 'nullable|array',
            'direct_permissions.*' => 'string|exists:permissions,name',
            'unit_scope_override' => 'nullable|in:all,binaan,own',
        ];
    }
}
```

Update `app/Services/PegawaiService.php`:
Tambahkan method:
```php
    public function updateUserAccess(User $user, string $role, array $directPermissions = [], ?string $scopeOverride = null): void
    {
        DB::transaction(function () use ($user, $role, $directPermissions, $scopeOverride) {
            $user->syncRoles([$role]);
            $user->syncPermissions($directPermissions);
            $user->update(['unit_scope_override' => $scopeOverride]);
        });
    }
```

Update `app/Http/Controllers/PegawaiController.php`:
Tambahkan method `updateUserAccess`:
```php
    public function updateUserAccess(UpdateUserAccessRequest $request, Pegawai $pegawai): RedirectResponse
    {
        abort_unless($pegawai->user !== null, 404, 'Pegawai ini belum memiliki akun.');

        $this->service->updateUserAccess(
            $pegawai->user,
            $request->validated('role'),
            $request->validated('direct_permissions', []),
            $request->validated('unit_scope_override'),
        );

        return back()->with('success', "Akses akun {$pegawai->nama} berhasil diperbarui.");
    }
```

Tambahkan rute di `routes/web.php`:
```php
Route::post('/pegawais/{pegawai}/user-access', [PegawaiController::class, 'updateUserAccess'])->name('pegawais.user-access');
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=UserAccessOverrideTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/UpdateUserAccessRequest.php app/Services/PegawaiService.php app/Http/Controllers/PegawaiController.php routes/web.php tests/Feature/UserAccessOverrideTest.php
git commit -m "feat(rbac): add user-level direct permissions override and access update endpoint"
```

---

### Task 6: Navigasi Frontend Dinamis Berbasis Permission

**Files:**
- Modify: `resources/js/config/navigation.ts`
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx`
- Test: `tests/Feature/DynamicNavigationPropsTest.php`

**Interfaces:**
- Consumes: `auth.user.permissions` dari props Inertia.
- Produces: Sidebar dinamis yang hanya menampilkan tautan sesuai hak akses pengguna.

- [ ] **Step 1: Tulis test shared permissions Inertia untuk navigasi**

`tests/Feature/DynamicNavigationPropsTest.php`:
```php
<?php

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
});

it('shares accurate user permissions to inertia props', function () {
    $role = Role::create(['name' => 'operator_laporan', 'unit_scope' => 'own']);
    $role->givePermissionTo('dashboard.view', 'laporan.aset');

    $user = User::factory()->create();
    $user->assignRole($role);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('auth.user.permissions', 2)
            ->where('auth.user.permissions', fn ($perms) => in_array('dashboard.view', $perms->toArray()) && in_array('laporan.aset', $perms->toArray()))
        );
});
```

- [ ] **Step 2: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=DynamicNavigationPropsTest`  
Expected: PASS.

- [ ] **Step 3: Perbarui konfigurasi navigasi frontend**

Update `resources/js/config/navigation.ts`:
Ubah antarmuka `NavItem` dari `roles?: Role[]` menjadi `permission?: string`:
```typescript
export interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: string | number;
    disabled?: boolean;
    permission?: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
    {
        title: 'UTAMA',
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: 'grid', permission: 'dashboard.view' },
        ],
    },
    {
        title: 'DATA MASTER',
        items: [
            { label: 'Data Aset', href: '/assets', icon: 'package', permission: 'aset.view' },
            { label: 'Scan QR', href: '/scan', icon: 'qr-code', permission: 'scan.view' },
            { label: 'Kategori Aset', href: '/asset-categories', icon: 'layers', permission: 'kategori.view' },
            { label: 'Data Pegawai', href: '/pegawais', icon: 'users', permission: 'pegawai.view' },
        ],
    },
    {
        title: 'TRANSAKSI',
        items: [
            { label: 'Penerimaan Aset', href: '/penerimaan-aset', icon: 'download', permission: 'penerimaan.view' },
            { label: 'Mutasi Aset', href: '/asset-mutations', icon: 'shuffle', permission: 'mutasi.view' },
            { label: 'Kotak Persetujuan', href: '/persetujuan', icon: 'check-square', permission: 'persetujuan.view' },
            { label: 'Permohonan Aset', href: '/asset-requests', icon: 'file-text', permission: 'permohonan.view' },
            { label: 'Lapor Rusak/Hilang', href: '/asset-reports', icon: 'alert-triangle', permission: 'laporan-insiden.view' },
        ],
    },
    {
        title: 'LAPORAN',
        items: [
            { label: 'Laporan Aset', href: '/laporan-aset', icon: 'bar-chart', permission: 'laporan.aset' },
            { label: 'Laporan Mutasi', href: '/laporan-mutasi', icon: 'shuffle', permission: 'laporan.mutasi' },
            { label: 'Laporan Rusak & Hilang', href: '/laporan-rusak-hilang', icon: 'alert-triangle', permission: 'laporan.rusak-hilang' },
        ],
    },
    {
        title: 'PENGATURAN',
        items: [
            { label: 'Pengaturan Alur', href: '/pengaturan/alur', icon: 'settings', permission: 'pengaturan.alur' },
            { label: 'Pengaturan Role', href: '/pengaturan/roles', icon: 'shield', permission: 'pengaturan.role' },
        ],
    },
];

export function navGroupsForPermissions(permissions: string[] = []): NavGroup[] {
    return SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
        ),
    })).filter((group) => group.items.length > 0);
}
```

Update `resources/js/Layouts/AuthenticatedLayout.tsx`:
Ganti pemanggilan `navGroupsForRole` dengan:
```typescript
    const permissions = auth.user?.permissions ?? [];
    const navGroups = navGroupsForPermissions(permissions);
```

- [ ] **Step 4: Jalankan verifikasi TypeScript**

Run: `npx tsc --noEmit`  
Expected: PASS (0 errors).

- [ ] **Step 5: Commit**

```bash
git add resources/js/config/navigation.ts resources/js/Layouts/AuthenticatedLayout.tsx tests/Feature/DynamicNavigationPropsTest.php
git commit -m "feat(rbac): refactor sidebar navigation to filter by user permissions instead of hardcoded roles"
```

---

### Task 7: Antarmuka UI Manajemen Role (`/pengaturan/roles`)

**Files:**
- Create: `resources/js/Pages/Roles/Index.tsx`
- Create: `resources/js/Pages/Roles/RoleModal.tsx`
- Modify: `resources/js/types/index.d.ts`

**Interfaces:**
- Consumes: Props `roles`, `permissionGroups`.
- Produces: UI daftar role, badge scope unit, status sistem terproteksi, modal form create/edit role dengan matriks permission per modul.

- [ ] **Step 1: Tambahkan tipe TypeScript**

Di `resources/js/types/index.d.ts`:
```typescript
export interface RoleItem {
    id: number;
    name: string;
    display_name: string;
    unit_scope: 'all' | 'binaan' | 'own';
    is_system: boolean;
    description: string | null;
    users_count: number;
    permissions_count: number;
}
```

- [ ] **Step 2: Buat komponen RoleModal dan halaman Index**

`resources/js/Pages/Roles/RoleModal.tsx`:
Komponen modal form untuk tambah / edit role:
- Input Technical Name & Display Name.
- Pilihan Unit Scope radio: *Semua Unit*, *Unit & Binaan Kelurahan*, *Unit Sendiri Saja*.
- Input Deskripsi.
- Matriks permission per modul dengan tombol *Pilih Semua* / *Hapus Semua* per grup modul.

`resources/js/Pages/Roles/Index.tsx`:
Halaman tabel daftar role:
- Header dengan judul "Manajemen Role & Hak Akses" dan tombol "+ Tambah Role Baru".
- Kolom tabel: Nama Role, Display Name, Cakupan Data (Badge), Tipe (Badge Sistem vs Kustom), Jumlah Pengguna, Aksi (Edit, Hapus).
- Tombol Hapus otomatis dinonaktifkan dengan tooltip jika `is_system` bernilai true atau `users_count > 0`.

- [ ] **Step 3: Jalankan typecheck dan build**

Run: `npx tsc --noEmit && npm run build`  
Expected: PASS (0 errors, build successful).

- [ ] **Step 4: Commit**

```bash
git add resources/js/types/index.d.ts resources/js/Pages/Roles/
git commit -m "feat(rbac): implement role management UI with permission matrix"
```

---

### Task 8: Antarmuka UI Pengaturan Hak Akses User (User Override Modal)

**Files:**
- Create: `resources/js/Pages/Pegawai/UserAccessModal.tsx`
- Modify: `resources/js/Pages/Pegawai/Index.tsx`
- Test: `tests/Feature/PegawaiUserAccessModalTest.php`

**Interfaces:**
- Consumes: Data pegawai dengan akun user, daftar role aktif, katalog permission.
- Produces: Tombol "Atur Akses" di tabel pegawai yang membuka modal untuk mengganti role dan mencentang izin tambahan khusus (user override).

- [ ] **Step 1: Buat komponen UserAccessModal**

`resources/js/Pages/Pegawai/UserAccessModal.tsx`:
Modal yang menampilkan:
- Dropdown Role Utama.
- Ringkasan permission dari Role yang terpilih (ditandai centang disabled).
- Bagian collapsible: "Izin Tambahan Khusus (User Override)" yang memungkinkan admin mencentang permission tambahan yang belum ada di role-nya.
- Dropdown Override Cakupan Data Unit (opsional).

- [ ] **Step 2: Integrasikan ke Pegawai/Index.tsx**

Pada baris tabel pegawai yang sudah memiliki akun user, tambahkan tombol ikon / link "Kelola Akses" yang membuka `UserAccessModal`.

- [ ] **Step 3: Jalankan typecheck dan build**

Run: `npx tsc --noEmit && npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Pegawai/UserAccessModal.tsx resources/js/Pages/Pegawai/Index.tsx
git commit -m "feat(rbac): add user access modal for managing user roles and direct permissions"
```

---

### Task 9: Verifikasi Penuh & Audit Ponytail Akhir

**Files:**
- Modify: `docs/ops/queue-setup.md` atau `docs/superpowers/specs/2026-10-09-rbac-v2-dynamic-roles-design.md`

- [ ] **Step 1: Jalankan seluruh test suite Pest**

Run: `php artisan test`  
Expected: Seluruh 536+ test hijau (100% PASS, 0 failures).

- [ ] **Step 2: Jalankan typecheck frontend & production build**

Run: `npx tsc --noEmit && npm run build`  
Expected: 0 errors, asset production terkompilasi bersih.

- [ ] **Step 3: Jalankan migration & seeder di database lokal**

Run: `php artisan migrate && php artisan db:seed --class=RoleSeeder && php artisan db:seed --class=PermissionSeeder`  
Expected: Database dev terisi dengan role terproteksi dan katalog permission terbaru.

- [ ] **Step 4: Commit akhir**

```bash
git add .
git commit -m "chore(rbac): complete RBAC v2 dynamic roles verification"
```
