# Semua Hak Akses Dikelola dari Menu Pengaturan Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap permission di menu Role benar-benar ditegakkan, tidak ada nama role bawaan yang tertanam di aturan bisnis, dan seeder/deploy tidak menimpa perubahan dari menu Role.

**Architecture:** Enam task berurutan. Seeder dijinakkan dulu (T1), lalu penanda "pimpinan unit" di role (T2), `persetujuan.act` dan `persetujuan.reassign` di mesin persetujuan (T3), tiga permission yang tadinya hantu (T4), invarian terkunci keluar lewat `App\Support\AccessGuard` (T5), terakhir pembersihan katalog, migrasi data aditif, dan test penjaga katalog (T6).

**Tech Stack:** Laravel 13, spatie/laravel-permission, Pest (SQLite `:memory:`), Inertia + React/TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-09-permission-sepenuhnya-dinamis-design.md`

## Global Constraints

- Katalog sumber tunggal: `PermissionSeeder::PERMISSION_GROUPS`. Dihapus: `penerimaan.submit`, `pengaturan.user`. Ditambah: `persetujuan.reassign`.
- Menyetujui/menolak butuh langkah alur yang menunjuk pengguna **dan** `persetujuan.act` (ketiga tipe approver: `role`, `user`, `atasan_unit`).
- Pimpinan unit: kolom `roles.unit_head_of` (`null`/`kecamatan`/`kelurahan`); atasan unit = pengguna dengan role bertanda sama dengan jenis unit pengaju **dan** `canAccessUnit($unit)`.
- Invarian terkunci keluar: selalu ada minimal satu pengguna aktif yang memegang `pengaturan.role` dan `user.manage-access`; tidak ada pengecekan nama `kasubag` yang tersisa.
- Seeder tidak pernah menimpa: `PermissionSeeder` hanya memberi default ke role sistem yang belum punya permission; `RoleSeeder` hanya mengisi atribut saat role dibuat.
- Migrasi data aditif dan idempoten; hak efektif sebelum dan sesudah migrasi sama; cache permission dibersihkan.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude**, jangan push.
- Jangan menguji lewat browser kecuali pengguna memerintahkan; frontend diverifikasi dengan `npx tsc --noEmit` dan `npm run build`.
- Nama fungsi helper Pest harus unik antar berkas; helper baru berawalan `pd` (permission dinamis).
- Edit berkas PHP bernamespace dengan alat Edit (backslash ganda hilang di skrip Python); skrip TSX tanpa backslash boleh lewat Python dari berkas (simpan dengan alat Write ke folder scratchpad).
- `php artisan test` penuh lebih dari 2 menit: jalankan di latar belakang atau pakai `--filter`.
- Setelah mengubah default permission, test lama yang membuat approver tanpa `persetujuan.act` perlu diberi izin itu; periksa dengan `php artisan test --filter=...` per task dan perbaiki test (bukan perilaku) yang pecah karena aturan baru.

## Review Focus

Kondisi yang tersirat di spec tetapi tidak disebut tegas, urut dari yang paling mungkin terjadi pada pengguna:

1. **Alih tugas ke pengguna tanpa `persetujuan.act`** akan membuat langkah mati (tidak ada yang bisa menyetujui). `reassign()` menolaknya dan daftar kandidat hanya memuat pemegang izin. Diuji di Task 3.
2. **Lingkungan produksi yang sudah berjalan:** approver admin kecamatan/kelurahan, pemegang `permohonan.fulfill`, dan seterusnya harus tetap bisa melakukan hal yang sama setelah migrasi. Diuji di Task 6.
3. **Role dengan nama lain/dicabut penandanya:** `camat` yang penandanya dikosongkan tidak lagi atasan; role kustom bertanda menjadi atasan; atasan di luar cakupan unit tidak sah. Diuji di Task 2.
4. **Seeder dijalankan ulang di produksi:** perubahan nama tampilan, cakupan, dan permission dari menu Role tetap utuh. Diuji di Task 1.
5. **Pemegang akses terakhir mengedit dirinya sendiri** (mencabut role sendiri, atau mencabut izin dari rolenya) harus ditolak, apa pun nama rolenya. Diuji di Task 5.
6. **Permission yang dihapus** hilang dari role dan dari izin efektif pengguna tanpa error. Diuji di Task 6.

---

## File Structure

| Berkas | Perubahan |
|---|---|
| `database/seeders/PermissionSeeder.php`, `RoleSeeder.php` | Default dipindah ke konstanta; tidak menimpa. |
| `docs/ops/queue-setup.md`, `docs/ops/deployment.md` | Hapus perintah/penjelasan yang menimpa permission. |
| `database/migrations/2026_10_13_000001_add_unit_head_of_to_roles_table.php` | Baru: kolom penanda pimpinan. |
| `database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php` | Baru: migrasi data aditif. |
| `app/Models/Role.php`, `app/Http/Controllers/RoleController.php`, `StoreRoleRequest`, `UpdateRoleRequest` | `unit_head_of`; invarian di `UpdateRoleRequest`. |
| `app/Services/ApprovalWorkflowService.php` | Atasan via penanda; `persetujuan.act`; `persetujuan.reassign`. |
| `app/Http/Controllers/WorkflowSettingsController.php` | `can_act` pada opsi role dan user. |
| `app/Policies/BeritaAcaraPenerimaanPolicy.php`, `AssetRequestPolicy.php`, `app/Services/AssetRequestService.php`, `ClosePermohonanRequest`, `AssetRequestController` | `penerimaan.delete`, `permohonan.close`. |
| `app/Http/Requests/UpdateUserRequest.php`, `app/Http/Controllers/UserController.php` | `user.reset-password`; invarian di `update()`. |
| `app/Support/AccessGuard.php` | Baru: invarian terkunci keluar. |
| `resources/js/Pages/Roles/{RoleModal,Index}.tsx`, `resources/js/types/index.d.ts`, `resources/js/Pages/WorkflowSettings/Edit.tsx`, `resources/js/Pages/Users/Edit.tsx` | UI penanda, peringatan, label, penyembunyian kolom sandi. |
| `tests/Feature/{PermissionSeederSafetyTest,UnitHeadRoleTest,ApprovalPermissionTest,EnforcedPermissionsTest,AccessGuardTest,PermissionCatalogTest,PermissionAlignmentMigrationTest}.php` | Pengujian baru. |

---

### Task 1: Seeder tidak menimpa pengaturan dari menu Role

**Files:**
- Create: `tests/Feature/PermissionSeederSafetyTest.php`
- Modify: `database/seeders/PermissionSeeder.php`, `database/seeders/RoleSeeder.php`, `docs/ops/queue-setup.md`, `docs/ops/deployment.md`

**Interfaces:**
- Produces: `PermissionSeeder::DEFAULTS` (`nama role => list<string>`, tanpa `kasubag` yang menerima semua permission); `PermissionSeeder::run()` hanya memberi default ke role sistem yang belum punya permission; `RoleSeeder::run()` hanya mengisi atribut saat role dibuat.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/PermissionSeederSafetyTest.php`:

```php
<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;

function pdSeed(): void
{
    test()->seed(RoleSeeder::class);
    test()->seed(PermissionSeeder::class);
}

it('gives the defaults to brand new system roles', function () {
    pdSeed();

    $camat = Role::findByName('camat');

    expect($camat->unit_scope)->toBe('binaan')
        ->and($camat->is_system)->toBeTrue()
        ->and($camat->hasPermissionTo('persetujuan.view'))->toBeTrue()
        ->and(Role::findByName('kasubag')->permissions()->count())->toBe(Permission::count());
});

it('never overwrites what was changed from the role menu when seeded again', function () {
    pdSeed();

    Role::findByName('camat')->update(['display_name' => 'Camat Kustom', 'unit_scope' => 'all', 'description' => 'diubah']);
    Role::findByName('camat')->syncPermissions(['dashboard.view']);
    Role::findByName('admin_kecamatan')->revokePermissionTo('aset.delete');

    pdSeed();

    $camat = Role::findByName('camat');

    expect($camat->display_name)->toBe('Camat Kustom')
        ->and($camat->unit_scope)->toBe('all')
        ->and($camat->description)->toBe('diubah')
        ->and($camat->is_system)->toBeTrue()
        ->and($camat->permissions->pluck('name')->all())->toBe(['dashboard.view'])
        ->and(Role::findByName('admin_kecamatan')->hasPermissionTo('aset.delete'))->toBeFalse();
});

it('still creates a permission that is missing from the database without touching existing roles', function () {
    pdSeed();
    Permission::where('name', 'laporan.aset')->delete();
    Role::findByName('lurah')->syncPermissions(['dashboard.view']);

    pdSeed();

    expect(Permission::where('name', 'laporan.aset')->exists())->toBeTrue()
        ->and(Role::findByName('lurah')->permissions->pluck('name')->all())->toBe(['dashboard.view']);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=PermissionSeederSafetyTest`
Expected: FAIL pada test kedua dan ketiga (seeder menimpa).

- [ ] **Step 3: Implementasi**

Ganti seluruh isi `database/seeders/PermissionSeeder.php` dengan:

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
        'Pengaturan' => [
            'pengaturan.alur',
            'pengaturan.role',
            'pengaturan.user',
            'user.view',
            'user.manage-access',
            'user.reset-password',
            'user.toggle-status',
            'user.delete',
        ],
    ];

    /** Default role sistem selain `kasubag` (yang menerima semua permission). Hanya dipakai saat role belum punya permission. */
    public const DEFAULTS = [
        'camat' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'admin_kecamatan' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'export-pegawai',
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'admin_kelurahan' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'export-pegawai',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'lurah' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
    ];

    public function run(): void
    {
        foreach (self::PERMISSION_GROUPS as $permissions) {
            foreach ($permissions as $permission) {
                Permission::findOrCreate($permission);
            }
        }

        // Default hanya untuk role sistem yang belum punya permission; tidak pernah menimpa pengaturan dari menu Role.
        foreach (['kasubag' => Permission::all(), ...self::DEFAULTS] as $name => $permissions) {
            $role = Role::findOrCreate($name);

            if ($role->permissions()->doesntExist()) {
                $role->syncPermissions($permissions);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
```

Ganti isi method `run()` di `database/seeders/RoleSeeder.php` dengan:

```php
    public function run(): void
    {
        foreach (self::SYSTEM_ROLES as $name => $meta) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web'], $meta + ['is_system' => true]);

            if (! $role->is_system) {
                $role->update(['is_system' => true]);
            }
        }
    }
```

`docs/ops/queue-setup.md` (alat Edit):
1. Hapus baris `php artisan db:seed --class=PermissionSeeder --force` pada daftar langkah deploy.
2. Ganti kalimat "`PermissionSeeder` menugaskan permission default ke role sistem (menimpa permission role sistem, cek dulu bila sudah dikustom)." dengan "Permission baru tiba lewat migrasi data yang aditif (berjalan bersama `migrate`); seeder tidak menimpa role yang sudah punya permission, jadi perubahan dari menu Pengaturan Role aman."

`docs/ops/deployment.md` (alat Edit): ganti kalimat "`PermissionSeeder` tidak dijalankan otomatis karena menimpa permission role sistem; jalankan manual hanya bila rilis menambah permission: `docker compose -f compose.prod.yaml run --rm app php artisan db:seed --class=PermissionSeeder --force`." dengan "Permission baru tiba lewat migrasi data yang aditif dan berjalan bersama `migrate`; `PermissionSeeder` tidak perlu dijalankan saat deploy dan tidak menimpa role yang sudah punya permission."

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="PermissionSeederSafetyTest|RoleSeeder|PermissionSeeder|PolicyRevocationTest|UserAccessGuardTest|RoleSystemGuardTest"`
Expected: PASS. Bila test lama yang berharap seeder memulihkan permission setelah dicabut pecah, ubah test itu agar mengatur permission secara langsung (aturan baru memang tidak memulihkan).

- [ ] **Step 5: Commit**

```bash
git add database/seeders/PermissionSeeder.php database/seeders/RoleSeeder.php tests/Feature/PermissionSeederSafetyTest.php docs/ops/queue-setup.md docs/ops/deployment.md
git commit -m "fix(seeders): never overwrite role permissions, scope or names changed from the role menu"
```

---

### Task 2: Pimpinan unit lewat penanda di role

**Files:**
- Create: `database/migrations/2026_10_13_000001_add_unit_head_of_to_roles_table.php`, `tests/Feature/UnitHeadRoleTest.php`
- Modify: `database/seeders/RoleSeeder.php`, `app/Http/Controllers/RoleController.php`, `app/Http/Requests/StoreRoleRequest.php`, `app/Http/Requests/UpdateRoleRequest.php`, `app/Services/ApprovalWorkflowService.php`, `resources/js/types/index.d.ts`, `resources/js/Pages/Roles/RoleModal.tsx`, `resources/js/Pages/Roles/Index.tsx`

**Interfaces:**
- Produces: kolom `roles.unit_head_of` (`null|kecamatan|kelurahan`); `RoleSeeder::SYSTEM_ROLES['camat']['unit_head_of'] = 'kecamatan'`, `['lurah'] = 'kelurahan'`; prop role `unit_head_of`; `ApprovalWorkflowService` memakai penanda untuk tipe `atasan_unit`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/UnitHeadRoleTest.php`:

```php
<?php

use App\Models\AssetMutation;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kelA);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kelA);
    $this->engine = app(ApprovalWorkflowService::class);
});

function pdHead(string $name, ?string $headOf, $unit): User
{
    $role = Role::create(['name' => $name, 'display_name' => ucfirst($name), 'unit_scope' => 'own', 'unit_head_of' => $headOf, 'is_system' => false]);
    $role->givePermissionTo('persetujuan.view', 'persetujuan.act');

    return User::factory()->create(['unit_id' => $unit->id])->assignRole($role);
}

function pdReturn(object $t, $unit, $creator)
{
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'UH/'.uniqid(), 'jenis_mutasi' => 'pengembalian', 'origin_unit_id' => $unit->id,
        'destination_unit_id' => $unit->id, 'tanggal_mutasi' => '2026-10-09', 'status' => 'pending', 'created_by' => $creator->id,
    ]);

    return $t->engine->submit($mutation, 'pengembalian_aset', $creator);
}

it('marks the bundled camat and lurah roles as unit heads', function () {
    expect(Role::findByName('camat')->unit_head_of)->toBe('kecamatan')
        ->and(Role::findByName('lurah')->unit_head_of)->toBe('kelurahan');
});

it('treats a custom role marked as head of kecamatan as the atasan unit, and an unmarked camat as not', function () {
    $sekcam = pdHead('sekcam', 'kecamatan', $this->kec);
    $request = pdReturn($this, $this->kec, $this->adminKec)->fresh();

    expect($this->engine->canAct($this->camat, $request))->toBeTrue()
        ->and($this->engine->canAct($sekcam, $request))->toBeTrue();

    Role::findByName('camat')->update(['unit_head_of' => null]);
    $this->camat = $this->camat->fresh();

    expect($this->engine->canAct($this->camat, $request))->toBeFalse()
        ->and($this->engine->canAct($sekcam, $request))->toBeTrue();
});

it('matches the head to the kind of unit and keeps it inside the unit scope', function () {
    $headKel = pdHead('kepala_kel', 'kelurahan', $this->kelB);
    $request = pdReturn($this, $this->kelA, $this->adminKel)->fresh();

    expect($this->engine->canAct($this->lurah, $request))->toBeTrue()
        ->and($this->engine->canAct($this->camat, $request))->toBeFalse()
        ->and($this->engine->canAct($headKel, $request))->toBeFalse();
});

it('notifies exactly the atasan unit of the requesting unit', function () {
    $sekcam = pdHead('sekcam', 'kecamatan', $this->kec);

    pdReturn($this, $this->kec, $this->adminKec);

    expect($this->camat->notifications()->count())->toBe(1)
        ->and($sekcam->notifications()->count())->toBe(1)
        ->and($this->lurah->notifications()->count())->toBe(0);
});

it('saves and lists unit_head_of from the role menu and rejects an unknown value', function () {
    $this->actingAs($this->kasubag)->post(route('roles.store'), [
        'name' => 'kepala_x', 'display_name' => 'Kepala X', 'unit_scope' => 'own', 'unit_head_of' => 'kelurahan', 'permissions' => [],
    ])->assertSessionHasNoErrors();

    $role = Role::findByName('kepala_x');
    expect($role->unit_head_of)->toBe('kelurahan');

    $this->actingAs($this->kasubag)->put(route('roles.update', $role), [
        'name' => 'kepala_x', 'display_name' => 'Kepala X', 'unit_scope' => 'own', 'unit_head_of' => 'provinsi', 'permissions' => [],
    ])->assertSessionHasErrors('unit_head_of');

    $this->actingAs($this->kasubag)->get(route('roles.index'))
        ->assertInertia(fn ($page) => $page->where('roles', fn ($roles) => collect($roles)->firstWhere('name', 'camat')['unit_head_of'] === 'kecamatan'));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=UnitHeadRoleTest`
Expected: FAIL (kolom `unit_head_of` belum ada).

- [ ] **Step 3: Backend**

Migrasi `database/migrations/2026_10_13_000001_add_unit_head_of_to_roles_table.php`:

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
            $table->string('unit_head_of', 20)->nullable()->after('unit_scope');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('unit_head_of');
        });
    }
};
```

`database/seeders/RoleSeeder.php`: pada `'camat' => [...]` tambahkan `'unit_head_of' => 'kecamatan',` setelah `'unit_scope' => 'binaan',`; pada `'lurah' => [...]` tambahkan `'unit_head_of' => 'kelurahan',` setelah `'unit_scope' => 'own',`.

`app/Http/Requests/StoreRoleRequest.php` dan `UpdateRoleRequest.php`: pada array `rules()` tambahkan `'unit_head_of' => 'nullable|in:kecamatan,kelurahan',` setelah baris `'unit_scope' => 'required|in:all,binaan,own',`.

`app/Http/Controllers/RoleController.php`:
- `index`: tambahkan `'unit_head_of' => $r->unit_head_of,` setelah `'unit_scope' => $r->unit_scope,`.
- `store`: tambahkan `'unit_head_of' => $request->validated('unit_head_of'),` setelah `'unit_scope' => $request->validated('unit_scope'),` pada `Role::create([...])`.
- `update`: tambahkan `'unit_head_of' => $request->validated('unit_head_of'),` setelah `'unit_scope' => $request->validated('unit_scope'),` pada array `$data`.

`app/Services/ApprovalWorkflowService.php` (alat Edit):
1. Ganti `ApproverType::AtasanUnit => User::role($this->atasanRole($approvable))->get(),` dengan:

```php
            ApproverType::AtasanUnit => User::whereHas('roles', fn ($q) => $q->where('unit_head_of', $this->unitKind($approvable)))->get(),
```

2. Ganti method `allowsAtasanUnit` dan `atasanRole` dengan:

```php
    private function allowsAtasanUnit(User $user, Model $approvable): bool
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit
            && $user->roles->contains(fn ($role) => $role->unit_head_of === $this->unitKind($approvable))
            && $user->canAccessUnit($unit);
    }

    /** `kecamatan` atau `kelurahan` menurut jenis unit pengaju; role pimpinan dicocokkan dengan nilai ini. */
    private function unitKind(Model $approvable): ?string
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit ? ($unit->isKecamatan() ? 'kecamatan' : 'kelurahan') : null;
    }
```

- [ ] **Step 4: Frontend**

Simpan dengan alat Write ke `.../scratchpad/pd_unithead.py`, jalankan dari root repo:

```python
def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:70], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


edit('resources/js/types/index.d.ts', [
    ("    unit_scope: 'all' | 'binaan' | 'own';\n    is_system: boolean;",
     "    unit_scope: 'all' | 'binaan' | 'own';\n    unit_head_of: 'kecamatan' | 'kelurahan' | null;\n    is_system: boolean;"),
])

BLOCK = """                        {/* Pimpinan Unit */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Pimpinan Unit (untuk langkah &quot;Atasan Unit&quot;)
                            </label>
                            <select
                                value={unitHeadOf}
                                onChange={(e) => setUnitHeadOf(e.target.value as '' | 'kecamatan' | 'kelurahan')}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                                <option value="">Bukan pimpinan unit</option>
                                <option value="kecamatan">Pimpinan Kecamatan</option>
                                <option value="kelurahan">Pimpinan Kelurahan</option>
                            </select>
                            {errors.unit_head_of && <p className="mt-1 text-xs text-red-600">{errors.unit_head_of}</p>}
                            <p className="mt-1 text-[11px] text-slate-500">
                                Role ini menjadi atasan otomatis bagi pengajuan dari unit sejenis.
                            </p>
                        </div>

"""

edit('resources/js/Pages/Roles/RoleModal.tsx', [
    ("    const [unitScope, setUnitScope] = useState<'all' | 'binaan' | 'own'>('own');\n",
     "    const [unitScope, setUnitScope] = useState<'all' | 'binaan' | 'own'>('own');\n    const [unitHeadOf, setUnitHeadOf] = useState<'' | 'kecamatan' | 'kelurahan'>('');\n"),
    ("            setUnitScope(role.unit_scope);\n", "            setUnitScope(role.unit_scope);\n            setUnitHeadOf(role.unit_head_of ?? '');\n"),
    ("            setUnitScope('own');\n", "            setUnitScope('own');\n            setUnitHeadOf('');\n"),
    ("            unit_scope: unitScope,\n", "            unit_scope: unitScope,\n            unit_head_of: unitHeadOf || null,\n"),
    ("                        {/* Section 3: Description */}\n", BLOCK + "                        {/* Section 3: Description */}\n"),
])

edit('resources/js/Pages/Roles/Index.tsx', [
    ("""                                                        <span className="font-mono text-xs text-slate-400">
                                                            {r.name}
                                                        </span>
""", """                                                        <span className="font-mono text-xs text-slate-400">
                                                            {r.name}
                                                        </span>
                                                        {r.unit_head_of && (
                                                            <span className="mt-1 inline-flex w-fit rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">
                                                                Pimpinan {r.unit_head_of === 'kecamatan' ? 'Kecamatan' : 'Kelurahan'}
                                                            </span>
                                                        )}
"""),
])
print('ok')
```

- [ ] **Step 5: Jalankan dan verifikasi**

Run: `php artisan test --filter="UnitHeadRoleTest|PengembalianWorkflowTest|PengembalianAsetTest|RoleDelegationTest|RoleSystemGuardTest|ApprovalWorkflowServiceTest|WorkflowEngine"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: test PASS; skrip `ok`; `tsc` dan build bersih. Test lama yang mengecek atasan unit lewat role `camat`/`lurah` tetap lulus karena seeder menandai keduanya; bila ada test yang membuat role bernama `camat`/`lurah` tanpa `RoleSeeder`, tambahkan `unit_head_of` pada pembuatannya.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_10_13_000001_add_unit_head_of_to_roles_table.php database/seeders/RoleSeeder.php app/Http/Controllers/RoleController.php app/Http/Requests/StoreRoleRequest.php app/Http/Requests/UpdateRoleRequest.php app/Services/ApprovalWorkflowService.php resources/js/types/index.d.ts resources/js/Pages/Roles/RoleModal.tsx resources/js/Pages/Roles/Index.tsx tests/Feature/UnitHeadRoleTest.php
git commit -m "feat(roles): mark unit heads on the role instead of hardcoding camat and lurah in the approval engine"
```

---

### Task 3: `persetujuan.act` dan `persetujuan.reassign`

**Files:**
- Create: `tests/Feature/ApprovalPermissionTest.php`
- Modify: `database/seeders/PermissionSeeder.php`, `app/Services/ApprovalWorkflowService.php`, `app/Http/Controllers/WorkflowSettingsController.php`, `resources/js/Pages/WorkflowSettings/Edit.tsx`

**Interfaces:**
- Consumes: tanda pimpinan unit (Task 2).
- Produces: katalog memuat `persetujuan.reassign`; `stepAllows` mensyaratkan `persetujuan.act`; `canReassign` = `can('persetujuan.reassign')` dan pending; `reassign()` menolak penerima tanpa `persetujuan.act`; `reassignCandidates()` hanya pemegang `persetujuan.act`; opsi Pengaturan Alur memuat `can_act` untuk role dan user.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ApprovalPermissionTest.php`:

```php
<?php

use App\Models\AssetMutation;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->engine = app(ApprovalWorkflowService::class);
});

function pdStep(string $code, array $attrs): void
{
    WorkflowDefinition::where('code', $code)->firstOrFail()->steps()->update($attrs);
}

function pdPending(object $t)
{
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'AP/'.uniqid(), 'jenis_mutasi' => 'pengembalian', 'origin_unit_id' => $t->kec->id,
        'destination_unit_id' => $t->kec->id, 'tanggal_mutasi' => '2026-10-09', 'status' => 'pending', 'created_by' => $t->adminKec->id,
    ]);

    return $t->engine->submit($mutation, 'pengembalian_aset', $t->adminKec)->fresh();
}

it('requires persetujuan.act on top of the workflow step for an atasan unit step', function () {
    $request = pdPending($this);

    expect($this->engine->canAct($this->camat, $request))->toBeTrue();

    Role::findByName('camat')->revokePermissionTo('persetujuan.act');
    $camat = $this->camat->fresh();

    expect($this->engine->canAct($camat, $request))->toBeFalse()
        ->and(fn () => $this->engine->approve($request, $camat))->toThrow(InvalidArgumentException::class);
});

it('requires persetujuan.act for a role step and a user step too', function () {
    pdStep('pengembalian_aset', ['approver_type' => 'role', 'approver_role' => 'admin_kelurahan', 'approver_user_id' => null, 'unit_scope' => 'none']);
    $adminKel = userWithRole('admin_kelurahan', makeKelurahan($this->kec, 'Kelurahan A'));
    $request = pdPending($this);

    expect($this->engine->canAct($adminKel, $request))->toBeTrue();

    Role::findByName('admin_kelurahan')->revokePermissionTo('persetujuan.act');
    expect($this->engine->canAct($adminKel->fresh(), $request))->toBeFalse();

    pdStep('pengembalian_aset', ['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => $this->camat->id, 'unit_scope' => 'none']);
    $userRequest = pdPending($this);

    expect($this->engine->canAct($this->camat->fresh(), $userRequest))->toBeTrue();
    Role::findByName('camat')->revokePermissionTo('persetujuan.act');
    expect($this->engine->canAct($this->camat->fresh(), $userRequest))->toBeFalse();
});

it('does not notify approvers who lack persetujuan.act', function () {
    Role::findByName('camat')->revokePermissionTo('persetujuan.act');

    pdPending($this);

    expect($this->camat->notifications()->count())->toBe(0);
});

it('lets only holders of persetujuan.reassign hand a step over, and only to someone who can act', function () {
    $request = pdPending($this);
    $target = userWithRole('lurah', makeKelurahan($this->kec, 'Kelurahan B'));

    expect($this->engine->canReassign($this->kasubag, $request))->toBeTrue()
        ->and($this->engine->canReassign($this->camat, $request))->toBeFalse();

    Role::findByName('kasubag')->revokePermissionTo('persetujuan.reassign');
    expect($this->engine->canReassign($this->kasubag->fresh(), $request))->toBeFalse();

    Role::findByName('kasubag')->givePermissionTo('persetujuan.reassign');
    $noAct = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');

    expect(fn () => $this->engine->reassign($request, $this->kasubag->fresh(), $noAct->fresh(), 'tes'))
        ->toThrow(InvalidArgumentException::class, 'izin');

    $this->engine->reassign($request, $this->kasubag->fresh(), $target->fresh(), 'tes');

    expect($this->engine->canAct($target->fresh(), $request->fresh()))->toBeTrue();
});

it('lists only holders of persetujuan.act as reassign candidates', function () {
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');

    $ids = collect($this->engine->reassignCandidates())->pluck('id');

    expect($ids)->toContain($this->camat->id)->not->toContain($this->adminKec->id);
});

it('flags roles and users without persetujuan.act on the workflow settings page', function () {
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();

    $this->actingAs($this->kasubag)->get(route('workflow-settings.edit', $definition))
        ->assertInertia(fn ($page) => $page
            ->where('options.roles', fn ($roles) => collect($roles)->firstWhere('value', 'admin_kecamatan')['can_act'] === false
                && collect($roles)->firstWhere('value', 'camat')['can_act'] === true)
            ->where('options.users', fn ($users) => collect($users)->firstWhere('id', $this->adminKec->id)['can_act'] === false));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ApprovalPermissionTest`
Expected: FAIL (permission belum ditegakkan; `persetujuan.reassign` belum ada).

- [ ] **Step 3: Backend**

`database/seeders/PermissionSeeder.php` (alat Edit):
1. `'Persetujuan' => ['persetujuan.view', 'persetujuan.act'],` menjadi `'Persetujuan' => ['persetujuan.view', 'persetujuan.act', 'persetujuan.reassign'],`.
2. Pada `DEFAULTS['admin_kecamatan']` dan `DEFAULTS['admin_kelurahan']`, tambahkan `'persetujuan.act',` tepat sebelum `'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',` (kedua blok; gunakan alat Edit dengan konteks `'laporan-insiden.view', 'laporan-insiden.create',` yang unik per blok, atau edit baris demi baris).

`app/Services/ApprovalWorkflowService.php` (alat Edit):
1. `canReassign`:

```php
    public function canReassign(User $user, ApprovalRequest $request): bool
    {
        return $user->can('persetujuan.reassign') && $request->status === ApprovalStatus::Pending;
    }
```

2. Dalam `reassign()` ganti pesan `'Hanya Kasubag yang dapat mengalihkan approver pengajuan yang masih pending.'` dengan `'Anda tidak berwenang mengalihkan approver pengajuan ini.'`, dan tepat setelah pemeriksaan `$to->getRoleNames()->isEmpty()` tambahkan:

```php
        if (! $to->can('persetujuan.act')) {
            throw new InvalidArgumentException('Approver tujuan harus memiliki izin Setujui / Tolak.');
        }
```

3. `reassignCandidates()`: tambahkan `->filter(fn (User $u) => $u->can('persetujuan.act'))` sebelum `->map(` (setelah `->get()`).
4. `stepAllows`: bungkus hasil `match` dengan syarat izin:

```php
    private function stepAllows(User $user, ApprovalRequestStep $step, Model $approvable): bool
    {
        return $user->can('persetujuan.act') && match ($step->approver_type) {
            ApproverType::User => $step->approver_user_id !== null && $user->id === $step->approver_user_id,
            ApproverType::AtasanUnit => $this->allowsAtasanUnit($user, $approvable),
            ApproverType::Role => $step->approver_role !== null
                && $user->hasRole($step->approver_role)
                && $this->inUnitScope($user, $step->unit_scope, $approvable),
        };
    }
```

`app/Http/Controllers/WorkflowSettingsController.php`: pada `edit()` ganti pembuatan opsi role dengan versi yang memuat permission dan `can_act`:

```php
                'roles' => Role::with('permissions')->orderBy('name')->get()->map(fn ($r) => [
                    'value' => $r->name,
                    'label' => $r->display_name ?? $r->name,
                    'can_act' => $r->permissions->contains('name', 'persetujuan.act'),
                ])->values(),
```

dan pada opsi `users` tambahkan `'can_act' => $u->can('persetujuan.act'),` setelah `'unit' => $u->unit?->name,`.

- [ ] **Step 4: Frontend**

Simpan dengan alat Write ke `.../scratchpad/pd_workflow.py`, jalankan dari root repo:

```python
def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:70], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


WARN_ROLE = """
                                        {step.approver_role && options.roles.find((r) => r.value === step.approver_role)?.can_act === false && (
                                            <p className="mt-1 text-xs text-amber-700">Role ini belum memegang izin &quot;Setujui / Tolak&quot;; anggotanya tidak akan bisa menyetujui langkah ini.</p>
                                        )}"""
WARN_USER = """
                                    {step.approver_user_id && options.users.find((u) => String(u.id) === String(step.approver_user_id))?.can_act === false && (
                                        <p className="mt-1 text-xs text-amber-700">User ini belum memegang izin &quot;Setujui / Tolak&quot; sehingga tidak akan bisa menyetujui langkah ini.</p>
                                    )}"""

ROLE_ERR = "{errors[`steps.${index}.approver_role`] && <p className=\"mt-1 text-xs text-red-600\">{errors[`steps.${index}.approver_role`]}</p>}"

edit('resources/js/Pages/WorkflowSettings/Edit.tsx', [
    ("interface Option {\n    value: string;\n    label: string;\n}", "interface Option {\n    value: string;\n    label: string;\n    can_act?: boolean;\n}"),
    ("    role: string | null;\n    unit: string | null;\n}", "    role: string | null;\n    unit: string | null;\n    can_act: boolean;\n}"),
    (ROLE_ERR, ROLE_ERR + WARN_ROLE),
    ("<p className=\"mt-1 text-xs text-slate-500\">Hanya user ini yang dapat menyetujui langkah ini.</p>",
     "<p className=\"mt-1 text-xs text-slate-500\">Hanya user ini yang dapat menyetujui langkah ini.</p>" + WARN_USER),
])
print('ok')
```

- [ ] **Step 5: Jalankan dan verifikasi**

Run: `php artisan test --filter="ApprovalPermissionTest|WorkflowSettingsTest|PengembalianWorkflowTest|PengembalianAsetTest|ApprovalWorkflowServiceTest|WorkflowEngine|AssetMutation|AssetReport|AssetRequest|PenerimaanAset|Persetujuan"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: PASS. Test lama yang menunjuk role kustom atau pengguna sebagai approver tanpa `persetujuan.act` pecah karena aturan baru: beri izin itu pada role/pengguna di setup test (jangan melonggarkan aturan), dan ubah test yang mengharapkan pesan lama `Hanya Kasubag...`. Skrip mencetak `ok`; `tsc` dan build bersih.

- [ ] **Step 6: Commit**

```bash
git add database/seeders/PermissionSeeder.php app/Services/ApprovalWorkflowService.php app/Http/Controllers/WorkflowSettingsController.php resources/js/Pages/WorkflowSettings/Edit.tsx tests/Feature/ApprovalPermissionTest.php
git add tests/Feature
git commit -m "feat(approvals): enforce persetujuan.act and the new persetujuan.reassign permission"
```

(Bila `git add tests/Feature` menambah berkas test lama yang diperbaiki di langkah 5, itu memang diinginkan; periksa `git status` agar tidak ada berkas lain yang ikut.)

---

### Task 4: Tegakkan `penerimaan.delete`, `permohonan.close`, `user.reset-password`

**Files:**
- Create: `tests/Feature/EnforcedPermissionsTest.php`
- Modify: `app/Policies/BeritaAcaraPenerimaanPolicy.php`, `app/Policies/AssetRequestPolicy.php`, `app/Services/AssetRequestService.php`, `app/Http/Requests/ClosePermohonanRequest.php`, `app/Http/Controllers/AssetRequestController.php`, `app/Http/Requests/UpdateUserRequest.php`, `app/Http/Controllers/UserController.php`, `resources/js/Pages/Users/Edit.tsx`

**Interfaces:**
- Produces: `BeritaAcaraPenerimaanPolicy::delete` memakai `penerimaan.delete`; `AssetRequestService::canClose(User, AssetRequest): bool`; `AssetRequestPolicy::close`; `UpdateUserRequest` menolak `password` tanpa `user.reset-password`; prop `canResetPassword` pada halaman edit pengguna.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/EnforcedPermissionsTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Pegawai;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create();
});

function pdDraft(object $t): BeritaAcaraPenerimaan
{
    return BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/'.uniqid(), 'tanggal_penerimaan' => '2026-10-09', 'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/1', 'vendor' => 'PT Contoh', 'unit_id' => $t->kec->id, 'created_by' => $t->adminKec->id, 'status' => 'draft',
    ]);
}

function pdApprovedRequest(object $t)
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kec->id]);
    $service = app(AssetRequestService::class);
    $request = $service->create(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh'], $t->adminKec);
    app(ApprovalWorkflowService::class)->approve($request->approvalRequest, $t->camat);

    return $request->fresh();
}

it('deletes a draft penerimaan only with penerimaan.delete, not with penerimaan.update alone', function () {
    $draft = pdDraft($this);
    Role::findByName('admin_kecamatan')->revokePermissionTo('penerimaan.delete');

    $this->actingAs($this->adminKec->fresh())->delete(route('penerimaan-aset.destroy', $draft))->assertForbidden();
    expect(BeritaAcaraPenerimaan::whereKey($draft->id)->exists())->toBeTrue();

    Role::findByName('admin_kecamatan')->givePermissionTo('penerimaan.delete');

    $this->actingAs($this->adminKec->fresh())->delete(route('penerimaan-aset.destroy', $draft))->assertRedirect();
    expect(BeritaAcaraPenerimaan::whereKey($draft->id)->exists())->toBeFalse();
});

it('closes an approved permohonan only with permohonan.close, not with permohonan.fulfill alone', function () {
    $request = pdApprovedRequest($this);
    Role::findByName('admin_kecamatan')->revokePermissionTo('permohonan.close');

    $this->actingAs($this->adminKec->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertForbidden();

    $this->actingAs($this->adminKec->fresh())->get(route('asset-requests.show', $request))
        ->assertInertia(fn ($page) => $page->where('can.close', false)->where('can.fulfill', true));

    Role::findByName('admin_kecamatan')->givePermissionTo('permohonan.close');

    $this->actingAs($this->adminKec->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertRedirect();
});

it('keeps closing out of reach for a holder of permohonan.close who cannot fulfill', function () {
    $request = pdApprovedRequest($this);
    $closer = User::factory()->create(['unit_id' => $this->kec->id])->assignRole(
        Role::create(['name' => 'penutup', 'display_name' => 'Penutup', 'unit_scope' => 'own', 'is_system' => false]),
    );
    Role::findByName('penutup')->givePermissionTo('permohonan.view', 'permohonan.close');

    $this->actingAs($closer->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertRedirect();
    expect($request->fresh()->status->value)->toBe('cancelled');
});

function pdPasswordPayload(User $target, array $extra = []): array
{
    return array_merge([
        'email' => $target->email, 'is_active' => true, 'role' => 'admin_kecamatan',
        'password' => 'password-baru-123', 'password_confirmation' => 'password-baru-123',
    ], $extra);
}

it('lets only holders of user.reset-password change another user password', function () {
    $target = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');
    Role::findByName('kasubag')->revokePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target))
        ->assertSessionHasErrors('password');
    expect(Hash::check('password-baru-123', $target->fresh()->password))->toBeFalse();

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target, ['password' => '', 'password_confirmation' => '']))
        ->assertSessionHasNoErrors();

    Role::findByName('kasubag')->givePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target))->assertSessionHasNoErrors();
    expect(Hash::check('password-baru-123', $target->fresh()->password))->toBeTrue();
});

it('tells the edit page whether the password section may be shown', function () {
    $target = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');

    $this->actingAs($this->kasubag)->get(route('users.edit', $target))->assertInertia(fn ($page) => $page->where('canResetPassword', true));

    Role::findByName('kasubag')->revokePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->get(route('users.edit', $target))->assertInertia(fn ($page) => $page->where('canResetPassword', false));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=EnforcedPermissionsTest`
Expected: FAIL pada kelima test pertama dan keenam (izin belum ditegakkan).

- [ ] **Step 3: Backend**

`app/Policies/BeritaAcaraPenerimaanPolicy.php` (alat Edit): ganti method `delete` dengan:

```php
    public function delete(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $beritaAcara->status === BeritaAcaraStatus::Draft
            && $user->can('penerimaan.delete')
            && $user->unit_id === $beritaAcara->unit_id;
    }
```

`app/Services/AssetRequestService.php` (alat Edit): ganti method `canFulfill` dengan tiga method berikut:

```php
    public function canFulfill(User $user, AssetRequest $request): bool
    {
        return $user->can('permohonan.fulfill') && $this->inFulfillScope($user, $request);
    }

    public function canClose(User $user, AssetRequest $request): bool
    {
        return $user->can('permohonan.close') && $this->inFulfillScope($user, $request);
    }

    private function inFulfillScope(User $user, AssetRequest $request): bool
    {
        return match ($request->jenis) {
            AssetRequestType::Pegawai => $user->canAccessUnit($request->unit),
            AssetRequestType::Unit => $request->unit->parent_id === $user->unit_id && $user->unit_id !== null,
        };
    }
```

dan di `close()` ganti `if (! $this->canFulfill($actor, $locked)) {` dengan `if (! $this->canClose($actor, $locked)) {`.

`app/Policies/AssetRequestPolicy.php`: tambahkan di akhir kelas:

```php
    public function close(User $user, AssetRequest $request): bool
    {
        return app(AssetRequestService::class)->canClose($user, $request);
    }
```

`app/Http/Requests/ClosePermohonanRequest.php`: `return $this->user()->can('fulfill', $this->route('assetRequest'));` menjadi `return $this->user()->can('close', $this->route('assetRequest'));`.

`app/Http/Controllers/AssetRequestController.php` (`show`): tambahkan setelah `$canFulfill = ...;`:

```php
        $canClose = $assetRequest->status === AssetRequestStatus::Approved
            && $assetRequest->mutation_id === null
            && $this->requests->canClose($user, $assetRequest);
```

dan ganti `'close' => $canFulfill,` dengan `'close' => $canClose,`.

`app/Http/Requests/UpdateUserRequest.php`: pada `after()`, tambahkan closure baru di awal array yang dikembalikan (sebelum closure yang sudah ada):

```php
        return [function (Validator $validator) {
            if ($this->filled('password') && ! $this->user()->can('user.reset-password')) {
                $validator->errors()->add('password', 'Anda tidak berwenang mengganti kata sandi pengguna.');
            }
        }, function (Validator $validator) {
```

(sisipkan `function (Validator $validator) {...},` baru sebelum closure lama; closure lama tetap utuh.)

`app/Http/Controllers/UserController.php` (`edit`): tambahkan `'canResetPassword' => $request->user()->can('user.reset-password'),` tepat sebelum `'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),` pada array `Inertia::render('Users/Edit', [...])`.

- [ ] **Step 4: Frontend**

Simpan dengan alat Write ke `.../scratchpad/pd_useredit.py`, jalankan dari root repo:

```python
path = 'resources/js/Pages/Users/Edit.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, "    units: { id: number; name: string; type: string }[];\n}", "    units: { id: number; name: string; type: string }[];\n    canResetPassword: boolean;\n}")
s = once(s, "export default function Edit({ auth, user, roles, permissionGroups }: EditProps) {", "export default function Edit({ auth, user, roles, permissionGroups, canResetPassword }: EditProps) {")

A = '                    {/* Section 2: Reset Kata Sandi (Opsional) */}\n'
B = '                    {/* Section 3: Penetapan Role & Scope */}\n'
i = s.index(A)
j = s.index(B, i)
body = s[i + len(A):j].rstrip('\n') + '\n'
s = s[:i] + A + '                    {canResetPassword && (\n' + body + '                    )}\n\n' + s[j:]

open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 5: Jalankan dan verifikasi**

Run: `php artisan test --filter="EnforcedPermissionsTest|PenerimaanAset|AssetRequest|UserAccess|UserPages|UserUnitAccess|PolicyRevocationTest"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: PASS. Test lama yang menghapus penerimaan atau menutup permohonan memakai role sistem tetap lulus (admin kecamatan/kelurahan punya `penerimaan.delete`/`permohonan.close` pada default); test yang memakai role kustom dengan hanya `update`/`fulfill` perlu menambah izin barunya.

- [ ] **Step 6: Commit**

```bash
git add app/Policies/BeritaAcaraPenerimaanPolicy.php app/Policies/AssetRequestPolicy.php app/Services/AssetRequestService.php app/Http/Requests/ClosePermohonanRequest.php app/Http/Controllers/AssetRequestController.php app/Http/Requests/UpdateUserRequest.php app/Http/Controllers/UserController.php resources/js/Pages/Users/Edit.tsx tests/Feature/EnforcedPermissionsTest.php
git add tests/Feature
git commit -m "feat(permissions): enforce penerimaan.delete, permohonan.close and user.reset-password"
```

---

### Task 5: Invarian terkunci keluar (`AccessGuard`)

**Files:**
- Create: `app/Support/AccessGuard.php`, `tests/Feature/AccessGuardTest.php`
- Modify: `app/Http/Controllers/UserController.php`, `app/Http/Requests/UpdateRoleRequest.php`, `docs/superpowers/specs/2026-10-09-permission-sepenuhnya-dinamis-design.md`

**Interfaces:**
- Produces: `AccessGuard::REQUIRED`, `::MESSAGE`, `::isHolder(User): bool`, `::others(array $exceptIds): Collection`, `::survivesRoleEdit(Role, array $permissions): bool`.

Catatan keputusan: `toggleStatus` dan `destroy` tidak membutuhkan invarian, karena `canManage($target)` mensyaratkan pelaku memegang semua izin target (jadi pelaku adalah pemegang aktif lain) dan menonaktifkan/menghapus diri sendiri sudah ditolak. Pengecekan `kasubag` di kedua method dihapus tanpa pengganti, dan spec §3.4 diperbarui sesuai. Invarian diperlukan hanya di `update()` (mengubah akun sendiri) dan di `UpdateRoleRequest`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/AccessGuardTest.php`:

```php
<?php

use App\Models\Role;
use App\Models\User;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
});

function pdKetua(string $name = 'ketua'): User
{
    $role = Role::create(['name' => $name, 'display_name' => ucfirst($name), 'unit_scope' => 'all', 'is_system' => false]);
    $role->givePermissionTo('pengaturan.role', 'user.manage-access', 'user.view');

    return User::factory()->create()->assignRole($role);
}

function pdUpdateSelf(User $user, string $role, array $extra = []): array
{
    return array_merge(['email' => $user->email, 'is_active' => true, 'role' => $role], $extra);
}

it('stops the only holder from taking the access roles away from themself', function () {
    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHas('error');

    expect($this->kasubag->fresh()->hasRole('kasubag'))->toBeTrue();
});

it('lets a holder change their own role when another active holder exists, whatever the role is called', function () {
    pdKetua();

    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHasNoErrors();

    expect($this->kasubag->fresh()->hasRole('admin_kecamatan'))->toBeTrue();
});

it('does not count an inactive user as a remaining holder', function () {
    $ketua = pdKetua();
    $ketua->update(['is_active' => false]);

    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHas('error');
});

it('refuses to strip pengaturan.role from the only role that carries it', function () {
    $permissions = Role::findByName('kasubag')->permissions->pluck('name')->reject(fn ($p) => $p === 'pengaturan.role')->values()->all();

    $this->actingAs($this->kasubag)->put(route('roles.update', Role::findByName('kasubag')), [
        'display_name' => 'Kasubag', 'unit_scope' => 'all', 'permissions' => $permissions,
    ])->assertSessionHasErrors('permissions');

    expect(Role::findByName('kasubag')->hasPermissionTo('pengaturan.role'))->toBeTrue();
});

it('allows editing a role freely once another role keeps the access permissions', function () {
    pdKetua();
    $permissions = Role::findByName('kasubag')->permissions->pluck('name')->reject(fn ($p) => in_array($p, ['pengaturan.role', 'user.manage-access'], true))->values()->all();

    $this->actingAs($this->kasubag)->put(route('roles.update', Role::findByName('kasubag')), [
        'display_name' => 'Kasubag', 'unit_scope' => 'binaan', 'permissions' => $permissions,
    ])->assertSessionHasNoErrors();

    expect(Role::findByName('kasubag')->unit_scope)->toBe('binaan');
});

it('protects any role that is the last carrier, not only the one called kasubag', function () {
    $ketua = pdKetua();
    Role::findByName('kasubag')->update(['unit_scope' => 'all']);
    Role::findByName('kasubag')->syncPermissions(['dashboard.view']);
    $this->kasubag->unsetRelation('roles');

    $this->actingAs($ketua)->put(route('roles.update', Role::findByName('ketua')), [
        'display_name' => 'Ketua', 'unit_scope' => 'all', 'permissions' => ['user.view'],
    ])->assertSessionHasErrors('permissions');
});

it('still lets a holder deactivate and delete another holder because canManage already requires equal rights', function () {
    $other = pdKetua('wakil');

    $this->actingAs($this->kasubag)->post(route('users.toggle-status', $other))->assertSessionHas('success');
    expect($other->fresh()->is_active)->toBeFalse();

    $this->actingAs($this->kasubag)->delete(route('users.destroy', $other))->assertSessionHas('success');
    expect(User::whereKey($other->id)->exists())->toBeFalse();
});

it('still refuses to deactivate or delete your own account', function () {
    $this->actingAs($this->kasubag)->post(route('users.toggle-status', $this->kasubag))->assertSessionHas('error');
    $this->actingAs($this->kasubag)->delete(route('users.destroy', $this->kasubag))->assertSessionHas('error');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=AccessGuardTest`
Expected: FAIL (test yang bergantung pada invarian umum; sisanya mungkin sudah lulus).

- [ ] **Step 3: Implementasi**

`app/Support/AccessGuard.php`:

```php
<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

/** Menjaga agar selalu ada pengguna aktif yang dapat mengelola role dan akses pengguna, apa pun nama rolenya. */
final class AccessGuard
{
    public const REQUIRED = ['pengaturan.role', 'user.manage-access'];

    public const MESSAGE = 'Perubahan ini akan membuat tidak ada lagi pengguna aktif yang dapat mengelola role dan akses pengguna.';

    public static function isHolder(User $user): bool
    {
        return collect(self::REQUIRED)->every(fn (string $permission) => $user->can($permission));
    }

    /**
     * Pengguna aktif selain $exceptIds yang memegang semua izin pengelola.
     *
     * @param  list<int>  $exceptIds
     * @return Collection<int, User>
     */
    public static function others(array $exceptIds): Collection
    {
        // ponytail: memeriksa pengguna aktif satu per satu; cukup untuk ratusan akun, ganti query bila membengkak.
        return User::where('is_active', true)->whereNotIn('id', $exceptIds)->get()
            ->filter(fn (User $user) => self::isHolder($user));
    }

    /**
     * Apakah masih ada pemegang bila izin $role diganti menjadi $permissions.
     *
     * @param  list<string>  $permissions
     */
    public static function survivesRoleEdit(Role $role, array $permissions): bool
    {
        return User::where('is_active', true)->with(['roles.permissions', 'permissions'])->get()
            ->contains(function (User $user) use ($role, $permissions) {
                $granted = $user->permissions->pluck('name');

                foreach ($user->roles as $assigned) {
                    $granted = $granted->merge($assigned->id === $role->id ? $permissions : $assigned->permissions->pluck('name'));
                }

                return array_diff(self::REQUIRED, $granted->all()) === [];
            });
    }
}
```

`app/Http/Controllers/UserController.php` (alat Edit):
1. Tambah `use App\Support\AccessGuard;` pada daftar `use`.
2. Di `update()`, ganti blok

```php
        // Proteksi self kasubag: tidak boleh mencabut role kasubag dari diri sendiri
        if ($user->id === $request->user()->id && $request->role !== 'kasubag' && $user->hasRole('kasubag')) {
            return back()->with('error', 'Anda tidak dapat mencabut role Kasubag dari akun Anda sendiri.');
        }
```

dengan:

```php
        // Invarian: tidak boleh menelantarkan akses pengelola (berlaku untuk role apa pun, bukan hanya kasubag).
        $role = Role::where('name', $request->validated('role'))->with('permissions')->firstOrFail();
        $remainsAdmin = $request->boolean('is_active')
            && array_diff(AccessGuard::REQUIRED, array_merge($role->permissions->pluck('name')->all(), $request->validated('direct_permissions') ?? [])) === [];

        if (! $remainsAdmin && AccessGuard::isHolder($user) && AccessGuard::others([$user->id])->isEmpty()) {
            return back()->with('error', AccessGuard::MESSAGE);
        }
```

3. Di `toggleStatus()` hapus blok `if ($user->hasRole('kasubag')) { return back()->with('error', 'Akun Kasubag sistem tidak boleh dinonaktifkan.'); }` dan di `destroy()` hapus blok `if ($user->hasRole('kasubag')) { return back()->with('error', 'Akun Kasubag sistem tidak boleh dihapus.'); }`.

`app/Http/Requests/UpdateRoleRequest.php` (alat Edit): tambah `use App\Support\AccessGuard;`, ubah komentar docblock di atas `after()` menjadi `/** Perubahan izin role tidak boleh menelantarkan akses pengelola. */`, dan ganti seluruh blok dari `if ($role->name !== 'kasubag') {` sampai akhir closure (dua `if` kasubag yang menggagalkan cakupan dan izin) dengan:

```php
            if ($this->has('permissions')
                && AccessGuard::others([])->isNotEmpty()
                && ! AccessGuard::survivesRoleEdit($role, $this->input('permissions', []))) {
                $validator->errors()->add('permissions', AccessGuard::MESSAGE);
            }
```

(pemeriksaan `covers` yang ada tetap di atasnya.)

`docs/superpowers/specs/2026-10-09-permission-sepenuhnya-dinamis-design.md` (alat Edit): pada §3.4 ganti daftar "Dipakai oleh:" tiga butir dengan dua butir: "`UserController::update`: menolak bila perubahan role/izin langsung/status akun menelantarkan pemegang terakhir (terutama mengubah akun sendiri)." dan "`UpdateRoleRequest`: menolak bila pengubahan izin role membuat tidak ada lagi pengguna aktif pemegang kedua izin itu.", ditambah kalimat: "`toggleStatus` dan `destroy` tidak memerlukan invarian: `canManage` mensyaratkan pelaku memegang semua izin target (sehingga pelaku adalah pemegang aktif lain) dan menonaktifkan/menghapus akun sendiri sudah ditolak; pengecekan nama `kasubag` di kedua method dihapus."

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="AccessGuardTest|UserAccessGuardTest|RoleSystemGuardTest|RoleDelegationTest|UserPagesPolishTest|UserUnitAccessTest|UserAccessOverrideTest"`
Expected: PASS. Test lama yang mengharapkan pesan/perilaku khusus `kasubag` (mis. "Akun Kasubag sistem tidak boleh dinonaktifkan", kasubag harus tetap bercakupan semua) diganti dengan perilaku invarian: ubah assertion-nya sesuai test baru, jangan menambah kembali pengecekan nama role.

- [ ] **Step 5: Commit**

```bash
git add app/Support/AccessGuard.php app/Http/Controllers/UserController.php app/Http/Requests/UpdateRoleRequest.php docs/superpowers/specs/2026-10-09-permission-sepenuhnya-dinamis-design.md tests/Feature/AccessGuardTest.php
git add tests/Feature
git commit -m "refactor(access): replace kasubag name guards with a general never-lock-everyone-out invariant"
```

---

### Task 6: Bersihkan katalog, migrasi data, penjaga katalog, label

**Files:**
- Create: `database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php`, `tests/Feature/PermissionCatalogTest.php`, `tests/Feature/PermissionAlignmentMigrationTest.php`
- Modify: `database/seeders/PermissionSeeder.php`, `resources/js/Pages/Roles/RoleModal.tsx`

**Interfaces:**
- Consumes: semua penegakan Task 2-5.
- Produces: katalog final; migrasi data aditif idempoten; test penjaga katalog.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/PermissionCatalogTest.php`:

```php
<?php

use Database\Seeders\PermissionSeeder;
use Illuminate\Support\Facades\File;

function pdSources(): string
{
    return collect(File::allFiles(app_path()))->merge(File::allFiles(resource_path('js')))
        ->reject(fn ($file) => str_ends_with(str_replace('\\', '/', $file->getPathname()), 'Pages/Roles/RoleModal.tsx'))
        ->map(fn ($file) => File::get($file->getPathname()))
        ->implode("\n");
}

it('references every catalog permission in the code outside the role labels', function () {
    $sources = pdSources();

    $unreferenced = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten()
        ->reject(fn ($permission) => str_starts_with($permission, 'import-') || str_starts_with($permission, 'export-'))
        ->reject(fn ($permission) => str_contains($sources, "'{$permission}'") || str_contains($sources, "\"{$permission}\""))
        ->values()->all();

    expect($unreferenced)->toBe([]);
});

it('does not check any permission in the backend that is missing from the catalog', function () {
    $catalog = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten();

    preg_match_all("/can\\('([a-z\\-]+\\.[a-z\\-]+)'\\)/", pdSources(), $matches);

    expect(collect($matches[1])->unique()->reject(fn ($permission) => $catalog->contains($permission))->values()->all())->toBe([]);
});

it('keeps the import and export permissions wired to their controllers', function () {
    $sources = pdSources();

    expect($sources)->toContain('"import-{$modul}"')->toContain('"export-{$modul}"');
});

it('has no leftover ghost permissions in the catalog', function () {
    $catalog = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten();

    expect($catalog->contains('penerimaan.submit'))->toBeFalse()
        ->and($catalog->contains('pengaturan.user'))->toBeFalse()
        ->and($catalog->contains('persetujuan.reassign'))->toBeTrue();
});
```

`tests/Feature/PermissionAlignmentMigrationTest.php`:

```php
<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

function pdMigration(): object
{
    return require base_path('database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php');
}

/** Meniru produksi sebelum rilis ini: permission lama ada, permission baru belum diberikan, penanda belum diisi. */
function pdLegacyState(): void
{
    test()->seed(RoleSeeder::class);
    test()->seed(PermissionSeeder::class);
    (new WorkflowDefinitionSeeder)->run();

    foreach (['penerimaan.submit', 'pengaturan.user'] as $ghost) {
        Permission::findOrCreate($ghost);
        Role::findByName('admin_kecamatan')->givePermissionTo($ghost);
    }

    Role::findByName('admin_kecamatan')->revokePermissionTo(['persetujuan.act', 'permohonan.close', 'penerimaan.delete']);
    Role::findByName('admin_kelurahan')->revokePermissionTo(['persetujuan.act', 'permohonan.close']);
    Role::findByName('kasubag')->revokePermissionTo(['persetujuan.reassign', 'user.reset-password']);
    Role::query()->update(['unit_head_of' => null]);
    Permission::where('name', 'persetujuan.reassign')->delete();
}

it('keeps every role able to do what it could before and removes only the ghost permissions', function () {
    pdLegacyState();
    Role::findByName('admin_kecamatan')->givePermissionTo('permohonan.fulfill');
    Role::findByName('lurah')->revokePermissionTo('permohonan.close');

    pdMigration()->up();

    $kec = Role::findByName('admin_kecamatan');
    $kel = Role::findByName('admin_kelurahan');

    expect(Permission::where('name', 'penerimaan.submit')->exists())->toBeFalse()
        ->and(Permission::where('name', 'pengaturan.user')->exists())->toBeFalse()
        ->and($kec->hasPermissionTo('persetujuan.act'))->toBeTrue()
        ->and($kel->hasPermissionTo('persetujuan.act'))->toBeTrue()
        ->and($kec->hasPermissionTo('permohonan.close'))->toBeTrue()
        ->and($kec->hasPermissionTo('penerimaan.delete'))->toBeTrue()
        ->and(Role::findByName('kasubag')->hasPermissionTo('persetujuan.reassign'))->toBeTrue()
        ->and(Role::findByName('kasubag')->hasPermissionTo('user.reset-password'))->toBeTrue()
        ->and(Role::findByName('camat')->unit_head_of)->toBe('kecamatan')
        ->and(Role::findByName('lurah')->unit_head_of)->toBe('kelurahan')
        ->and(Role::findByName('lurah')->hasPermissionTo('permohonan.close'))->toBeFalse();
});

it('gives persetujuan.act to the custom role of a user picked as approver in a workflow', function () {
    pdLegacyState();
    $role = Role::create(['name' => 'sekretaris', 'display_name' => 'Sekretaris', 'unit_scope' => 'own', 'is_system' => false]);
    $approver = User::factory()->create()->assignRole($role);

    DB::table('workflow_steps')->where('id', DB::table('workflow_steps')->min('id'))
        ->update(['approver_type' => 'user', 'approver_user_id' => $approver->id, 'approver_role' => null]);

    pdMigration()->up();

    expect(Role::findByName('sekretaris')->hasPermissionTo('persetujuan.act'))->toBeTrue();
});

it('can run twice without changing the outcome and without touching customised roles', function () {
    pdLegacyState();
    Role::findByName('camat')->update(['unit_head_of' => 'kelurahan']);

    pdMigration()->up();
    $first = Role::findByName('admin_kecamatan')->permissions->pluck('name')->sort()->values()->all();
    pdMigration()->up();

    expect(Role::findByName('admin_kecamatan')->permissions->pluck('name')->sort()->values()->all())->toBe($first)
        ->and(Role::findByName('camat')->unit_head_of)->toBe('kelurahan');
});

it('runs on an empty database', function () {
    pdMigration()->up();

    expect(Permission::where('name', 'persetujuan.reassign')->exists())->toBeTrue();
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter="PermissionCatalogTest|PermissionAlignmentMigrationTest"`
Expected: FAIL (katalog masih memuat dua hantu; berkas migrasi belum ada).

- [ ] **Step 3: Katalog dan seeder**

`database/seeders/PermissionSeeder.php` (alat Edit):
1. Hapus `'penerimaan.submit'` dari grup Penerimaan Aset: `'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',` menjadi `'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete',`.
2. Hapus baris `'pengaturan.user',` dari grup Pengaturan.
3. Pada `DEFAULTS['admin_kecamatan']` hapus `, 'penerimaan.submit'` dari baris `'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',`.

- [ ] **Step 4: Migrasi data**

`database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php`:

```php
<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Menyelaraskan permission dengan penegakannya tanpa mengubah hak efektif yang berjalan.
 * Aditif dan idempoten: aman dijalankan ulang, tidak mencabut permission selain dua yang dihapus.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->dropGhosts(['penerimaan.submit', 'pengaturan.user']);

        foreach (['persetujuan.act', 'persetujuan.reassign', 'permohonan.close', 'penerimaan.delete', 'user.reset-password'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        Role::where('name', 'kasubag')->first()?->givePermissionTo('persetujuan.reassign');

        $this->grantAct();

        foreach (['permohonan.fulfill' => 'permohonan.close', 'penerimaan.update' => 'penerimaan.delete', 'user.manage-access' => 'user.reset-password'] as $has => $give) {
            Permission::findOrCreate($has, 'web');
            Role::permission($has)->get()->each(fn (Role $role) => $role->givePermissionTo($give));
        }

        Role::where('name', 'camat')->whereNull('unit_head_of')->update(['unit_head_of' => 'kecamatan']);
        Role::where('name', 'lurah')->whereNull('unit_head_of')->update(['unit_head_of' => 'kelurahan']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Data; tidak dikembalikan. */
    public function down(): void {}

    /** @param list<string> $names */
    private function dropGhosts(array $names): void
    {
        foreach (Permission::whereIn('name', $names)->get() as $permission) {
            DB::table(config('permission.table_names.role_has_permissions'))->where('permission_id', $permission->id)->delete();
            DB::table(config('permission.table_names.model_has_permissions'))->where('permission_id', $permission->id)->delete();
            $permission->delete();
        }
    }

    /** Role yang dirujuk langkah alur sebagai approver (atau role milik pengguna approver) mempertahankan hak menyetujui. */
    private function grantAct(): void
    {
        $steps = collect(['workflow_steps', 'approval_request_steps'])
            ->map(fn (string $table) => DB::table($table)->get(['approver_role', 'approver_user_id']))
            ->flatten(1);

        $roleNames = $steps->pluck('approver_role')->filter()->unique();
        $userIds = $steps->pluck('approver_user_id')->filter()->unique();

        $names = $roleNames->merge(
            Role::whereHas('users', fn ($q) => $q->whereIn('users.id', $userIds))->pluck('name'),
        )->unique();

        Role::whereIn('name', $names)->get()->each(fn (Role $role) => $role->givePermissionTo('persetujuan.act'));
    }
};
```

- [ ] **Step 5: Label di modal Role**

Simpan dengan alat Write ke `.../scratchpad/pd_labels.py`, jalankan dari root repo:

```python
path = 'resources/js/Pages/Roles/RoleModal.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, "    'penerimaan.submit': 'Kirim ke Verifikator / Camat',\n", "")
s = once(s, "    'persetujuan.act': 'Setujui / Tolak Dokumen Persetujuan',\n",
         "    'persetujuan.act': 'Setujui / Tolak Dokumen Persetujuan',\n    'persetujuan.reassign': 'Alihkan Approver Persetujuan',\n")
s = once(s, "    'pengaturan.user': 'Pengaturan Akses Pengguna',\n",
         "    'user.view': 'Lihat Daftar Pengguna',\n"
         "    'user.manage-access': 'Kelola Role & Akses Pengguna',\n"
         "    'user.reset-password': 'Atur Ulang Kata Sandi Pengguna',\n"
         "    'user.toggle-status': 'Aktifkan / Nonaktifkan Pengguna',\n"
         "    'user.delete': 'Hapus Pengguna',\n")

open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 6: Jalankan dan verifikasi**

Run: `php artisan test --filter="PermissionCatalogTest|PermissionAlignmentMigrationTest|PermissionSeederSafetyTest|Role|User|WorkflowSettings"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: PASS; skrip `ok`; `tsc` dan build bersih. Bila test penjaga katalog menandai permission yang masih dipakai lewat cara dinamis lain (bukan literal), tambahkan pengecualian eksplisit di test beserta alasannya, jangan melonggarkan penjaga.

- [ ] **Step 7: Suite penuh**

Run (latar belakang): `php artisan test`
Expected: seluruh suite hijau (baseline sebelum rencana ini + test baru). Perbaiki regresi sebelum lanjut.

- [ ] **Step 8: Commit**

```bash
git add database/seeders/PermissionSeeder.php database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php resources/js/Pages/Roles/RoleModal.tsx tests/Feature/PermissionCatalogTest.php tests/Feature/PermissionAlignmentMigrationTest.php
git commit -m "feat(permissions): drop ghost permissions, align existing environments by migration, and guard the catalog against drift"
```
