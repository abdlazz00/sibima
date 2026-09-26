# Pegawai Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pegawai becomes a standalone data entity (no login) holding asset custody, decoupled from `users`; kasubag/admin kecamatan/admin kelurahan can manage pegawai records (with a profile photo), and kasubag can optionally grant a specific pegawai a login account.

**Architecture:** Follows the existing convention: thin Controller → FormRequest (validation + `authorize()`) → Service (business rules) → Repository (interface + Eloquent implementation, bound in `AppServiceProvider`). `Asset`/`AssetHistory.current_holder_id` is repointed from `users` to the new `pegawais` table — this is the prerequisite both the Asset Request plan and the Asset Report plan build on.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md` (see "Data Model — Pegawai", "Peran (Roles)", both updated in the 2026-09-26 revision).

**Depends on:** nothing (this is the prerequisite plan — the Asset Request and Asset Report plans depend on this one being merged first).

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:` — no MySQL-only SQL.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Repository (interface in `app/Repositories/Contracts`, Eloquent implementation in `app/Repositories`, bound in `AppServiceProvider::register()`). Controllers never query models directly; use `Gate::authorize()` for abilities not already covered by a FormRequest (Laravel 13's base `Controller` has no `authorize()` helper).
- Login roles are exactly `kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, `lurah`. `pegawai` is **not** a login role anymore — it must not appear in `RoleSeeder` or in any seeded login account.
- Unit scoping always goes through `User::accessibleUnitIds()` / `canAccessUnit()` (already in `app/Models/User.php`) — never re-derive scoping logic.
- Photos/files: `public` disk, jpg/jpeg/png/webp, ≤ 2 MB for a single profile photo.
- UI copy in Bahasa Indonesia.
- Frontend has no JS test runner; frontend behavior is verified by Inertia prop assertions in Pest.
- This plan **does not** touch `tests/Feature/AssetBrowseTest.php` — it is unrelated, uncommitted, in-progress work for a not-yet-built `/assets` browsing page (no `AssetController` or `Assets/Index` page exists yet). Leave it untouched even though it references `userWithRole('pegawai', ...)`; that helper creates roles on demand via Spatie and will keep working regardless of what `RoleSeeder` contains.

## Review Focus

- An admin kelurahan hand-types a different `unit_id` into the create/update form → the pegawai must still end up in the admin's own unit, not the tampered one → pinned in Task 5.
- Two pegawai created with the same `nip` → must fail with a validation message, not a raw 500 from a unique-constraint `QueryException` → pinned in Task 5.
- Calling "buat akun login" twice on the same pegawai → the second call must be rejected, not silently create a duplicate/orphaned `users` row → pinned in Task 6.
- Deleting a pegawai who currently holds an asset (`current_holder_id`) → the asset must survive with `current_holder_id` set to `null`, not a foreign-key crash → pinned in Task 2.
- Camat/Lurah (approver roles, not data-entry roles) try to create/update/delete a pegawai → must get a policy denial (403), not succeed → pinned in Task 5.

---

### Task 1: `pegawais` table, `StatusKepegawaian` enum, `Pegawai` model, factory

**Files:**
- Create: `app/Enums/StatusKepegawaian.php`
- Create: `database/migrations/2026_09_25_000000_create_pegawais_table.php` (backdated timestamp — see Step 3)
- Create: `app/Models/Pegawai.php`
- Create: `database/factories/PegawaiFactory.php`
- Test: `tests/Feature/PegawaiModelTest.php`

**Interfaces:**
- Consumes: `Unit`, `User` (existing models).
- Produces: `App\Enums\StatusKepegawaian` (`Pns='pns'`, `Pppk='pppk'`, `label(): string`). `App\Models\Pegawai` (`nama`, `nip`, `pangkat_golongan`, `jabatan`, `status_kepegawaian`, `unit_id`, `foto_profile`, `user_id`), relations `unit(): BelongsTo`, `user(): BelongsTo`, `assets(): HasMany` (against `Asset::current_holder_id` — its test is deferred to Task 2, once that FK exists), `scopeVisibleTo(Builder $query, User $user): void` (same pattern as `Asset::scopeVisibleTo`). `Pegawai::factory()`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PegawaiModelTest.php`:

```php
<?php

use App\Enums\StatusKepegawaian;
use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\QueryException;

it('casts status_kepegawaian and links to unit', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $pegawai = Pegawai::factory()->create(['unit_id' => $unit->id, 'status_kepegawaian' => 'pns']);

    expect($pegawai->status_kepegawaian)->toBe(StatusKepegawaian::Pns)
        ->and($pegawai->unit->is($unit))->toBeTrue()
        ->and($pegawai->user)->toBeNull();
});

it('enforces a unique nip when one is given', function () {
    Pegawai::factory()->create(['nip' => '198501012010011001']);

    Pegawai::factory()->create(['nip' => '198501012010011001']);
})->throws(QueryException::class);

it('allows multiple pegawai with a null nip', function () {
    Pegawai::factory()->create(['nip' => null]);
    Pegawai::factory()->create(['nip' => null]);

    expect(Pegawai::whereNull('nip')->count())->toBe(2);
});

it('scopes visibility the same way as accessibleUnitIds', function () {
    $kec = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $kel = Unit::create(['name' => 'Kelurahan Tembesi', 'type' => 'kelurahan', 'parent_id' => $kec->id]);
    $inKec = Pegawai::factory()->create(['unit_id' => $kec->id]);
    $inKel = Pegawai::factory()->create(['unit_id' => $kel->id]);

    $lurah = userWithRole('lurah', $kel);

    expect(Pegawai::query()->visibleTo($lurah)->pluck('id')->all())->toBe([$inKel->id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PegawaiModelTest.php`
Expected: FAIL — `Class "App\Models\Pegawai" not found`.

- [ ] **Step 3: Create the enum and migration**

Create `app/Enums/StatusKepegawaian.php`:

```php
<?php

namespace App\Enums;

enum StatusKepegawaian: string
{
    case Pns = 'pns';
    case Pppk = 'pppk';

    public function label(): string
    {
        return match ($this) {
            self::Pns => 'PNS',
            self::Pppk => 'PPPK',
        };
    }
}
```

Create the migration file **directly at this exact path** (do not use `php artisan make:migration`, which would stamp today's date — this file must sort *before* `2026_09_25_092650_create_asset_tables.php` so `pegawais` exists when Task 2 repoints `assets.current_holder_id` at it):

`database/migrations/2026_09_25_000000_create_pegawais_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pegawais', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('nip')->nullable()->unique();
            $table->string('pangkat_golongan')->nullable();
            $table->string('jabatan');
            $table->string('status_kepegawaian');
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->string('foto_profile')->nullable();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pegawais');
    }
};
```

- [ ] **Step 4: Create the model**

Create `app/Models/Pegawai.php`:

```php
<?php

namespace App\Models;

use App\Enums\StatusKepegawaian;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pegawai extends Model
{
    use HasFactory;

    protected $fillable = [
        'nama',
        'nip',
        'pangkat_golongan',
        'jabatan',
        'status_kepegawaian',
        'unit_id',
        'foto_profile',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'status_kepegawaian' => StatusKepegawaian::class,
            'unit_id' => 'integer',
            'user_id' => 'integer',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'current_holder_id');
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids !== null) {
            $query->whereIn('unit_id', $ids);
        }
    }
}
```

- [ ] **Step 5: Create the factory**

Create `database/factories/PegawaiFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\StatusKepegawaian;
use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Pegawai> */
class PegawaiFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nama' => fake()->name(),
            'nip' => fake()->unique()->numerify('################'),
            'pangkat_golongan' => 'Penata Muda / III.a',
            'jabatan' => 'Staff',
            'status_kepegawaian' => StatusKepegawaian::Pns,
            'unit_id' => fn () => Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan'])->id,
            'foto_profile' => null,
            'user_id' => null,
        ];
    }
}
```

- [ ] **Step 6: Migrate and run the test**

```bash
php artisan migrate
php artisan test tests/Feature/PegawaiModelTest.php
```

Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Enums/StatusKepegawaian.php app/Models/Pegawai.php database/migrations/2026_09_25_000000_create_pegawais_table.php database/factories/PegawaiFactory.php tests/Feature/PegawaiModelTest.php
git commit -m "feat: add pegawais table, model and factory"
```

---

### Task 2: Repoint `current_holder_id` from `users` to `pegawais`

**Files:**
- Modify: `database/migrations/2026_09_25_092650_create_asset_tables.php`
- Modify: `app/Models/Asset.php`
- Modify: `app/Models/AssetHistory.php`
- Test: `tests/Feature/AssetPegawaiHolderTest.php`

**Interfaces:**
- Consumes: `Pegawai` (Task 1).
- Produces: `Asset::currentHolder(): BelongsTo` → `Pegawai` (was `User`). `AssetHistory::currentHolder(): BelongsTo` → `Pegawai` (was `User`).

> **Note:** this edits an already-applied migration. That is normally unsafe, but the project confirmed it is still pre-production (no real data) — see the spec's 2026-09-26 revision note. After this change, run `php artisan migrate:fresh --seed` locally instead of `php artisan migrate`, since editing an already-run migration file does not retroactively alter a database that already ran the old version.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetPegawaiHolderTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetHistory;
use App\Models\Pegawai;

it('links Asset.currentHolder to a Pegawai', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id]);

    expect($asset->currentHolder)->toBeInstanceOf(Pegawai::class)
        ->and($asset->currentHolder->id)->toBe($pegawai->id);
});

it('links AssetHistory.currentHolder to a Pegawai', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create();
    $history = $asset->histories()->create([
        'event' => 'dipegang',
        'unit_id' => $asset->unit_id,
        'current_holder_id' => $pegawai->id,
        'kondisi' => 'baik',
    ]);

    expect($history->currentHolder)->toBeInstanceOf(Pegawai::class)
        ->and($history->currentHolder->id)->toBe($pegawai->id);
});

it('nulls current_holder_id on the asset when the pegawai is deleted', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id]);

    $pegawai->delete();

    expect($asset->refresh()->current_holder_id)->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetPegawaiHolderTest.php`
Expected: FAIL — inserting `current_holder_id` = a `Pegawai` id fails the still-active foreign key to `users` (constraint violation), or `currentHolder` resolves to the wrong model.

- [ ] **Step 3: Repoint the foreign keys**

In `database/migrations/2026_09_25_092650_create_asset_tables.php`, change both occurrences of the `current_holder_id` column (one in `assets`, one in `asset_histories`) from:

```php
            $table->foreignId('current_holder_id')->nullable()->constrained('users')->nullOnDelete();
```

to:

```php
            $table->foreignId('current_holder_id')->nullable()->constrained('pegawais')->nullOnDelete();
```

- [ ] **Step 4: Update the model relations**

In `app/Models/Asset.php`, change:

```php
    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }
```

to:

```php
    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'current_holder_id');
    }
```

(remove the now-unused `use App\Models\User;` import if nothing else in the file uses it — check with a search for `User::` and `User $` in the file first.)

In `app/Models/AssetHistory.php`, change:

```php
    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }
```

to:

```php
    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'current_holder_id');
    }
```

(the `user()` relation on `AssetHistory`, which points at the *actor* who caused the history entry, stays pointed at `User` — do not change it.)

- [ ] **Step 5: Rebuild the database and run the tests**

```bash
php artisan migrate:fresh --seed
php artisan test tests/Feature/AssetPegawaiHolderTest.php tests/Feature/AssetModelTest.php tests/Feature/AssetServiceTest.php
```

Expected: PASS (all). `AssetServiceTest`'s "ignores unit, status and holder fields smuggled into create data" test still passes unchanged — it only asserts `current_holder_id` stays `null`, regardless of which table it's a foreign key to.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_09_25_092650_create_asset_tables.php app/Models/Asset.php app/Models/AssetHistory.php tests/Feature/AssetPegawaiHolderTest.php
git commit -m "feat: repoint asset current_holder_id from users to pegawais"
```

---

### Task 3: Role and seeder cleanup — `pegawai` is no longer a login role

**Files:**
- Modify: `database/seeders/RoleSeeder.php`
- Modify: `database/seeders/UserSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`
- Create: `database/seeders/PegawaiSeeder.php`
- Modify: `tests/Feature/DatabaseSeederTest.php`
- Modify: `tests/Feature/UserUnitAccessTest.php`
- Modify: `tests/Feature/AssetVisibilityTest.php`
- Modify: `tests/Feature/DashboardInertiaPropsTest.php`

**Interfaces:**
- Consumes: `Pegawai` + factory shape (Task 1).
- Produces: `PegawaiSeeder` (seeds 2 demo pegawai, one per unit type, `local`/`testing` only, idempotent via `firstOrCreate`).

- [ ] **Step 1: Update `RoleSeeder`**

In `database/seeders/RoleSeeder.php`, change:

```php
        collect(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai'])
            ->each(fn (string $role) => Role::findOrCreate($role));
```

to:

```php
        collect(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'])
            ->each(fn (string $role) => Role::findOrCreate($role));
```

- [ ] **Step 2: Remove the Pegawai Demo login account from `UserSeeder`**

In `database/seeders/UserSeeder.php`, remove this line from the `$accounts` array:

```php
            ['name' => 'Pegawai Demo', 'email' => 'pegawai@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'pegawai'],
```

- [ ] **Step 3: Create `PegawaiSeeder`**

Create `database/seeders/PegawaiSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class PegawaiSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::where('type', 'kecamatan')->firstOrFail();
        $kelurahan = Unit::where('type', 'kelurahan')->firstOrFail();

        $pegawais = [
            [
                'nama' => 'Ahmad Fauzi',
                'nip' => '198501012010011001',
                'pangkat_golongan' => 'Penata Muda / III.a',
                'jabatan' => 'Staff Kecamatan',
                'status_kepegawaian' => 'pns',
                'unit_id' => $kecamatan->id,
            ],
            [
                'nama' => 'Siti Aminah',
                'nip' => null,
                'pangkat_golongan' => null,
                'jabatan' => 'Staff Kelurahan',
                'status_kepegawaian' => 'pppk',
                'unit_id' => $kelurahan->id,
            ],
        ];

        foreach ($pegawais as $data) {
            Pegawai::firstOrCreate(['nama' => $data['nama'], 'unit_id' => $data['unit_id']], $data);
        }
    }
}
```

- [ ] **Step 4: Wire `PegawaiSeeder` into `DatabaseSeeder`**

In `database/seeders/DatabaseSeeder.php`, change:

```php
        if (app()->environment(['local', 'testing'])) {
            $this->call(UserSeeder::class);
        }
```

to:

```php
        if (app()->environment(['local', 'testing'])) {
            $this->call([UserSeeder::class, PegawaiSeeder::class]);
        }
```

- [ ] **Step 5: Fix the tests that assumed `pegawai` was a login role**

In `tests/Feature/DatabaseSeederTest.php`, change the first test's assertion `User::count())->toBe(6)` to `User::count())->toBe(5)`, and add a `Pegawai` count assertion. Replace:

```php
    expect(Unit::where('type', 'kecamatan')->count())->toBe(1)
        ->and(Unit::where('type', 'kelurahan')->count())->toBe(7)
        ->and(User::count())->toBe(6);
```

with:

```php
    expect(Unit::where('type', 'kecamatan')->count())->toBe(1)
        ->and(Unit::where('type', 'kelurahan')->count())->toBe(7)
        ->and(User::count())->toBe(5)
        ->and(\App\Models\Pegawai::count())->toBe(2);
```

In `tests/Feature/UserUnitAccessTest.php`, remove `'pegawai'` from the `Role::findOrCreate` loop on line 8:

```php
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
```

and replace the whole `it('restricts admin_kecamatan and pegawai to exactly their own unit', ...)` test with:

```php
it('restricts admin_kecamatan to exactly their own unit', function () {
    $adminKecamatan = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $adminKecamatan->assignRole('admin_kecamatan');

    expect($adminKecamatan->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($adminKecamatan->canAccessUnit($this->kelurahanA))->toBeFalse();
});
```

In `tests/Feature/AssetVisibilityTest.php`, in the `it('agrees with canAccessUnit for every role and unit', ...)` test, change:

```php
    $home = in_array($role, ['admin_kelurahan', 'lurah', 'pegawai'], true) ? $this->kelA : $this->kec;
```

to:

```php
    $home = in_array($role, ['admin_kelurahan', 'lurah'], true) ? $this->kelA : $this->kec;
```

and change the trailing `->with([...])` from:

```php
})->with(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai']);
```

to:

```php
})->with(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah']);
```

In `tests/Feature/DashboardInertiaPropsTest.php`, remove this row from the `->with([...])` list:

```php
    ['pegawai@simaset.test', 'pegawai'],
```

- [ ] **Step 6: Run the affected tests**

```bash
php artisan test tests/Feature/DatabaseSeederTest.php tests/Feature/UserUnitAccessTest.php tests/Feature/AssetVisibilityTest.php tests/Feature/DashboardInertiaPropsTest.php
```

Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add database/seeders tests/Feature/DatabaseSeederTest.php tests/Feature/UserUnitAccessTest.php tests/Feature/AssetVisibilityTest.php tests/Feature/DashboardInertiaPropsTest.php
git commit -m "feat: drop pegawai login role, seed pegawai as data instead"
```

---

### Task 4: `PegawaiRepository` and `PegawaiService`

**Files:**
- Create: `app/Repositories/Contracts/PegawaiRepositoryInterface.php`
- Create: `app/Repositories/EloquentPegawaiRepository.php`
- Create: `app/Services/PegawaiService.php`
- Modify: `app/Providers/AppServiceProvider.php`
- Test: `tests/Feature/PegawaiServiceTest.php`

**Interfaces:**
- Consumes: `Pegawai` + factory (Task 1), `visibleTo` scope (Task 1).
- Produces:
  - `PegawaiRepositoryInterface::listVisibleTo(User $user): Collection<int, Pegawai>` (eager `unit`, `user`; ordered by `nama`), `create(array $attributes): Pegawai`, `update(Pegawai $pegawai, array $attributes): Pegawai`, `delete(Pegawai $pegawai): void`.
  - `PegawaiService::create(array $data, ?UploadedFile $foto, User $actor): Pegawai` — `unit_id` forced to `$actor->unit_id` unless `$actor` has role `kasubag` (kasubag may pick any unit via `$data['unit_id']`).
  - `PegawaiService::update(Pegawai $pegawai, array $data, ?UploadedFile $foto): Pegawai` — `unit_id` is never taken from `$data` on update (a pegawai's unit doesn't move via this form).
  - `PegawaiService::delete(Pegawai $pegawai): void`.
  - `PegawaiService::FIELDS` (list of editable column names, excluding `unit_id`, `foto_profile`, `user_id`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PegawaiServiceTest.php`:

```php
<?php

use App\Models\Pegawai;
use App\Services\PegawaiService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->service = app(PegawaiService::class);

    $this->data = fn (array $overrides = []) => array_merge([
        'nama' => 'Ahmad Fauzi',
        'nip' => '198501012010011001',
        'pangkat_golongan' => 'Penata Muda / III.a',
        'jabatan' => 'Staff',
        'status_kepegawaian' => 'pns',
        'unit_id' => $this->kel->id,
    ], $overrides);
});

it('forces unit_id to the admin unit actor unit, ignoring a smuggled unit_id', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);

    $pegawai = $this->service->create(($this->data)(['unit_id' => $this->kec->id]), null, $admin);

    expect($pegawai->unit_id)->toBe($this->kel->id);
});

it('lets kasubag pick any unit', function () {
    $kasubag = userWithRole('kasubag');

    $pegawai = $this->service->create(($this->data)(['unit_id' => $this->kec->id]), null, $kasubag);

    expect($pegawai->unit_id)->toBe($this->kec->id);
});

it('stores an uploaded profile photo on the public disk', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);

    $pegawai = $this->service->create(($this->data)(), UploadedFile::fake()->image('foto.jpg'), $admin);

    expect($pegawai->foto_profile)->not->toBeNull();
    Storage::disk('public')->assertExists($pegawai->foto_profile);
});

it('replaces the old photo file when updated with a new one', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), UploadedFile::fake()->image('lama.jpg'), $admin);
    $oldPath = $pegawai->foto_profile;

    $this->service->update($pegawai, ($this->data)(), UploadedFile::fake()->image('baru.jpg'));

    Storage::disk('public')->assertMissing($oldPath);
    Storage::disk('public')->assertExists($pegawai->refresh()->foto_profile);
});

it('never moves unit_id on update', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), null, $admin);

    $this->service->update($pegawai, ($this->data)(['unit_id' => $this->kec->id, 'nama' => 'Ahmad F.']), null);

    expect($pegawai->refresh()->unit_id)->toBe($this->kel->id)
        ->and($pegawai->nama)->toBe('Ahmad F.');
});

it('deletes a pegawai', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), null, $admin);

    $this->service->delete($pegawai);

    expect(Pegawai::find($pegawai->id))->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PegawaiServiceTest.php`
Expected: FAIL — `Target class [App\Services\PegawaiService] does not exist.`

- [ ] **Step 3: Create the repository contract and implementation**

Create `app/Repositories/Contracts/PegawaiRepositoryInterface.php`:

```php
<?php

namespace App\Repositories\Contracts;

use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Support\Collection;

interface PegawaiRepositoryInterface
{
    /** @return Collection<int, Pegawai> */
    public function listVisibleTo(User $user): Collection;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Pegawai;

    /** @param array<string, mixed> $attributes */
    public function update(Pegawai $pegawai, array $attributes): Pegawai;

    public function delete(Pegawai $pegawai): void;
}
```

Create `app/Repositories/EloquentPegawaiRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use Illuminate\Support\Collection;

class EloquentPegawaiRepository implements PegawaiRepositoryInterface
{
    public function listVisibleTo(User $user): Collection
    {
        return Pegawai::query()
            ->visibleTo($user)
            ->with(['unit', 'user'])
            ->orderBy('nama')
            ->get();
    }

    public function create(array $attributes): Pegawai
    {
        return Pegawai::create($attributes);
    }

    public function update(Pegawai $pegawai, array $attributes): Pegawai
    {
        $pegawai->update($attributes);

        return $pegawai;
    }

    public function delete(Pegawai $pegawai): void
    {
        $pegawai->delete();
    }
}
```

- [ ] **Step 4: Create the service**

Create `app/Services/PegawaiService.php`:

```php
<?php

namespace App\Services;

use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class PegawaiService
{
    public const FIELDS = ['nama', 'nip', 'pangkat_golongan', 'jabatan', 'status_kepegawaian'];

    public function __construct(private readonly PegawaiRepositoryInterface $pegawais) {}

    /** @param array<string, mixed> $data */
    public function create(array $data, ?UploadedFile $foto, User $actor): Pegawai
    {
        $pegawai = $this->pegawais->create([
            ...Arr::only($data, self::FIELDS),
            'unit_id' => $actor->hasRole('kasubag') ? $data['unit_id'] : $actor->unit_id,
        ]);

        return $this->attachPhoto($pegawai, $foto);
    }

    /** @param array<string, mixed> $data */
    public function update(Pegawai $pegawai, array $data, ?UploadedFile $foto): Pegawai
    {
        $this->pegawais->update($pegawai, Arr::only($data, self::FIELDS));

        return $this->attachPhoto($pegawai, $foto);
    }

    public function delete(Pegawai $pegawai): void
    {
        $this->pegawais->delete($pegawai);
    }

    private function attachPhoto(Pegawai $pegawai, ?UploadedFile $foto): Pegawai
    {
        if ($foto === null) {
            return $pegawai;
        }

        if ($pegawai->foto_profile) {
            Storage::disk('public')->delete($pegawai->foto_profile);
        }

        $pegawai->update(['foto_profile' => $foto->store("pegawais/{$pegawai->id}", 'public')]);

        return $pegawai;
    }
}
```

- [ ] **Step 5: Bind the repository**

In `app/Providers/AppServiceProvider.php`, add the imports

```php
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use App\Repositories\EloquentPegawaiRepository;
```

and add a line inside `register()`:

```php
        $this->app->bind(PegawaiRepositoryInterface::class, EloquentPegawaiRepository::class);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test tests/Feature/PegawaiServiceTest.php`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Repositories app/Services/PegawaiService.php app/Providers/AppServiceProvider.php tests/Feature/PegawaiServiceTest.php
git commit -m "feat: add PegawaiService and repository"
```

---

### Task 5: `PegawaiPolicy`, `PegawaiRequest`, `PegawaiController`, routes

**Files:**
- Create: `app/Policies/PegawaiPolicy.php`
- Create: `app/Http/Requests/PegawaiRequest.php`
- Create: `app/Http/Controllers/PegawaiController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/PegawaiManagementTest.php`

**Interfaces:**
- Consumes: `PegawaiService`, `PegawaiRepositoryInterface` (Task 4), Pest helpers (`userWithRole`, `makeKecamatan`, `makeKelurahan`).
- Produces: Routes (all `auth`): `GET /pegawais` `pegawais.index`, `POST /pegawais` `pegawais.store`, `PUT /pegawais/{pegawai}` `pegawais.update`, `DELETE /pegawais/{pegawai}` `pegawais.destroy`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/PegawaiManagementTest.php`:

```php
<?php

use App\Models\Pegawai;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
});

it('shows admin_kelurahan only pegawai in their own unit', function () {
    Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Di Kelurahan']);
    Pegawai::factory()->create(['unit_id' => $this->kec->id, 'nama' => 'Di Kecamatan']);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->get('/pegawais')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pegawai/Index')
            ->has('pegawais', 1)
            ->where('pegawais.0.nama', 'Di Kelurahan')
            ->where('can.create', true));
});

it('lets kasubag see every pegawai', function () {
    Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    Pegawai::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs(userWithRole('kasubag'))
        ->get('/pegawais')
        ->assertInertia(fn (Assert $page) => $page->has('pegawais', 2));
});

it('lets admin_kelurahan create a pegawai forced into their own unit', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/pegawais', [
            'nama' => 'Budi',
            'nip' => null,
            'pangkat_golongan' => null,
            'jabatan' => 'Staff',
            'status_kepegawaian' => 'pppk',
            'unit_id' => $this->kec->id,
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $pegawai = Pegawai::where('nama', 'Budi')->firstOrFail();
    expect($pegawai->unit_id)->toBe($this->kel->id);
});

it('rejects a duplicate nip with a validation error, not a 500', function () {
    Pegawai::factory()->create(['nip' => '198501012010011001']);

    $this->actingAs(userWithRole('kasubag'))
        ->post('/pegawais', [
            'nama' => 'Duplikat',
            'nip' => '198501012010011001',
            'jabatan' => 'Staff',
            'status_kepegawaian' => 'pns',
            'unit_id' => $this->kec->id,
        ])
        ->assertSessionHasErrors('nip');
});

it('forbids camat and lurah from creating, updating or deleting a pegawai', function (string $role) {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $user = userWithRole($role, $this->kec->id === $pegawai->unit_id ? $this->kec : $this->kel);

    $this->actingAs($user)->post('/pegawais', ['nama' => 'X'])->assertForbidden();
    $this->actingAs($user)->put("/pegawais/{$pegawai->id}", ['nama' => 'Y'])->assertForbidden();
    $this->actingAs($user)->delete("/pegawais/{$pegawai->id}")->assertForbidden();
})->with(['camat', 'lurah']);

it('lets an admin update a pegawai in their own unit', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'jabatan' => 'Staff']);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->put("/pegawais/{$pegawai->id}", [
            'nama' => $pegawai->nama,
            'nip' => $pegawai->nip,
            'pangkat_golongan' => $pegawai->pangkat_golongan,
            'jabatan' => 'Kepala Seksi',
            'status_kepegawaian' => $pegawai->status_kepegawaian->value,
            'unit_id' => $pegawai->unit_id,
        ])
        ->assertSessionHasNoErrors();

    expect($pegawai->refresh()->jabatan)->toBe('Kepala Seksi');
});

it('deletes a pegawai as kasubag', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs(userWithRole('kasubag'))
        ->delete("/pegawais/{$pegawai->id}")
        ->assertSessionHas('success');

    expect(Pegawai::find($pegawai->id))->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PegawaiManagementTest.php`
Expected: FAIL — route `pegawais.index`/`/pegawais` not found.

- [ ] **Step 3: Create the policy**

Create `app/Policies/PegawaiPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\Pegawai;
use App\Models\User;

class PegawaiPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['kasubag', 'admin_kecamatan', 'admin_kelurahan']);
    }

    public function update(User $user, Pegawai $pegawai): bool
    {
        return $user->hasRole('kasubag')
            || ($user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->canAccessUnit($pegawai->unit));
    }

    public function delete(User $user, Pegawai $pegawai): bool
    {
        return $this->update($user, $pegawai);
    }
}
```

- [ ] **Step 4: Create the FormRequest**

Create `app/Http/Requests/PegawaiRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Models\Pegawai;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PegawaiRequest extends FormRequest
{
    public function authorize(): bool
    {
        $pegawai = $this->route('pegawai');

        return $pegawai instanceof Pegawai
            ? $this->user()->can('update', $pegawai)
            : $this->user()->can('create', Pegawai::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $pegawai = $this->route('pegawai');

        return [
            'nama' => ['required', 'string', 'max:150'],
            'nip' => ['nullable', 'string', 'max:30', Rule::unique('pegawais', 'nip')->ignore($pegawai?->id)],
            'pangkat_golongan' => ['nullable', 'string', 'max:100'],
            'jabatan' => ['required', 'string', 'max:150'],
            'status_kepegawaian' => ['required', Rule::in(['pns', 'pppk'])],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')],
            'foto_profile' => ['nullable', 'image', 'max:2048'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama pegawai wajib diisi.',
            'nip.unique' => 'NIP ini sudah dipakai pegawai lain.',
            'jabatan.required' => 'Jabatan wajib diisi.',
            'unit_id.required' => 'Unit wajib dipilih.',
            'foto_profile.image' => 'Foto harus berupa gambar.',
        ];
    }
}
```

- [ ] **Step 5: Create the controller and routes**

Create `app/Http/Controllers/PegawaiController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\PegawaiRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use App\Services\PegawaiService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PegawaiController extends Controller
{
    public function __construct(
        private readonly PegawaiService $service,
        private readonly PegawaiRepositoryInterface $pegawais,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Pegawai::class);

        return Inertia::render('Pegawai/Index', [
            'pegawais' => $this->pegawais->listVisibleTo($request->user()),
            'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),
            'can' => ['create' => $request->user()->can('create', Pegawai::class)],
        ]);
    }

    public function store(PegawaiRequest $request): RedirectResponse
    {
        $this->service->create($request->validated(), $request->file('foto_profile'), $request->user());

        return back()->with('success', 'Pegawai berhasil ditambahkan.');
    }

    public function update(PegawaiRequest $request, Pegawai $pegawai): RedirectResponse
    {
        $this->service->update($pegawai, $request->validated(), $request->file('foto_profile'));

        return back()->with('success', 'Data pegawai berhasil diperbarui.');
    }

    public function destroy(Pegawai $pegawai): RedirectResponse
    {
        Gate::authorize('delete', $pegawai);

        $this->service->delete($pegawai);

        return back()->with('success', 'Pegawai berhasil dihapus.');
    }
}
```

In `routes/web.php`, add the import `use App\Http\Controllers\PegawaiController;` and, inside the existing `Route::middleware('auth')->group(...)` block, add:

```php
    Route::get('/pegawais', [PegawaiController::class, 'index'])->name('pegawais.index');
    Route::post('/pegawais', [PegawaiController::class, 'store'])->name('pegawais.store');
    Route::put('/pegawais/{pegawai}', [PegawaiController::class, 'update'])->name('pegawais.update');
    Route::delete('/pegawais/{pegawai}', [PegawaiController::class, 'destroy'])->name('pegawais.destroy');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test tests/Feature/PegawaiManagementTest.php`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Policies/PegawaiPolicy.php app/Http/Requests/PegawaiRequest.php app/Http/Controllers/PegawaiController.php routes/web.php tests/Feature/PegawaiManagementTest.php
git commit -m "feat: add pegawai management CRUD with unit-scoped policy"
```

---

### Task 6: Create a login account from a pegawai

**Files:**
- Modify: `app/Services/PegawaiService.php`
- Modify: `app/Policies/PegawaiPolicy.php`
- Create: `app/Http/Requests/CreatePegawaiUserRequest.php`
- Modify: `app/Http/Controllers/PegawaiController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/PegawaiCreateUserTest.php`

**Interfaces:**
- Consumes: `PegawaiService`, `Pegawai` (Tasks 1, 4).
- Produces: `PegawaiService::createLoginForPegawai(Pegawai $pegawai, string $email, string $password, string $role): User` (throws `InvalidArgumentException` if `$pegawai->user_id` is already set). Route `POST /pegawais/{pegawai}/user` `pegawais.create-user`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PegawaiCreateUserTest.php`:

```php
<?php

use App\Models\Pegawai;
use App\Models\User;

beforeEach(function () {
    $this->kel = makeKelurahan(makeKecamatan(), 'Kelurahan Tembesi');
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Budi Santoso']);
});

it('lets kasubag create a login account for a pegawai', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $user = User::where('email', 'budi@simaset.test')->firstOrFail();

    expect($user->hasRole('admin_kelurahan'))->toBeTrue()
        ->and($user->unit_id)->toBe($this->kel->id)
        ->and($this->pegawai->refresh()->user_id)->toBe($user->id);
});

it('rejects creating a second login for an already-linked pegawai', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ]);

    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi2@simaset.test',
            'password' => 'password123',
            'role' => 'lurah',
        ])
        ->assertStatus(422);

    expect(User::where('email', 'budi2@simaset.test')->exists())->toBeFalse();
});

it('forbids admin_kelurahan from creating a login account', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ])
        ->assertForbidden();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PegawaiCreateUserTest.php`
Expected: FAIL — route `pegawais.create-user` not found.

- [ ] **Step 3: Add `createLoginForPegawai` to the service**

In `app/Services/PegawaiService.php`, add the imports:

```php
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
```

and add this method to the class:

```php
    public function createLoginForPegawai(Pegawai $pegawai, string $email, string $password, string $role): User
    {
        if ($pegawai->user_id !== null) {
            throw new InvalidArgumentException('Pegawai ini sudah punya akun login.');
        }

        return DB::transaction(function () use ($pegawai, $email, $password, $role) {
            $user = User::create([
                'name' => $pegawai->nama,
                'email' => $email,
                'password' => Hash::make($password),
                'unit_id' => $pegawai->unit_id,
                'email_verified_at' => now(),
            ]);

            $user->assignRole($role);
            $pegawai->update(['user_id' => $user->id]);

            return $user;
        });
    }
```

- [ ] **Step 4: Add the `createUser` ability to the policy**

In `app/Policies/PegawaiPolicy.php`, add this method to the class:

```php
    public function createUser(User $user, Pegawai $pegawai): bool
    {
        return $user->hasRole('kasubag');
    }
```

- [ ] **Step 5: Create the FormRequest**

Create `app/Http/Requests/CreatePegawaiUserRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreatePegawaiUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('createUser', $this->route('pegawai'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'])],
        ];
    }
}
```

- [ ] **Step 6: Add the controller action and route**

In `app/Http/Controllers/PegawaiController.php`, add the import `use App\Http\Requests\CreatePegawaiUserRequest;` and this method:

```php
    public function createUser(CreatePegawaiUserRequest $request, Pegawai $pegawai): RedirectResponse
    {
        $this->service->createLoginForPegawai(
            $pegawai,
            $request->validated('email'),
            $request->validated('password'),
            $request->validated('role'),
        );

        return back()->with('success', 'Akun login berhasil dibuat untuk pegawai ini.');
    }
```

In `routes/web.php`, add:

```php
    Route::post('/pegawais/{pegawai}/user', [PegawaiController::class, 'createUser'])->name('pegawais.create-user');
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `php artisan test tests/Feature/PegawaiCreateUserTest.php`
Expected: PASS (3 tests). The "rejects creating a second login" test expects HTTP 422 — this comes from the `InvalidArgumentException` **not yet** being caught, so first confirm it currently surfaces as a 500; if so, wrap the service call in the controller action with a try/catch that returns a 422:

```php
    public function createUser(CreatePegawaiUserRequest $request, Pegawai $pegawai): RedirectResponse
    {
        try {
            $this->service->createLoginForPegawai(
                $pegawai,
                $request->validated('email'),
                $request->validated('password'),
                $request->validated('role'),
            );
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['email' => $e->getMessage()])->setStatusCode(422);
        }

        return back()->with('success', 'Akun login berhasil dibuat untuk pegawai ini.');
    }
```

Re-run the test until it passes.

- [ ] **Step 8: Commit**

```bash
git add app/Services/PegawaiService.php app/Policies/PegawaiPolicy.php app/Http/Requests/CreatePegawaiUserRequest.php app/Http/Controllers/PegawaiController.php routes/web.php tests/Feature/PegawaiCreateUserTest.php
git commit -m "feat: create a login account from a pegawai record"
```

---

### Task 7: Frontend — Pegawai management page and navigation

**Files:**
- Create: `resources/js/Pages/Pegawai/Index.tsx`
- Modify: `resources/js/types/index.d.ts`
- Modify: `resources/js/config/navigation.ts`

**Interfaces:**
- Consumes: `pegawais.*` routes (Task 5, 6), `PageProps`, `AssetCategory`-style TS conventions already in `types/index.d.ts`.
- Produces: TS type `Pegawai`, page component `Pegawai/Index`.

- [ ] **Step 1: Add the `Pegawai` TS type**

In `resources/js/types/index.d.ts`, add:

```typescript
export interface Pegawai {
    id: number;
    nama: string;
    nip: string | null;
    pangkat_golongan: string | null;
    jabatan: string;
    status_kepegawaian: 'pns' | 'pppk';
    unit_id: number;
    foto_profile: string | null;
    user_id: number | null;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    user?: { id: number; email: string } | null;
}
```

- [ ] **Step 2: Remove `pegawai` as a login role and add real nav links**

In `resources/js/config/navigation.ts`, remove `'pegawai'` from the `Role` union and delete the `pegawai: [...]` entry from `NAV_ITEMS_BY_ROLE`. Then replace the placeholder "Kelola User" and "Data Aset" entries with a real "Kelola Pegawai" link for the roles that manage pegawai data:

```typescript
export type Role =
    | 'kasubag'
    | 'camat'
    | 'admin_kecamatan'
    | 'admin_kelurahan'
    | 'lurah';

export interface NavItem {
    label: string;
    href: string;
    disabled?: boolean;
}

const DASHBOARD: NavItem = { label: 'Dashboard', href: '/dashboard' };
const PEGAWAI: NavItem = { label: 'Kelola Pegawai', href: '/pegawais' };

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
    kasubag: [
        DASHBOARD,
        { label: 'Kelola User', href: '#', disabled: true },
        PEGAWAI,
        { label: 'Master Data Aset', href: '/asset-categories' },
    ],
    camat: [
        DASHBOARD,
        { label: 'Approval Penerimaan Aset', href: '#', disabled: true },
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kecamatan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        PEGAWAI,
        { label: 'Penerimaan Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kelurahan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        PEGAWAI,
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    lurah: [
        DASHBOARD,
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
};

export function navItemsForRole(role: Role | undefined): NavItem[] {
    if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
        return [DASHBOARD];
    }

    return NAV_ITEMS_BY_ROLE[role];
}
```

- [ ] **Step 3: Build the page**

Create `resources/js/Pages/Pegawai/Index.tsx`:

```tsx
import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

type PegawaiForm = {
    nama: string;
    nip: string;
    pangkat_golongan: string;
    jabatan: string;
    status_kepegawaian: 'pns' | 'pppk';
    unit_id: number | '';
    foto_profile: File | null;
};

const emptyForm: PegawaiForm = {
    nama: '',
    nip: '',
    pangkat_golongan: '',
    jabatan: '',
    status_kepegawaian: 'pns',
    unit_id: '',
    foto_profile: null,
};

function CreateUserForm({ pegawai }: { pegawai: Pegawai }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ email: '', password: '', role: 'admin_kelurahan' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.create-user', pegawai.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    if (pegawai.user_id) {
        return <span className="text-xs text-green-700">Sudah punya akun ({pegawai.user?.email})</span>;
    }

    if (!open) {
        return (
            <SecondaryButton type="button" onClick={() => setOpen(true)}>
                Buat akun login
            </SecondaryButton>
        );
    }

    return (
        <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
            <div>
                <TextInput
                    type="email"
                    placeholder="Email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                />
                <InputError message={form.errors.email} className="mt-1" />
            </div>
            <div>
                <TextInput
                    type="password"
                    placeholder="Password"
                    value={form.data.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                />
                <InputError message={form.errors.password} className="mt-1" />
            </div>
            <select
                value={form.data.role}
                onChange={(e) => form.setData('role', e.target.value)}
                className="rounded-md border-gray-300 text-sm shadow-sm"
            >
                <option value="kasubag">Kasubag</option>
                <option value="camat">Camat</option>
                <option value="admin_kecamatan">Admin Kecamatan</option>
                <option value="admin_kelurahan">Admin Kelurahan</option>
                <option value="lurah">Lurah</option>
            </select>
            <PrimaryButton disabled={form.processing}>Simpan</PrimaryButton>
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
                Batal
            </SecondaryButton>
        </form>
    );
}

export default function Index({ pegawais, units, can }: PageProps<{ pegawais: Pegawai[]; units: UnitOption[]; can: { create: boolean } }>) {
    const form = useForm<PegawaiForm>(emptyForm);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const remove = (pegawai: Pegawai) => {
        if (confirm(`Hapus data pegawai "${pegawai.nama}"?`)) {
            router.delete(route('pegawais.destroy', pegawai.id), { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Data Pegawai</h1>}>
            <Head title="Data Pegawai" />

            {can.create && (
                <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-white p-4 shadow-sm md:grid-cols-3">
                    <div>
                        <TextInput placeholder="Nama" value={form.data.nama} onChange={(e) => form.setData('nama', e.target.value)} className="w-full" />
                        <InputError message={form.errors.nama} className="mt-1" />
                    </div>
                    <div>
                        <TextInput placeholder="NIP (opsional)" value={form.data.nip} onChange={(e) => form.setData('nip', e.target.value)} className="w-full" />
                        <InputError message={form.errors.nip} className="mt-1" />
                    </div>
                    <div>
                        <TextInput placeholder="Pangkat/Golongan" value={form.data.pangkat_golongan} onChange={(e) => form.setData('pangkat_golongan', e.target.value)} className="w-full" />
                    </div>
                    <div>
                        <TextInput placeholder="Jabatan" value={form.data.jabatan} onChange={(e) => form.setData('jabatan', e.target.value)} className="w-full" />
                        <InputError message={form.errors.jabatan} className="mt-1" />
                    </div>
                    <select
                        value={form.data.status_kepegawaian}
                        onChange={(e) => form.setData('status_kepegawaian', e.target.value as 'pns' | 'pppk')}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="pns">PNS</option>
                        <option value="pppk">PPPK</option>
                    </select>
                    <select
                        value={form.data.unit_id}
                        onChange={(e) => form.setData('unit_id', e.target.value === '' ? '' : Number(e.target.value))}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="">— Unit —</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => form.setData('foto_profile', e.target.files?.[0] ?? null)}
                        className="text-sm"
                    />
                    <PrimaryButton disabled={form.processing}>Tambah Pegawai</PrimaryButton>
                </form>
            )}

            <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase text-gray-500">
                            <th className="px-4 py-2">Nama</th>
                            <th className="px-4 py-2">NIP</th>
                            <th className="px-4 py-2">Jabatan</th>
                            <th className="px-4 py-2">Unit</th>
                            <th className="px-4 py-2">Akun Login</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pegawais.map((pegawai) => (
                            <tr key={pegawai.id}>
                                <td className="px-4 py-2">{pegawai.nama}</td>
                                <td className="px-4 py-2">{pegawai.nip ?? '—'}</td>
                                <td className="px-4 py-2">{pegawai.jabatan}</td>
                                <td className="px-4 py-2">{pegawai.unit?.name}</td>
                                <td className="px-4 py-2">
                                    <CreateUserForm pegawai={pegawai} />
                                </td>
                                <td className="px-4 py-2">
                                    <DangerButton type="button" onClick={() => remove(pegawai)}>
                                        Hapus
                                    </DangerButton>
                                </td>
                            </tr>
                        ))}
                        {pegawais.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                    Belum ada data pegawai.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Manual verification**

Run `php artisan serve` and `npm run dev`, log in as `admin.kelurahan@simaset.test` / `password`, open `/pegawais`, add a pegawai with a photo, confirm it appears scoped to that unit only. Log in as `kasubag@simaset.test`, confirm every pegawai across units is visible and "Buat akun login" works end to end (new user can then log in with the chosen role).

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Pegawai/Index.tsx resources/js/types/index.d.ts resources/js/config/navigation.ts
git commit -m "feat: add pegawai management page and navigation"
```
