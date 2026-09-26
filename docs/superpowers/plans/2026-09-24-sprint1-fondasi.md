# Sprint 1 — Fondasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SIBIMA Laravel + Inertia/React foundation — project scaffold, unit/role data model, authorization scoping, and a role-aware dashboard shell — so every later sprint has a working base to build on.

**Architecture:** A single Laravel app serves an Inertia.js + React + TypeScript frontend. `units` (Kecamatan/Kelurahan, self-referencing hierarchy) and `users` (with `unit_id` + spatie roles) are the only tables this sprint touches. Authorization scoping lives in a single `User::canAccessUnit()` helper that later Policies (Sprint 2+) will call. No business feature (assets, workflow engine, transactions) is built yet — this sprint only proves login, role, and unit scoping work end-to-end.

**Tech Stack:** Laravel (latest stable, PHP 8.3+), MySQL, Laravel Breeze (React + TypeScript + Pest + ESLint stack), Inertia.js + React + TypeScript, Tailwind CSS + Preline UI, `spatie/laravel-permission`, Pest, Laravel Pint, ESLint + Prettier, npm, Laragon (local dev).

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md`
**Sprint plan:** `docs/superpowers/plans/2026-09-24-simaset-sprint-plan.md` (this plan implements "Sprint 1 — Fondasi")

## Global Constraints

- PHP 8.3+, Laravel (versi stabil terbaru), MySQL — per spec Arsitektur & Stack.
- Role & permission via `spatie/laravel-permission`; six roles: `kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`, `pegawai`.
- Backend convention (established this sprint, fully used from Sprint 2 onward): controller tipis → Form Request untuk validasi → Service untuk logic bisnis → Repository untuk data access.
- Frontend: Inertia.js + React + TypeScript, Tailwind CSS + Preline UI; Preline components must be re-initialized (`window.HSStaticMethods.autoInit()`) on every Inertia `navigate` event.
- Testing: Pest (backend). No JS test runner is in scope for this sprint — frontend behavior that can't be pinned by a Pest test is verified manually and the plan says so explicitly.
- Code style: Laravel Pint (PHP), ESLint + Prettier (TypeScript/React).
- Package manager: npm. Dev environment: Laragon (native PHP + MySQL on Windows, no Docker).
- Auth: session-based (Laravel Breeze). Public self-registration is out of scope — accounts are provisioned by seeder/admin only.
- Frontend branding is a placeholder ("SIBIMA" + a generic inline icon) until the client delivers the official logo/app name (tracked for swap in Sprint 5).
- Unit scoping: Kasubag = global (any unit, including when `unit_id` is `null`); Camat = own kecamatan + all its kelurahan; Admin Kecamatan/Admin Kelurahan/Lurah/Pegawai = their own `unit_id` only, no exceptions (not even their parent unit).

## Review Focus

- Kasubag accounts have `unit_id = null` by design (global scope) — login, the dashboard, and `canAccessUnit()` must all work correctly for a user with no unit, not just for unit-bound roles. → pinned in Task 4 and Task 5.
- Seeders (`RoleSeeder`, `UnitSeeder`, `UserSeeder`) must be safe to run more than once — `php artisan db:seed` re-run during development must not throw a duplicate-key error. → pinned in Task 5.
- Data integrity on `units`: a `kelurahan` row without a `parent_id`, or a `kecamatan` row with one, is invalid and must be rejected at the model layer, not just assumed correct by callers. → pinned in Task 2.
- The public `/register` endpoint must be genuinely closed (404, not just hidden from the UI) — the role model in the spec assumes accounts are provisioned by an admin, never self-registered. → pinned in Task 6.
- Admin Kelurahan and Lurah must NOT gain access to their parent kecamatan unit just because it's "above" them in the hierarchy — their scope is strictly their own unit, unlike Camat/Kasubag. → pinned in Task 4.

---

### Task 1: Laravel + Breeze (React/TypeScript/Pest/ESLint) project scaffold

**Files:**
- Create: entire Laravel application skeleton at the repo root (via `composer create-project` + `breeze:install`)
- Modify: `.env` (app name, database connection)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Laravel app with Breeze's React+TypeScript auth scaffold (`routes/web.php`, `routes/auth.php`, `app/Http/Controllers/Auth/*`, `resources/js/Pages/Auth/*`, `resources/js/Layouts/GuestLayout.tsx`, `resources/js/Layouts/AuthenticatedLayout.tsx`, `resources/js/Pages/Dashboard.tsx`), Pest configured (`tests/Pest.php`, `RefreshDatabase` applied to `tests/Feature`), npm scripts (`dev`, `build`, `lint`), and the `@/*` → `resources/js/*` TypeScript path alias. Later tasks build on all of these paths.

- [ ] **Step 1: Scaffold Laravel into a temp sibling folder, then move it into the repo root**

The repo root already has `.git`, `.idea`, and `docs/` in it, so `composer create-project` (which refuses non-empty directories) must target a sibling folder first:

```bash
cd "C:\Users\abdulaziz\Documents\pribadi\SIMASET - Sistem Informasi Asset Management"
composer create-project laravel/laravel ../simaset-app
rm -rf ../simaset-app/.git
shopt -s dotglob
mv ../simaset-app/* .
shopt -u dotglob
rmdir ../simaset-app
```

- [ ] **Step 2: Create the local MySQL database**

Laragon's MySQL ships with a passwordless `root` user by default:

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS simaset CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

- [ ] **Step 3: Configure `.env`**

Open `.env` and set these keys (create them if `create-project` didn't already):

```
APP_NAME=SIBIMA
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=simaset
DB_USERNAME=root
DB_PASSWORD=
```

Then:

```bash
php artisan key:generate
```

- [ ] **Step 4: Install Breeze with the React + TypeScript + Pest + ESLint stack**

```bash
composer require laravel/breeze --dev
php artisan breeze:install react --typescript --pest --eslint
npm install
```

- [ ] **Step 5: Confirm the `@/*` TypeScript path alias exists**

Open `tsconfig.json` and confirm it contains a `paths` entry mapping `"@/*"` to `"./resources/js/*"`. If it's missing, add it under `compilerOptions`:

```json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["./resources/js/*"]
        }
    }
}
```

If you had to add it, also confirm `vite.config.js` has a matching `resolve.alias` entry for `@` → `resources/js`; add one (using `path.resolve(__dirname, 'resources/js')`) if it's missing.

- [ ] **Step 6: Run migrations and verify the default suite**

```bash
php artisan migrate
php artisan test
```

Expected: all default Breeze/Pest example tests PASS.

- [ ] **Step 7: Manual smoke check**

Run `npm run dev` and `php artisan serve` in separate terminals, visit `http://127.0.0.1:8000`, confirm the default Breeze welcome/login page loads without console errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Laravel + Breeze React/TypeScript/Pest/ESLint stack"
```

---

### Task 2: `units` table and `Unit` model

**Files:**
- Create: `database/migrations/<timestamp>_create_units_table.php`
- Create: `app/Models/Unit.php`
- Test: `tests/Feature/UnitModelTest.php`

**Interfaces:**
- Consumes: Laravel skeleton from Task 1.
- Produces: `App\Models\Unit` with `parent(): BelongsTo`, `children(): HasMany`, `isKecamatan(): bool`, `isKelurahan(): bool`; throws `InvalidArgumentException` on save when `type`/`parent_id` are an invalid combination. Table columns: `id`, `name` (string), `type` (enum: `kecamatan`, `kelurahan`), `parent_id` (nullable, FK to `units.id`), timestamps. Task 3 (`users.unit_id`) and every later sprint's unit-scoped tables reference this table.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/UnitModelTest.php`:

```php
<?php

use App\Models\Unit;

it('creates a kecamatan with no parent', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);

    expect($unit->isKecamatan())->toBeTrue()
        ->and($unit->parent_id)->toBeNull();
});

it('creates a kelurahan as a child of a kecamatan', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $kelurahan = Unit::create([
        'name' => 'Kelurahan Sagulung Kota',
        'type' => 'kelurahan',
        'parent_id' => $kecamatan->id,
    ]);

    expect($kelurahan->isKelurahan())->toBeTrue()
        ->and($kelurahan->parent->id)->toBe($kecamatan->id)
        ->and($kecamatan->children->pluck('id')->all())->toBe([$kelurahan->id]);
});

it('rejects a kelurahan without a parent_id', function () {
    Unit::create(['name' => 'Kelurahan Tanpa Induk', 'type' => 'kelurahan']);
})->throws(InvalidArgumentException::class);

it('rejects a kecamatan that has a parent_id', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);

    Unit::create([
        'name' => 'Kecamatan Lain',
        'type' => 'kecamatan',
        'parent_id' => $kecamatan->id,
    ]);
})->throws(InvalidArgumentException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/UnitModelTest.php`
Expected: FAIL — class `Unit` (and the `units` table) does not exist yet.

- [ ] **Step 3: Create the migration**

```bash
php artisan make:migration create_units_table
```

Open the generated file and write:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['kecamatan', 'kelurahan']);
            $table->foreignId('parent_id')->nullable()->constrained('units')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};
```

- [ ] **Step 4: Create the `Unit` model**

Create `app/Models/Unit.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'type', 'parent_id'];

    protected static function booted(): void
    {
        static::saving(function (Unit $unit) {
            if ($unit->type === 'kelurahan' && $unit->parent_id === null) {
                throw new InvalidArgumentException('Kelurahan harus memiliki parent kecamatan.');
            }

            if ($unit->type === 'kecamatan' && $unit->parent_id !== null) {
                throw new InvalidArgumentException('Kecamatan tidak boleh memiliki parent.');
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Unit::class, 'parent_id');
    }

    public function isKecamatan(): bool
    {
        return $this->type === 'kecamatan';
    }

    public function isKelurahan(): bool
    {
        return $this->type === 'kelurahan';
    }
}
```

- [ ] **Step 5: Run migration and test**

```bash
php artisan migrate
php artisan test tests/Feature/UnitModelTest.php
```

Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add database/migrations app/Models/Unit.php tests/Feature/UnitModelTest.php
git commit -m "feat: add units table and Unit model with hierarchy validation"
```

---

### Task 3: Roles (`spatie/laravel-permission`) and `users.unit_id`

**Files:**
- Modify: `app/Models/User.php`
- Create: `database/migrations/<timestamp>_add_unit_id_to_users_table.php`
- Test: `tests/Feature/UserRoleTest.php`

**Interfaces:**
- Consumes: `Unit` model/table from Task 2.
- Produces: `User::unit(): BelongsTo`, `User` uses `Spatie\Permission\Traits\HasRoles` (so `assignRole()`, `hasRole()`, `getRoleNames()` are available), `users.unit_id` nullable FK column. Task 4 and Task 5 build directly on this.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/UserRoleTest.php`:

```php
<?php

use App\Models\Unit;
use App\Models\User;
use Spatie\Permission\Models\Role;

it('assigns a role to a user and links it to a unit', function () {
    Role::findOrCreate('camat');

    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $user = User::factory()->create(['unit_id' => $unit->id]);
    $user->assignRole('camat');

    expect($user->hasRole('camat'))->toBeTrue()
        ->and($user->unit->name)->toBe('Kecamatan Sagulung');
});

it('allows unit_id to be null for global-scope accounts', function () {
    $user = User::factory()->create(['unit_id' => null]);

    expect($user->unit_id)->toBeNull()
        ->and($user->unit)->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/UserRoleTest.php`
Expected: FAIL — `spatie/laravel-permission` is not installed yet and `users.unit_id` does not exist.

- [ ] **Step 3: Install `spatie/laravel-permission`**

```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

- [ ] **Step 4: Add the `unit_id` migration**

```bash
php artisan make:migration add_unit_id_to_users_table --table=users
```

Open the generated file and write:

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
            $table->foreignId('unit_id')->nullable()->after('id')->constrained('units')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_id');
        });
    }
};
```

- [ ] **Step 5: Update the `User` model**

Open `app/Models/User.php` and:
1. Add `use Spatie\Permission\Traits\HasRoles;` and `use Illuminate\Database\Eloquent\Relations\BelongsTo;` and `use App\Models\Unit;` to the imports.
2. Add `HasRoles` to the `use` trait list alongside `HasFactory, Notifiable`.
3. Add `'unit_id'` to the `$fillable` array.
4. Add this relation method to the class body:

```php
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
```

- [ ] **Step 6: Run migrations (units + spatie's own migration + the new users column) and the test**

```bash
php artisan migrate
php artisan test tests/Feature/UserRoleTest.php
```

Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add app/Models/User.php database/migrations config/permission.php tests/Feature/UserRoleTest.php composer.json composer.lock
git commit -m "feat: add spatie/laravel-permission and users.unit_id"
```

---

### Task 4: Unit-scoping authorization helper

**Files:**
- Modify: `app/Models/User.php`
- Test: `tests/Feature/UserUnitAccessTest.php`

**Interfaces:**
- Consumes: `User::unit_id`, `Unit::parent_id`, `User::hasRole()` (Task 3).
- Produces: `User::canAccessUnit(Unit $unit): bool`. Every unit-scoped Policy from Sprint 2 onward calls this method instead of re-implementing the scoping rule.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/UserUnitAccessTest.php`:

```php
<?php

use App\Models\Unit;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai'] as $role) {
        Role::findOrCreate($role);
    }

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahanA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->kelurahanB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
});

it('lets kasubag access any unit even with a null unit_id', function () {
    $user = User::factory()->create(['unit_id' => null]);
    $user->assignRole('kasubag');

    expect($user->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeTrue();
});

it('lets camat access their kecamatan and every kelurahan under it', function () {
    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole('camat');

    expect($user->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeTrue();
});

it('restricts admin_kelurahan to only their own kelurahan, not the parent kecamatan', function () {
    $user = User::factory()->create(['unit_id' => $this->kelurahanA->id]);
    $user->assignRole('admin_kelurahan');

    expect($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeFalse()
        ->and($user->canAccessUnit($this->kecamatan))->toBeFalse();
});

it('restricts lurah to only their own kelurahan, not the parent kecamatan', function () {
    $user = User::factory()->create(['unit_id' => $this->kelurahanB->id]);
    $user->assignRole('lurah');

    expect($user->canAccessUnit($this->kelurahanB))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeFalse()
        ->and($user->canAccessUnit($this->kecamatan))->toBeFalse();
});

it('restricts admin_kecamatan and pegawai to exactly their own unit', function () {
    $adminKecamatan = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $adminKecamatan->assignRole('admin_kecamatan');

    $pegawai = User::factory()->create(['unit_id' => $this->kelurahanA->id]);
    $pegawai->assignRole('pegawai');

    expect($adminKecamatan->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($adminKecamatan->canAccessUnit($this->kelurahanA))->toBeFalse()
        ->and($pegawai->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($pegawai->canAccessUnit($this->kecamatan))->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/UserUnitAccessTest.php`
Expected: FAIL — `canAccessUnit` does not exist on `User`.

- [ ] **Step 3: Implement `canAccessUnit`**

Open `app/Models/User.php`, add `use App\Models\Unit;` if not already imported (it was added in Task 3), and add this method to the class body:

```php
    public function canAccessUnit(Unit $unit): bool
    {
        if ($this->hasRole('kasubag')) {
            return true;
        }

        if ($this->hasRole('camat')) {
            if ($this->unit_id === null) {
                return false;
            }

            return $unit->id === $this->unit_id || $unit->parent_id === $this->unit_id;
        }

        return $this->unit_id !== null && $this->unit_id === $unit->id;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/UserUnitAccessTest.php`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Models/User.php tests/Feature/UserUnitAccessTest.php
git commit -m "feat: add User::canAccessUnit unit-scoping helper"
```

---

### Task 5: Seeders — roles, units, demo users per role

**Files:**
- Create: `database/seeders/RoleSeeder.php`
- Create: `database/seeders/UnitSeeder.php`
- Create: `database/seeders/UserSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`
- Test: `tests/Feature/DatabaseSeederTest.php`

**Interfaces:**
- Consumes: `Unit` (Task 2), roles + `User::unit_id` (Task 3).
- Produces: a fully seeded local dev database — 6 roles, 1 kecamatan + 7 kelurahan units, and 6 demo accounts (one per role, password `password`, emails listed below). Task 7's multi-role Inertia test logs in as these accounts.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/DatabaseSeederTest.php`:

```php
<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

it('seeds roles, units, and one demo user per role idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class); // must be safe to run twice

    expect(Unit::where('type', 'kecamatan')->count())->toBe(1)
        ->and(Unit::where('type', 'kelurahan')->count())->toBe(7)
        ->and(User::count())->toBe(6);

    $kasubag = User::where('email', 'kasubag@simaset.test')->firstOrFail();
    expect($kasubag->unit_id)->toBeNull()
        ->and($kasubag->hasRole('kasubag'))->toBeTrue();

    $lurah = User::where('email', 'lurah@simaset.test')->firstOrFail();
    expect($lurah->unit->isKelurahan())->toBeTrue()
        ->and($lurah->hasRole('lurah'))->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DatabaseSeederTest.php`
Expected: FAIL — the seeder classes don't exist yet.

- [ ] **Step 3: Create `RoleSeeder`**

```bash
php artisan make:seeder RoleSeeder
```

Write `database/seeders/RoleSeeder.php`:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        collect(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai'])
            ->each(fn (string $role) => Role::findOrCreate($role));
    }
}
```

- [ ] **Step 4: Create `UnitSeeder`**

```bash
php artisan make:seeder UnitSeeder
```

Write `database/seeders/UnitSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::firstOrCreate(
            ['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan'],
        );

        collect([
            'Kelurahan Sagulung Kota',
            'Kelurahan Sungai Binti',
            'Kelurahan Sungai Langkai',
            'Kelurahan Sungai Lekop',
            'Kelurahan Sungai Pelunggut',
            'Kelurahan Tembesi',
            'Kelurahan Sungai Buluh',
        ])->each(fn (string $name) => Unit::firstOrCreate(
            ['name' => $name, 'type' => 'kelurahan'],
            ['parent_id' => $kecamatan->id],
        ));
    }
}
```

This kelurahan list is local dev seed data only — real production units come from the Sprint 5 data import.

- [ ] **Step 5: Create `UserSeeder`**

```bash
php artisan make:seeder UserSeeder
```

Write `database/seeders/UserSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::where('type', 'kecamatan')->firstOrFail();
        $kelurahan = Unit::where('type', 'kelurahan')->firstOrFail();

        $accounts = [
            ['name' => 'Kasubag Demo', 'email' => 'kasubag@simaset.test', 'unit_id' => null, 'role' => 'kasubag'],
            ['name' => 'Camat Demo', 'email' => 'camat@simaset.test', 'unit_id' => $kecamatan->id, 'role' => 'camat'],
            ['name' => 'Admin Kecamatan Demo', 'email' => 'admin.kecamatan@simaset.test', 'unit_id' => $kecamatan->id, 'role' => 'admin_kecamatan'],
            ['name' => 'Admin Kelurahan Demo', 'email' => 'admin.kelurahan@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'admin_kelurahan'],
            ['name' => 'Lurah Demo', 'email' => 'lurah@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'lurah'],
            ['name' => 'Pegawai Demo', 'email' => 'pegawai@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'pegawai'],
        ];

        foreach ($accounts as $account) {
            $user = User::firstOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'unit_id' => $account['unit_id'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                ],
            );

            if (! $user->hasRole($account['role'])) {
                $user->assignRole($account['role']);
            }
        }
    }
}
```

- [ ] **Step 6: Wire `DatabaseSeeder`**

Open `database/seeders/DatabaseSeeder.php` and replace its `run()` method body with:

```php
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            UnitSeeder::class,
            UserSeeder::class,
        ]);
    }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `php artisan test tests/Feature/DatabaseSeederTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add database/seeders tests/Feature/DatabaseSeederTest.php
git commit -m "feat: add idempotent role/unit/demo-user seeders"
```

---

### Task 6: Disable public registration

**Files:**
- Modify: `routes/auth.php`
- Delete: `app/Http/Controllers/Auth/RegisteredUserController.php`
- Delete: `resources/js/Pages/Auth/Register.tsx`
- Test: `tests/Feature/Auth/RegistrationDisabledTest.php`

**Interfaces:**
- Consumes: Breeze auth scaffold from Task 1.
- Produces: `/register` returns 404 for both GET and POST. No frontend route depends on this page (checked in Step 3 below).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Auth/RegistrationDisabledTest.php`:

```php
<?php

it('does not expose public registration routes', function () {
    $this->get('/register')->assertNotFound();

    $this->post('/register', [
        'name' => 'Hacker',
        'email' => 'hacker@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Auth/RegistrationDisabledTest.php`
Expected: FAIL — the routes currently exist (200/302 instead of 404).

- [ ] **Step 3: Remove the register routes and page**

Open `routes/auth.php` and delete the `Route::get('register', ...)` and `Route::post('register', ...)` lines (the ones pointing to `RegisteredUserController`).

Delete the files:

```bash
rm app/Http/Controllers/Auth/RegisteredUserController.php
rm resources/js/Pages/Auth/Register.tsx
```

Search for any leftover link to the register page and remove it:

```bash
grep -rn "route('register')" resources/js
```

If that command prints a match (commonly a "Don't have an account? Register" link in `resources/js/Pages/Auth/Login.tsx`), open that file and delete the `<Link>` element pointing to it.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Auth/RegistrationDisabledTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: close public registration, accounts are admin-provisioned only"
```

---

### Task 7: Share role/unit info via Inertia and verify dashboard access

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Test: `tests/Feature/DashboardInertiaPropsTest.php`

**Interfaces:**
- Consumes: `User::unit`, `User::getRoleNames()` (Task 3), seeded demo accounts (Task 5).
- Produces: every Inertia response's shared `auth.user` prop shape: `{ id: number, name: string, email: string, roles: string[], unit: { id: number, name: string, type: 'kecamatan'|'kelurahan' } | null }`. Task 9's frontend `PageProps`/`AuthUser` TypeScript types and navigation logic consume this exact shape.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/DashboardInertiaPropsTest.php`:

```php
<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->seed(DatabaseSeeder::class));

it('shares role and unit info with the dashboard for every seeded role', function (string $email, string $role) {
    $user = User::where('email', $email)->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('auth.user.roles', fn ($roles) => in_array($role, $roles, true))
        );
})->with([
    ['kasubag@simaset.test', 'kasubag'],
    ['camat@simaset.test', 'camat'],
    ['admin.kecamatan@simaset.test', 'admin_kecamatan'],
    ['admin.kelurahan@simaset.test', 'admin_kelurahan'],
    ['lurah@simaset.test', 'lurah'],
    ['pegawai@simaset.test', 'pegawai'],
]);

it('shares a null unit for the kasubag global account', function () {
    $user = User::where('email', 'kasubag@simaset.test')->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.unit', null));
});

it('shares the unit name and type for a unit-bound account', function () {
    $user = User::where('email', 'lurah@simaset.test')->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.unit.type', 'kelurahan')
            ->has('auth.user.unit.name')
        );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DashboardInertiaPropsTest.php`
Expected: FAIL — `auth.user.roles` and `auth.user.unit` are not present in the shared props yet.

- [ ] **Step 3: Update `HandleInertiaRequests`**

Open `app/Http/Middleware/HandleInertiaRequests.php` and replace the `share()` method with:

```php
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'roles' => $request->user()->getRoleNames(),
                    'unit' => $request->user()->unit ? [
                        'id' => $request->user()->unit->id,
                        'name' => $request->user()->unit->name,
                        'type' => $request->user()->unit->type,
                    ] : null,
                ] : null,
            ],
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/DashboardInertiaPropsTest.php`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php tests/Feature/DashboardInertiaPropsTest.php
git commit -m "feat: share role and unit info with every Inertia page"
```

---

### Task 8: Install and wire Preline UI

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `tailwind.config.js`
- Modify: `resources/js/app.tsx`
- Create: `resources/js/types/preline.d.ts`

**Interfaces:**
- Consumes: Vite/Tailwind scaffold from Task 1.
- Produces: `window.HSStaticMethods.autoInit()` available globally and re-triggered on every Inertia `navigate` event; Tailwind configured to pick up Preline's component classes. Task 9's dropdown menu is the first real usage.

There is no Pest test for this task — it is frontend build tooling with no backend behavior to pin. The task's pass/fail signal is a clean `npm run build`, verified in Step 4.

- [ ] **Step 1: Install Preline**

```bash
npm install preline
```

- [ ] **Step 2: Configure Tailwind**

Open `tailwind.config.js` and replace its contents with:

```js
import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';
import preline from 'preline/plugin';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
        './node_modules/preline/dist/*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },
    plugins: [forms, preline],
};
```

- [ ] **Step 3: Wire Preline into the Inertia app**

Open `resources/js/app.tsx` and:
1. Add `import 'preline/preline';` near the top, right after the `import '../css/app.css';` line.
2. Add this after the `createInertiaApp({...})` call, at the bottom of the file:

```tsx
router.on('navigate', () => {
    window.HSStaticMethods?.autoInit();
});
```

3. Make sure `router` is imported from `@inertiajs/react` (add `import { router } from '@inertiajs/react';` if it isn't already imported).

Create `resources/js/types/preline.d.ts`:

```ts
export {};

declare global {
    interface Window {
        HSStaticMethods: {
            autoInit: (collection?: string[]) => void;
        };
    }
}
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exit code 0, no errors mentioning `preline` or `HSStaticMethods`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tailwind.config.js resources/js/app.tsx resources/js/types/preline.d.ts
git commit -m "feat: install and wire Preline UI into the Inertia app"
```

---

### Task 9: Role-aware `AppLayout` with placeholder branding

**Files:**
- Create: `resources/js/config/navigation.ts`
- Create: `resources/js/Components/BrandMark.tsx`
- Modify: `resources/js/types/index.d.ts`
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx`
- Modify: `resources/js/Layouts/GuestLayout.tsx`
- Modify: `resources/js/Pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `auth.user` shape from Task 7, `window.HSStaticMethods`/Preline classes from Task 8.
- Produces: `navItemsForRole(role: Role | undefined): NavItem[]` (exported from `resources/js/config/navigation.ts`) and a `PageProps`/`AuthUser` TypeScript shape matching the backend's shared props exactly. Later sprints' pages import `AuthenticatedLayout` and `PageProps` from here.

There is no Pest test for this task — it is React component/layout work. Verification is the manual browser check in Step 7, which is the honest testing mechanism available since no JS test runner is in scope for this sprint (see Global Constraints).

- [ ] **Step 1: Define shared frontend types**

Open `resources/js/types/index.d.ts` and add (keep any existing content in the file, add these alongside it):

```ts
export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    unit: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } | null;
}

export interface PageProps {
    auth: {
        user: AuthUser | null;
    };
    [key: string]: unknown;
}
```

- [ ] **Step 2: Create the navigation config**

Create `resources/js/config/navigation.ts`:

```ts
export type Role =
    | 'kasubag'
    | 'camat'
    | 'admin_kecamatan'
    | 'admin_kelurahan'
    | 'lurah'
    | 'pegawai';

export interface NavItem {
    label: string;
    href: string;
    disabled?: boolean;
}

const DASHBOARD: NavItem = { label: 'Dashboard', href: '/dashboard' };

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
    kasubag: [
        DASHBOARD,
        { label: 'Kelola User', href: '#', disabled: true },
        { label: 'Master Data Aset', href: '#', disabled: true },
    ],
    camat: [
        DASHBOARD,
        { label: 'Approval Penerimaan Aset', href: '#', disabled: true },
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kecamatan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        { label: 'Penerimaan Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kelurahan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    lurah: [
        DASHBOARD,
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    pegawai: [
        DASHBOARD,
        { label: 'Ajukan Aset', href: '#', disabled: true },
        { label: 'Lapor Aset Rusak/Hilang', href: '#', disabled: true },
    ],
};

export function navItemsForRole(role: Role | undefined): NavItem[] {
    if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
        return [DASHBOARD];
    }

    return NAV_ITEMS_BY_ROLE[role];
}
```

- [ ] **Step 3: Create the placeholder brand mark**

Create `resources/js/Components/BrandMark.tsx`:

```tsx
// Placeholder brand mark; swap icon + name once the client delivers the official logo/app name (Sprint 5).
export default function BrandMark({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-8 w-8 text-blue-600"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"
                />
            </svg>
            <span className="text-lg font-semibold text-gray-800">SIBIMA</span>
        </div>
    );
}
```

- [ ] **Step 4: Rewrite `AuthenticatedLayout`**

Replace the contents of `resources/js/Layouts/AuthenticatedLayout.tsx` with:

```tsx
import { PropsWithChildren } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import BrandMark from '@/Components/BrandMark';
import { navItemsForRole, Role } from '@/config/navigation';
import { PageProps } from '@/types';

export default function AuthenticatedLayout({ children }: PropsWithChildren) {
    const { auth } = usePage<PageProps>().props;
    const role = auth.user?.roles?.[0] as Role | undefined;
    const navItems = navItemsForRole(role);

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="w-64 shrink-0 border-r border-gray-200 bg-white p-4">
                <BrandMark className="mb-6" />
                <nav className="space-y-1">
                    {navItems.map((item) =>
                        item.disabled ? (
                            <span
                                key={item.label}
                                className="block cursor-not-allowed rounded px-3 py-2 text-sm text-gray-400"
                                title="Segera hadir"
                            >
                                {item.label}
                            </span>
                        ) : (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="block rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                {item.label}
                            </Link>
                        ),
                    )}
                </nav>
            </aside>

            <div className="flex flex-1 flex-col">
                <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-gray-800">{auth.user?.name}</p>
                        <p className="text-xs text-gray-500">
                            {auth.user?.unit?.name ?? 'Kecamatan Sagulung'} · {role}
                        </p>
                    </div>

                    <div className="hs-dropdown relative inline-flex">
                        <button
                            type="button"
                            className="hs-dropdown-toggle inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                        >
                            Akun
                        </button>
                        <div className="hs-dropdown-menu hs-dropdown-open:opacity-100 hidden w-40 rounded border border-gray-200 bg-white opacity-0 shadow-md">
                            <button
                                type="button"
                                onClick={() => router.post('/logout')}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Keluar
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6">{children}</main>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Update `GuestLayout` branding**

Open `resources/js/Layouts/GuestLayout.tsx`. Replace whatever logo component it currently renders (typically an `<ApplicationLogo />` inside a `<Link href="/">`) with `<BrandMark />`, importing it via `import BrandMark from '@/Components/BrandMark';`. The rest of the layout (centering wrapper, white card) stays as Breeze generated it.

- [ ] **Step 6: Update `Dashboard.tsx`**

Replace the contents of `resources/js/Pages/Dashboard.tsx` with:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';

export default function Dashboard() {
    const { auth } = usePage<PageProps>().props;

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="rounded-lg bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-gray-800">
                    Selamat datang, {auth.user?.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Anda login sebagai <strong>{auth.user?.roles?.[0]}</strong> di{' '}
                    {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
php artisan serve
```

Log in at `http://127.0.0.1:8000/login` as each of the 6 seeded demo accounts (emails from Task 5, password `password`). For each, confirm:
- The sidebar shows that role's specific nav items (from `NAV_ITEMS_BY_ROLE`), with the non-Dashboard items visibly disabled.
- The header shows the correct name and unit (kasubag shows "Kecamatan Sagulung" with no specific unit tie; a kelurahan-scoped role shows that kelurahan's name).
- Clicking "Akun" opens the Preline dropdown, and "Keluar" logs out and redirects to `/login`.

- [ ] **Step 8: Commit**

```bash
git add resources/js
git commit -m "feat: add role-aware AppLayout with placeholder branding"
```

---

### Task 10: Final lint/format pass

**Files:**
- Modify: any files flagged by Pint/ESLint

**Interfaces:**
- Consumes: entire codebase from Tasks 1–9.
- Produces: a clean, consistently formatted codebase ready for Sprint 2 to build on.

- [ ] **Step 1: Run Pint**

```bash
./vendor/bin/pint
```

Expected: reports files fixed (or already clean); exit code 0.

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Expected: exit code 0, no remaining errors. If it reports fixable issues, it auto-fixes them (Breeze's `--eslint` flag configures `lint` to run with `--fix`).

- [ ] **Step 3: Run the full Pest suite**

```bash
php artisan test
```

Expected: PASS — every test from Tasks 1–7.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: run Pint and ESLint formatting pass"
```

---

## Self-Review Notes

- **Spec coverage:** Roles table (Task 3/5), unit hierarchy (Task 2), unit-scoping rule (Task 4), session auth via Breeze (Task 1/6), Inertia+React+TS+Tailwind+Preline stack (Task 1/8/9), placeholder branding (Task 9), Pest/Pint/ESLint tooling (Task 1/10) — every "Fondasi" item from the sprint plan has an owning task. Asset/workflow-engine/transaction features are explicitly out of scope for this plan (they get their own plans per the sprint plan).
- **Placeholder scan:** no TBD/TODO markers; every step has concrete, complete code.
- **Type consistency:** `AuthUser`/`PageProps` (Task 9, frontend) match the exact shape produced by `HandleInertiaRequests::share()` (Task 7, backend) field-for-field (`id`, `name`, `email`, `roles: string[]`, `unit: {id, name, type} | null`). `Role` union in `navigation.ts` matches the 6 role strings seeded in `RoleSeeder`/`UserSeeder`.
- **Review Focus:** all 5 items have an owning task and pinning test (kasubag null-unit → Task 4/5; idempotent seeders → Task 5; unit type/parent integrity → Task 2; closed `/register` → Task 6; admin_kelurahan/lurah denied parent access → Task 4).

---

Plan complete and saved to `docs/superpowers/plans/2026-09-24-sprint1-fondasi.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch at the end. Cheapest and fastest; no independent review until the end.

For this plan I recommend **Native**, because the 10 tasks are strictly sequential with no independent/parallel branches (each depends directly on the file/interface the previous task produced), it's foundational scaffolding rather than business logic, and a shipped mistake here is cheap to catch and fix in Sprint 2 before real features are built on top. Does the plan capture what you want, and which approach should we use?
