# Manajemen Pengguna & Hak Akses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul Manajemen Pengguna & Hak Akses berbasis halaman penuh mandiri (`/pengaturan/users`: Index, Show, Edit) tanpa modal, dilengkapi fitur penonaktifan akun (`is_active`), foto profil terintegrasi dari data pegawai, pengamanan login berlapis (*dual-layer rate limiting* & *active session guard*), dan proteksi integritas anti-lockout.

**Architecture:** Menambahkan kolom `is_active` pada tabel `users`, mengekspos accessor `foto_profile_url` dari model `Pegawai`, memperluas katalog permission granular pada `PermissionSeeder`, menerapkan `EnsureUserIsActive` middleware dan route throttling, serta menyediakan antarmuka Inertia React (`Index`, `Show`, `Edit`) dengan navigasi dinamis berbasis hak akses.

**Tech Stack:** Laravel 12, PHP 8.2+, Spatie Laravel Permission, Inertia.js (React + TypeScript), Tailwind CSS, Pest PHP.

**Spec:** [`docs/superpowers/specs/2026-10-10-user-management-design.md`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/superpowers/specs/2026-10-10-user-management-design.md)

## Global Constraints
- Pembuatan akun baru tetap eksklusif dari menu Data Pegawai (`/pegawais`), tidak membuat form pendaftaran user terlepas dari data pegawai.
- Tidak menggunakan modal untuk alur utama manajemen user; menggunakan halaman penuh: `Index` (daftar), `Show` (rincian & matriks hak aktif), dan `Edit` (form lengkap edit akun & hak akses).
- Foto profil user murni mengambil data berkas foto dari `Pegawai` (`pegawais.foto_profile`), tidak ada upload foto duplikat di tabel user.
- Proteksi anti-lockout: dilarang menonaktifkan atau menghapus akun sendiri; dilarang menonaktifkan atau menghapus akun Kasubag sistem; dilarang menghapus akun yang memiliki riwayat tanda tangan pada `approval_actions`.
- Dual-layer login security: route rate limiting `throttle:6,1` pada `POST /login` dan identifier rate limiting di `LoginRequest`.
- Zero new composer or npm packages.
- Zero test regression pada seluruh 559 test suite yang ada.

---

### Task 1: Skema Basis Data, Accessor Foto Profil, & Katalog Permission

**Files:**
- Create: `database/migrations/2026_10_10_000002_add_is_active_to_users_table.php`
- Modify: `app/Models/User.php`
- Modify: `database/seeders/PermissionSeeder.php`
- Test: `tests/Feature/UserSchemaAndPermissionTest.php`

**Interfaces:**
- Consumes: Tabel `users` dan model `Pegawai`.
- Produces: Kolom `users.is_active` (boolean default true), accessor `User->foto_profile_url`, relasi `User->approvalActions()`, dan permission granular (`user.view`, `user.manage-access`, `user.reset-password`, `user.toggle-status`, `user.delete`).

- [ ] **Step 1: Tulis failing test untuk kolom is_active, accessor foto profil, dan permissions**

`tests/Feature/UserSchemaAndPermissionTest.php`:
```php
<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
});

it('defaults is_active to true for newly created users', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);

    expect($user->is_active)->toBeTrue();
});

it('provides foto_profile_url accessor from associated pegawai', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $pegawai = Pegawai::factory()->create([
        'unit_id' => $this->unit->id,
        'user_id' => $user->id,
        'foto_profile' => 'pegawais/1/avatar.jpg',
    ]);

    expect($user->foto_profile_url)->toContain('pegawais/1/avatar.jpg');

    $userWithoutPhoto = User::factory()->create(['unit_id' => $this->unit->id]);
    expect($userWithoutPhoto->foto_profile_url)->toBeNull();
});

it('seeds all granular user management permissions and grants them to kasubag', function () {
    $expected = [
        'user.view',
        'user.manage-access',
        'user.reset-password',
        'user.toggle-status',
        'user.delete',
    ];

    foreach ($expected as $perm) {
        expect(Permission::where('name', $perm)->exists())->toBeTrue("Permission {$perm} not seeded");
    }

    $kasubag = Role::findByName('kasubag');
    foreach ($expected as $perm) {
        expect($kasubag->hasPermissionTo($perm))->toBeTrue("Kasubag lacks {$perm}");
    }
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=UserSchemaAndPermissionTest`  
Expected: FAIL (kolom `is_active` dan permission belum ada).

- [ ] **Step 3: Buat migrasi, update User model, dan update PermissionSeeder**

Buat `database/migrations/2026_10_10_000002_add_is_active_to_users_table.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('unit_scope_override');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
```

Update `app/Models/User.php`:
- Tambahkan `'is_active'` ke `$fillable`.
- Tambahkan `'is_active' => 'boolean'` ke method `casts()`.
- Tambahkan relasi `approvalActions()`:
  ```php
  public function approvalActions(): \Illuminate\Database\Eloquent\Relations\HasMany
  {
      return $this->hasMany(\App\Models\ApprovalAction::class);
  }
  ```
- Tambahkan accessor `foto_profile_url`:
  ```php
  protected function fotoProfileUrl(): \Illuminate\Database\Eloquent\Casts\Attribute
  {
      return \Illuminate\Database\Eloquent\Casts\Attribute::make(
          get: function () {
              $path = $this->pegawai?->foto_profile;
              return $path ? \Illuminate\Support\Facades\Storage::disk('public')->url($path) : null;
          }
      );
  }
  ```

Update `database/seeders/PermissionSeeder.php`:
Tambahkan permission di grup `'Pengaturan'`:
```php
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
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=UserSchemaAndPermissionTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_10_000002_add_is_active_to_users_table.php app/Models/User.php database/seeders/PermissionSeeder.php tests/Feature/UserSchemaAndPermissionTest.php
git commit -m "feat(users): add is_active column, foto_profile_url accessor, and user management permissions"
```

---

### Task 2: Keamanan Login, Rate Limiting, & Active Session Guard

**Files:**
- Modify: `app/Http/Requests/Auth/LoginRequest.php`
- Modify: `routes/auth.php`
- Create: `app/Http/Middleware/EnsureUserIsActive.php`
- Modify: `bootstrap/app.php`
- Test: `tests/Feature/UserLoginSecurityTest.php`

**Interfaces:**
- Consumes: Status `user->is_active` dan session autentikasi.
- Produces: Penolakan login jika akun nonaktif, lockout rate-limiting, dan terminasi sesi aktif otomatis jika status user dinonaktifkan.

- [ ] **Step 1: Tulis test pengujian keamanan login dan akun nonaktif**

`tests/Feature/UserLoginSecurityTest.php`:
```php
<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
});

it('rejects login attempt for inactive users with informative error message', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'password' => 'secret1234',
        'is_active' => false,
    ]);
    $user->assignRole('admin_kecamatan');

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'secret1234',
    ]);

    $response->assertSessionHasErrors('email');
    expect(Auth::check())->toBeFalse();
});

it('throttles excessive failed login attempts', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'password' => 'secret1234',
    ]);

    for ($i = 0; $i < 5; $i++) {
        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);
    }

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertSessionHasErrors('email');
    $errors = session('errors')->get('email');
    expect(implode(' ', $errors))->toContain('Terlalu banyak upaya login');
});

it('logs out and redirects an active session if user is deactivated', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'is_active' => true,
    ]);

    $this->actingAs($user);
    $this->get('/dashboard')->assertOk();

    // Admin menonaktifkan akun
    $user->update(['is_active' => false]);

    // Request berikutnya harus tertendang
    $response = $this->get('/dashboard');
    $response->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=UserLoginSecurityTest`  
Expected: FAIL.

- [ ] **Step 3: Implementasikan LoginRequest check, route throttle, dan EnsureUserIsActive middleware**

Update `app/Http/Requests/Auth/LoginRequest.php`:
Di method `authenticate()`:
```php
        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        $user = Auth::user();
        if ($user && ! $user->is_active) {
            Auth::logout();
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => 'Akun Anda sedang dinonaktifkan oleh administrator. Silakan hubungi Kasubag.',
            ]);
        }

        RateLimiter::clear($this->throttleKey());
```

Update `routes/auth.php`:
Beri middleware `throttle:6,1` pada `POST /login`:
```php
Route::post('login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:6,1');
```

Buat `app/Http/Middleware/EnsureUserIsActive.php`:
```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check() && ! Auth::user()->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('error', 'Sesi Anda telah berakhir karena akun dinonaktifkan.');
        }

        return $next($request);
    }
}
```

Daftarkan `EnsureUserIsActive` pada `bootstrap/app.php`:
Tambahkan `$middleware->web(append: [EnsureUserIsActive::class]);` atau ke middleware grup web.

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=UserLoginSecurityTest`  
Expected: PASS (3 tests, assertions pass).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Auth/LoginRequest.php routes/auth.php app/Http/Middleware/EnsureUserIsActive.php bootstrap/app.php tests/Feature/UserLoginSecurityTest.php
git commit -m "feat(auth): add inactive account rejection, login rate limiting, and EnsureUserIsActive middleware"
```

---

### Task 3: Backend Controller, Form Requests, & Routing Pengguna

**Files:**
- Create: `app/Http/Requests/UpdateUserRequest.php`
- Create: `app/Http/Controllers/UserController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/UserControllerTest.php`

**Interfaces:**
- Consumes: `$request->validated()` dari form edit user dan route parameter `{user}`.
- Produces: Rute-rute `/pengaturan/users` (index, show, edit, update, toggleStatus, destroy) dengan proteksi anti-lockout dan jejak audit.

- [ ] **Step 1: Tulis test komprehensif UserController**

`tests/Feature/UserControllerTest.php`:
```php
<?php

use App\Models\ApprovalAction;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahan = Unit::create(['name' => 'Kelurahan Sei Lekop', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);

    $this->kasubag = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $this->operator->assignRole('admin_kelurahan');
    $this->pegawai = Pegawai::factory()->create([
        'unit_id' => $this->kelurahan->id,
        'user_id' => $this->operator->id,
    ]);
});

it('allows user with user.view to access users index page with filters', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.index', ['search' => $this->operator->name]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Index')
            ->has('users.data')
            ->has('roles')
            ->has('units')
            ->has('filters')
        );
});

it('denies user without user.view from accessing users index', function () {
    $this->actingAs($this->operator)
        ->get(route('users.index'))
        ->assertForbidden();
});

it('renders show page with user detail, pegawai link, and effective permissions', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.show', $this->operator))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Show')
            ->where('user.id', $this->operator->id)
            ->has('user.pegawai')
            ->has('effectivePermissions')
        );
});

it('renders edit page with all roles and permission groups', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.edit', $this->operator))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Edit')
            ->where('user.id', $this->operator->id)
            ->has('roles')
            ->has('permissionGroups')
        );
});

it('updates user email, password, role, and direct permissions on edit submission', function () {
    $this->actingAs($this->kasubag)
        ->put(route('users.update', $this->operator), [
            'email' => 'operator.baru@sagulung.go.id',
            'password' => 'PasswordBaru123',
            'password_confirmation' => 'PasswordBaru123',
            'is_active' => true,
            'role' => 'admin_kelurahan',
            'direct_permissions' => ['import-kategori'],
            'unit_scope_override' => 'binaan',
        ])
        ->assertRedirect(route('users.show', $this->operator));

    $this->operator->refresh();
    expect($this->operator->email)->toBe('operator.baru@sagulung.go.id')
        ->and(Hash::check('PasswordBaru123', $this->operator->password))->toBeTrue()
        ->and($this->operator->hasDirectPermission('import-kategori'))->toBeTrue()
        ->and($this->operator->unit_scope_override)->toBe('binaan');
});

it('toggles user is_active status with self-guard and system role protection', function () {
    // 1. Sukses toggle user biasa
    $this->actingAs($this->kasubag)
        ->patch(route('users.toggle-status', $this->operator))
        ->assertRedirect();

    expect($this->operator->fresh()->is_active)->toBeFalse();

    // 2. Cegah toggle diri sendiri
    $this->actingAs($this->kasubag)
        ->patch(route('users.toggle-status', $this->kasubag))
        ->assertSessionHas('error');

    expect($this->kasubag->fresh()->is_active)->toBeTrue();
});

it('deletes user credentials, clears pegawai user_id link, and prevents deletion if audit exists', function () {
    // 1. Berhasil hapus jika belum ada approval audit
    $userToDelete = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $pegawai = Pegawai::factory()->create(['user_id' => $userToDelete->id, 'unit_id' => $this->kelurahan->id]);

    $this->actingAs($this->kasubag)
        ->delete(route('users.destroy', $userToDelete))
        ->assertRedirect(route('users.index'));

    expect(User::where('id', $userToDelete->id)->exists())->toBeFalse()
        ->and($pegawai->fresh()->user_id)->toBeNull();

    // 2. Tolak hapus jika user memiliki riwayat audit
    ApprovalAction::create([
        'approval_request_id' => 1,
        'user_id' => $this->operator->id,
        'action' => 'approved',
        'step_order' => 1,
        'approver_role' => 'admin_kelurahan',
    ]);

    $this->actingAs($this->kasubag)
        ->delete(route('users.destroy', $this->operator))
        ->assertSessionHas('error');

    expect(User::where('id', $this->operator->id)->exists())->toBeTrue();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=UserControllerTest`  
Expected: FAIL.

- [ ] **Step 3: Buat UpdateUserRequest, UserController, dan rute**

Buat `app/Http/Requests/UpdateUserRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('user.manage-access');
    }

    public function rules(): array
    {
        $userId = $this->route('user')->id;

        return [
            'email' => "required|email|max:255|unique:users,email,{$userId}",
            'password' => 'nullable|string|min:8|confirmed',
            'is_active' => 'required|boolean',
            'role' => 'required|string|exists:roles,name',
            'direct_permissions' => 'nullable|array',
            'direct_permissions.*' => 'string|exists:permissions,name',
            'unit_scope_override' => 'nullable|in:all,binaan,own',
        ];
    }
}
```

Buat `app/Http/Controllers/UserController.php`:
Implementasikan `index`, `show`, `edit`, `update`, `toggleStatus`, dan `destroy` sesuai spec (dengan eager loading, scoping, anti-lockout self-guard, dan audit check).

Daftarkan rute di `routes/web.php`:
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

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=UserControllerTest`  
Expected: PASS (7 tests passed).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/UpdateUserRequest.php app/Http/Controllers/UserController.php routes/web.php tests/Feature/UserControllerTest.php
git commit -m "feat(users): implement UserController endpoints, UpdateUserRequest, and security guards"
```

---

### Task 4: Navigasi Sidebar, Layout Header Avatar, & Shared Inertia Props

**Files:**
- Modify: `resources/js/config/navigation.ts`
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `resources/js/types/index.d.ts`
- Test: `tests/Feature/UserNavigationAndAvatarTest.php`

**Interfaces:**
- Consumes: `auth.user.foto_profile_url` dan `auth.user.permissions`.
- Produces: Menu "Pengaturan Pengguna" di sidebar dan avatar foto profil di header navbar.

- [ ] **Step 1: Tulis test shared props foto profil dan navigasi**

`tests/Feature/UserNavigationAndAvatarTest.php`:
```php
<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
});

it('shares foto_profile_url in auth.user inertia props', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole('kasubag');
    Pegawai::factory()->create([
        'unit_id' => $this->unit->id,
        'user_id' => $user->id,
        'foto_profile' => 'pegawais/1/avatar.png',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user.foto_profile_url', fn ($url) => str_contains($url, 'pegawais/1/avatar.png'))
        );
});
```

- [ ] **Step 2: Update HandleInertiaRequests.php, navigation.ts, dan AuthenticatedLayout.tsx**

Di `app/Http/Middleware/HandleInertiaRequests.php`:
Sertakan `foto_profile_url` di `auth.user`:
```php
'user' => $user ? [
    ...
    'foto_profile_url' => $user->foto_profile_url,
] : null,
```

Di `resources/js/types/index.d.ts`:
Tambahkan `foto_profile_url?: string | null;` dan `is_active: boolean;` ke interface `User`.

Di `resources/js/config/navigation.ts`:
Tambahkan item ke grup `PENGATURAN`:
```typescript
{
    label: 'Pengaturan Pengguna',
    href: '/pengaturan/users',
    icon: 'users',
    permission: 'user.view',
},
```

Di `resources/js/Layouts/AuthenticatedLayout.tsx`:
Pada tombol dropdown profile (baris 336):
Jika `auth.user?.foto_profile_url` tersedia, render `<img src={auth.user.foto_profile_url} alt={auth.user.name} className="h-8 w-8 rounded-full object-cover" />`, jika tidak tampilkan inisial avatar.

- [ ] **Step 3: Jalankan verifikasi test & TypeScript**

Run: `php artisan test --filter=UserNavigationAndAvatarTest && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/config/navigation.ts resources/js/Layouts/AuthenticatedLayout.tsx resources/js/types/index.d.ts tests/Feature/UserNavigationAndAvatarTest.php
git commit -m "feat(ui): add Pengaturan Pengguna to navigation and display pegawai photo avatar in header"
```

---

### Task 5: Frontend Pages (Index, Show, & Edit Halaman Penuh)

**Files:**
- Create: `resources/js/Pages/Users/Index.tsx`
- Create: `resources/js/Pages/Users/Show.tsx`
- Create: `resources/js/Pages/Users/Edit.tsx`
- Test: `tests/Feature/UserPagesRenderTest.php`

**Interfaces:**
- Consumes: Props dari `UserController@index`, `UserController@show`, dan `UserController@edit`.
- Produces: Tiga halaman antarmuka penuh tanpa modal untuk manajemen pengguna, rincian hak akses, dan form edit.

- [ ] **Step 1: Tulis test render halaman Users**

`tests/Feature/UserPagesRenderTest.php`:
```php
<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kasubag = User::factory()->create(['unit_id' => $this->unit->id]);
    $this->kasubag->assignRole('kasubag');
});

it('renders user index, show, and edit pages successfully', function () {
    $this->actingAs($this->kasubag)->get(route('users.index'))->assertOk();
    $this->actingAs($this->kasubag)->get(route('users.show', $this->kasubag))->assertOk();
    $this->actingAs($this->kasubag)->get(route('users.edit', $this->kasubag))->assertOk();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal (komponen belum dibuat)**

Run: `php artisan test --filter=UserPagesRenderTest`  
Expected: FAIL (Inertia component not found).

- [ ] **Step 3: Buat Index.tsx, Show.tsx, dan Edit.tsx**

1. `resources/js/Pages/Users/Index.tsx`:
   - Filter bar: search, unit, role, status dropdown.
   - Tabel: Foto avatar / inisial, Nama User, Email, Pegawai (NIP, Jabatan), Unit, Role Badge, Badge `+N Izin Khusus`, Status Badge (`Aktif` vs `Nonaktif`), Tombol Aksi (Detail, Edit, Toggle Aktif).
   - Pagination standar.
   - Link pintasan: "Buka Data Pegawai".

2. `resources/js/Pages/Users/Show.tsx`:
   - Header profil besar dengan foto profil pegawai, nama, email, role badge, status badge.
   - Tombol aksi: Edit, Toggle Aktif, Hapus Akun, Kembali.
   - Kartu Data Pegawai: NIP, jabatan, unit, kontak, link ke profil pegawai.
   - Kartu Hak Akses: role utama, unit scope, daftar izin khusus direct permission.
   - Kartu Matriks Izin Aktif: daftar seluruh permission efektif per modul.

3. `resources/js/Pages/Users/Edit.tsx`:
   - Form halaman penuh:
     - Input Email, Toggle Status Aktif.
     - Input Ganti Password & Konfirmasi (opsional).
     - Dropdown Role Utama.
     - Radio Unit Scope Override (*Ikuti Role*, *Semua Unit*, *Unit & Binaan*, *Unit Sendiri*).
     - Matriks Checklist Hak Akses Tambahan Khusus (User Overrides) dengan indikator badge `[Dari Role]` (disabled) dan `[Izin Khusus]`.
   - Tombol Simpan Perubahan & Batal.

- [ ] **Step 4: Jalankan verifikasi TypeScript dan build**

Run: `npx tsc --noEmit && npm run build`  
Expected: PASS (0 errors, build cleanly).

- [ ] **Step 5: Jalankan test render dan pastikan lulus**

Run: `php artisan test --filter=UserPagesRenderTest`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Users/ tests/Feature/UserPagesRenderTest.php
git commit -m "feat(users): implement full-page Index, Show, and Edit views for user management"
```

---

### Task 6: Verifikasi Regresi Menyeluruh, Migrasi Lokal, & Build Produksi

**Files:**
- Test: seluruh test suite Pest PHP

- [ ] **Step 1: Jalankan seluruh test suite Pest**

Run: `php artisan test`  
Expected: 100% test lulus (570+ passed, 0 failed).

- [ ] **Step 2: Jalankan typecheck frontend & production build**

Run: `npx tsc --noEmit && npm run build`  
Expected: Clean build.

- [ ] **Step 3: Jalankan migrasi dan seeder di database dev lokal**

Run: `php artisan migrate && php artisan db:seed --class=PermissionSeeder`  
Expected: Migrasi `2026_10_10_000002_add_is_active_to_users_table` berjalan dan permission baru tersinkronisasi.

- [ ] **Step 4: Commit akhir**

```bash
git add .
git commit -m "chore(users): complete user management module verification"
```
