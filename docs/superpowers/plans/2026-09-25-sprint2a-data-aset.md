# Sprint 2A — Data Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kasubag can manage asset categories (Kategori → Subkategori), admin aset kecamatan/kelurahan can record and edit assets with photos in their own unit, every viewing role browses assets scoped to its units, and any asset label (QR + ringkasan) can be printed as PDF.

**Architecture:** Follows the spec's backend convention: thin controllers → FormRequest (validation + authorization via Policy) → Service (business rules: register numbering, history, photos) → Repository (interface + Eloquent implementation, bound in `AppServiceProvider`). Unit scoping has one source of truth, `User::accessibleUnitIds()`, used both by `canAccessUnit()` and by the `Asset::visibleTo()` query scope. Only descriptive fields are editable in this sprint; `unit_id`, `kondisi`, `status`, `current_holder_id` change later only through approval transactions (Sprint 3+). The generic approval workflow engine is a separate later plan.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3 + Preline 2.7.0, `bacon/bacon-qr-code` ^3.1 (GD renderer), `dompdf/dompdf` ^3.1.

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md` (data model as updated in commit `4f57144`). Sprint scope: `docs/superpowers/plans/2026-09-24-simaset-sprint-plan.md` → Sprint 2, data-aset half.

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:` (phpunit.xml) — no MySQL-only SQL.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Repository (interface in `app/Repositories/Contracts`, Eloquent implementation in `app/Repositories`, bound in `AppServiceProvider::register()`). Controllers never query models directly.
- Laravel 13's base `Controller` has no `authorize()` helper — use `Gate::authorize(...)` or FormRequest `authorize()`.
- `asset_categories` is 2 levels flat: Kategori (parent_id null) → Subkategori. An asset's `category_id` must be a Subkategori.
- `assets` fields per spec: `kode_barang` (BMD code string, e.g. `1.3.2.05.02.04.004`), `nomor_register` (system-generated), `nama_aset`, `category_id`, `unit_id`, `current_holder_id` (nullable), `merk_type`, `kondisi` (baik / rusak_ringan / rusak_berat / hilang), `status` (aktif / dalam_proses), `tanggal_perolehan` (full date), `sumber_perolehan`, `nilai_perolehan`, `nilai_buku`, `no_dokumen` (reference only, not identity), `keterangan`.
- `nomor_register` = next integer per `kode_barang` across all units (unique `(kode_barang, nomor_register)`). Deliberate reading of the spec's "urut per kategori per unit": numbering per unit would collide when an asset is mutated to another unit (Sprint 3), and `kode_barang` is the BMD registry key finer than Subkategori.
- Editable after creation (this sprint): only descriptive fields. `unit_id`, `kondisi`, `status`, `current_holder_id` are never taken from request input on update; on create `unit_id` = creator's unit, `status` = aktif, `kondisi` from input.
- Roles: kasubag manages categories; admin_kecamatan / admin_kelurahan create and edit assets of their own unit; kasubag, camat, admin_kecamatan, admin_kelurahan, lurah can view assets within `accessibleUnitIds()`; pegawai cannot browse assets.
- Photos: `public` disk, path `assets/{asset_id}/…`, jpg/jpeg/png/webp, ≤ 5 MB each, ≤ 10 per asset in total.
- UI copy in Bahasa Indonesia. Money shown as Rupiah (`id-ID`), dates as `d MMM yyyy`.
- Frontend has no JS test runner; frontend behavior is verified by Inertia prop assertions in Pest plus the manual check in Task 9.

## Review Focus

- Two assets created back-to-back with the same `kode_barang` must get distinct consecutive `nomor_register`, continuing from the max even when that asset now sits in another unit → pinned in Task 4.
- An admin kelurahan who tampers the request (adds `unit_id`, `kondisi`, `status`, `current_holder_id`) must still end up with the asset in their own unit and those fields unchanged → pinned in Task 7.
- Opening or label-printing an asset outside the user's units via a hand-typed URL or `ids[]` must return 403, not the data → pinned in Tasks 6 and 8.
- A non-image file renamed `.jpg`, an oversized photo, or more than 10 photos total (across create + later edits) must be rejected with a message, not stored → pinned in Task 7.
- Deleting a category that still has subkategori or assets must show a message, not crash with a 500 → pinned in Task 5.

---

### Task 1: `asset_categories` table and `AssetCategory` model

**Files:**
- Create: `database/migrations/<timestamp>_create_asset_categories_table.php`
- Create: `app/Models/AssetCategory.php`
- Create: `database/factories/AssetCategoryFactory.php`
- Test: `tests/Feature/AssetCategoryModelTest.php`

**Interfaces:**
- Consumes: nothing new.
- Produces: `App\Models\AssetCategory` (`name`, `parent_id`), `parent(): BelongsTo`, `children(): HasMany` (ordered by name), `isSubcategory(): bool`, factory with `subcategory()` state. Saving throws `InvalidArgumentException` for a 3rd level, self-parent, or demoting a Kategori that has children.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetCategoryModelTest.php`:

```php
<?php

use App\Models\AssetCategory;
use Illuminate\Database\QueryException;

it('creates a kategori with subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $sub = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $kategori->id]);

    expect($kategori->isSubcategory())->toBeFalse()
        ->and($sub->isSubcategory())->toBeTrue()
        ->and($sub->parent->id)->toBe($kategori->id)
        ->and($kategori->children->pluck('name')->all())->toBe(['ALAT PENDINGIN']);
});

it('rejects a third level under a subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $kategori->id]);

    AssetCategory::create(['name' => 'TERLALU DALAM', 'parent_id' => $sub->id]);
})->throws(InvalidArgumentException::class);

it('rejects making a category its own parent', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT STUDIO']);

    $kategori->update(['parent_id' => $kategori->id]);
})->throws(InvalidArgumentException::class);

it('rejects demoting a kategori that has subkategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $a->id]);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);

    $a->update(['parent_id' => $b->id]);
})->throws(InvalidArgumentException::class);

it('rejects a duplicate subkategori name under the same kategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);

    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);
})->throws(QueryException::class);

it('prevents deleting a kategori that still has subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);

    $kategori->delete();
})->throws(QueryException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetCategoryModelTest.php`
Expected: FAIL — `Class "App\Models\AssetCategory" not found`.

- [ ] **Step 3: Create the migration**

```bash
php artisan make:migration create_asset_categories_table
```

Replace the generated `up()`/`down()` with:

```php
    public function up(): void
    {
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('parent_id')->nullable()->constrained('asset_categories')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['parent_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_categories');
    }
```

- [ ] **Step 4: Create the model**

Create `app/Models/AssetCategory.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class AssetCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'parent_id'];

    protected function casts(): array
    {
        return ['parent_id' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saving(function (AssetCategory $category) {
            if ($category->parent_id === null) {
                return;
            }

            if ($category->exists && $category->parent_id === $category->id) {
                throw new InvalidArgumentException('Kategori tidak boleh menjadi induk dirinya sendiri.');
            }

            $parent = AssetCategory::find($category->parent_id);

            if ($parent === null || $parent->parent_id !== null) {
                throw new InvalidArgumentException('Subkategori harus berada langsung di bawah kategori utama.');
            }

            if ($category->exists && $category->children()->exists()) {
                throw new InvalidArgumentException('Kategori yang punya subkategori tidak bisa dijadikan subkategori.');
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(AssetCategory::class, 'parent_id')->orderBy('name');
    }

    public function isSubcategory(): bool
    {
        return $this->parent_id !== null;
    }
}
```

- [ ] **Step 5: Create the factory**

Create `database/factories/AssetCategoryFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\AssetCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetCategory> */
class AssetCategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => strtoupper(fake()->unique()->words(2, true)),
            'parent_id' => null,
        ];
    }

    public function subcategory(): static
    {
        return $this->state(fn () => ['parent_id' => AssetCategory::factory()]);
    }
}
```

- [ ] **Step 6: Migrate and run the test**

```bash
php artisan migrate
php artisan test tests/Feature/AssetCategoryModelTest.php
```

Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add database/migrations app/Models/AssetCategory.php database/factories/AssetCategoryFactory.php tests/Feature/AssetCategoryModelTest.php
git commit -m "feat: add 2-level asset_categories with hierarchy guards"
```

---

### Task 2: Asset domain — enums, `assets` / `asset_photos` / `asset_histories`

**Files:**
- Create: `app/Enums/Kondisi.php`, `app/Enums/AssetStatus.php`
- Create: `database/migrations/<timestamp>_create_asset_tables.php`
- Create: `app/Models/Asset.php`, `app/Models/AssetPhoto.php`, `app/Models/AssetHistory.php`
- Create: `database/factories/AssetFactory.php`
- Modify: `app/Models/AssetCategory.php` (add `assets()`)
- Modify: `app/Models/Unit.php` (add `parent_id` integer cast)
- Test: `tests/Feature/AssetModelTest.php`

**Interfaces:**
- Consumes: `AssetCategory` + factory (Task 1), `Unit` (Sprint 1).
- Produces:
  - `App\Enums\Kondisi` cases `Baik='baik'`, `RusakRingan='rusak_ringan'`, `RusakBerat='rusak_berat'`, `Hilang='hilang'`; `label(): string`; `static options(): list<array{value:string,label:string}>`.
  - `App\Enums\AssetStatus` cases `Aktif='aktif'`, `DalamProses='dalam_proses'`; `label(): string`.
  - `App\Models\Asset` with relations `category()`, `unit()`, `currentHolder()`, `photos()` (morphMany `AssetPhoto` as `photoable`), `histories()` (latest first); `registerLabel(): string` (4-digit zero-padded); saving throws `InvalidArgumentException` if `category_id` is not a Subkategori. `tanggal_perolehan` serializes as `Y-m-d`.
  - `App\Models\AssetPhoto` (`path`, appended `url`), `App\Models\AssetHistory` (`asset_id`, `event`, `unit_id`, `current_holder_id`, `kondisi`, `user_id`, `keterangan`).
  - `AssetCategory::assets(): HasMany`.
  - `Asset::factory()` (defaults: subkategori + new kecamatan created on the fly).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetModelTest.php`:

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;

it('casts kondisi, status and tanggal_perolehan and links category and unit', function () {
    $asset = Asset::factory()->create(['kondisi' => 'rusak_ringan', 'tanggal_perolehan' => '2023-06-14']);

    expect($asset->kondisi)->toBe(Kondisi::RusakRingan)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->toArray()['tanggal_perolehan'])->toBe('2023-06-14')
        ->and($asset->category->isSubcategory())->toBeTrue()
        ->and($asset->unit)->toBeInstanceOf(Unit::class);
});

it('exposes kondisi options with Indonesian labels', function () {
    expect(Kondisi::options())->toBe([
        ['value' => 'baik', 'label' => 'Baik'],
        ['value' => 'rusak_ringan', 'label' => 'Rusak Ringan'],
        ['value' => 'rusak_berat', 'label' => 'Rusak Berat'],
        ['value' => 'hilang', 'label' => 'Hilang'],
    ]);
});

it('rejects an asset whose category is a top-level kategori', function () {
    $kategori = AssetCategory::factory()->create();

    Asset::factory()->create(['category_id' => $kategori->id]);
})->throws(InvalidArgumentException::class);

it('enforces a unique register number per kode_barang', function () {
    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 1]);

    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 1]);
})->throws(QueryException::class);

it('formats the register number as four digits', function () {
    expect(Asset::factory()->make(['nomor_register' => 7])->registerLabel())->toBe('0007');
});

it('stores photos polymorphically with a public url', function () {
    Storage::fake('public');
    $asset = Asset::factory()->create();

    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    expect($asset->photos()->count())->toBe(1)
        ->and($photo->photoable->is($asset))->toBeTrue()
        ->and($photo->url)->toContain("assets/{$asset->id}/a.jpg");
});

it('lists histories newest first', function () {
    $asset = Asset::factory()->create();
    $asset->histories()->create(['event' => 'dibuat', 'unit_id' => $asset->unit_id, 'kondisi' => 'baik', 'created_at' => now()->subDay()]);
    $asset->histories()->create(['event' => 'kondisi', 'unit_id' => $asset->unit_id, 'kondisi' => 'rusak_ringan']);

    expect($asset->histories()->pluck('event')->all())->toBe(['kondisi', 'dibuat']);
});

it('prevents deleting a unit that still holds assets', function () {
    $asset = Asset::factory()->create();

    $asset->unit->delete();
})->throws(QueryException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetModelTest.php`
Expected: FAIL — `Class "App\Enums\Kondisi" not found`.

- [ ] **Step 3: Create the enums**

Create `app/Enums/Kondisi.php`:

```php
<?php

namespace App\Enums;

enum Kondisi: string
{
    case Baik = 'baik';
    case RusakRingan = 'rusak_ringan';
    case RusakBerat = 'rusak_berat';
    case Hilang = 'hilang';

    public function label(): string
    {
        return match ($this) {
            self::Baik => 'Baik',
            self::RusakRingan => 'Rusak Ringan',
            self::RusakBerat => 'Rusak Berat',
            self::Hilang => 'Hilang',
        };
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $kondisi) => ['value' => $kondisi->value, 'label' => $kondisi->label()],
            self::cases(),
        );
    }
}
```

Create `app/Enums/AssetStatus.php`:

```php
<?php

namespace App\Enums;

enum AssetStatus: string
{
    case Aktif = 'aktif';
    case DalamProses = 'dalam_proses';

    public function label(): string
    {
        return match ($this) {
            self::Aktif => 'Aktif',
            self::DalamProses => 'Dalam Proses',
        };
    }
}
```

- [ ] **Step 4: Create the migration**

```bash
php artisan make:migration create_asset_tables
```

Replace `up()`/`down()` with:

```php
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('kode_barang');
            $table->unsignedInteger('nomor_register');
            $table->string('nama_aset');
            $table->foreignId('category_id')->constrained('asset_categories')->restrictOnDelete();
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('current_holder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('merk_type')->nullable();
            $table->string('kondisi');
            $table->string('status')->default('aktif');
            $table->date('tanggal_perolehan');
            $table->string('sumber_perolehan')->nullable();
            $table->decimal('nilai_perolehan', 15, 2);
            $table->decimal('nilai_buku', 15, 2);
            $table->string('no_dokumen')->nullable()->unique();
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->unique(['kode_barang', 'nomor_register']);
            $table->index(['unit_id', 'kondisi']);
        });

        Schema::create('asset_photos', function (Blueprint $table) {
            $table->id();
            $table->morphs('photoable');
            $table->string('path');
            $table->timestamps();
        });

        Schema::create('asset_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('event');
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('current_holder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kondisi');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_histories');
        Schema::dropIfExists('asset_photos');
        Schema::dropIfExists('assets');
    }
```

- [ ] **Step 5: Create the models**

Create `app/Models/Asset.php`:

```php
<?php

namespace App\Models;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use InvalidArgumentException;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'kode_barang',
        'nomor_register',
        'nama_aset',
        'category_id',
        'unit_id',
        'current_holder_id',
        'merk_type',
        'kondisi',
        'status',
        'tanggal_perolehan',
        'sumber_perolehan',
        'nilai_perolehan',
        'nilai_buku',
        'no_dokumen',
        'keterangan',
    ];

    protected function casts(): array
    {
        return [
            'nomor_register' => 'integer',
            'category_id' => 'integer',
            'unit_id' => 'integer',
            'current_holder_id' => 'integer',
            'kondisi' => Kondisi::class,
            'status' => AssetStatus::class,
            'tanggal_perolehan' => 'date:Y-m-d',
            'nilai_perolehan' => 'decimal:2',
            'nilai_buku' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Asset $asset) {
            if ($asset->exists && ! $asset->isDirty('category_id')) {
                return;
            }

            $category = AssetCategory::find($asset->category_id);

            if ($category === null || ! $category->isSubcategory()) {
                throw new InvalidArgumentException('Aset harus memakai subkategori, bukan kategori utama.');
            }
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(AssetHistory::class)->latest()->latest('id');
    }

    public function registerLabel(): string
    {
        return str_pad((string) $this->nomor_register, 4, '0', STR_PAD_LEFT);
    }
}
```

Create `app/Models/AssetPhoto.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

class AssetPhoto extends Model
{
    protected $fillable = ['path'];

    protected $appends = ['url'];

    public function photoable(): MorphTo
    {
        return $this->morphTo();
    }

    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }
}
```

Create `app/Models/AssetHistory.php`:

```php
<?php

namespace App\Models;

use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetHistory extends Model
{
    protected $fillable = [
        'event',
        'unit_id',
        'current_holder_id',
        'kondisi',
        'user_id',
        'keterangan',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['kondisi' => Kondisi::class];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }
}
```

In `app/Models/AssetCategory.php`, add `use Illuminate\Database\Eloquent\Relations\HasMany;` is already imported; add this method to the class:

```php
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'category_id');
    }
```

In `app/Models/Unit.php`, add a casts method to the class (the strict `===` comparisons in `Unit::saving` and `User::canAccessUnit` rely on integers):

```php
    protected function casts(): array
    {
        return ['parent_id' => 'integer'];
    }
```

- [ ] **Step 6: Create the factory**

Create `database/factories/AssetFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Asset> */
class AssetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'kode_barang' => '1.3.2.05.02.04.004',
            'nomor_register' => fake()->unique()->numberBetween(1, 999999),
            'nama_aset' => 'A.C. Split',
            'category_id' => fn () => AssetCategory::factory()->subcategory()->create()->id,
            'unit_id' => fn () => Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan'])->id,
            'merk_type' => 'PANASONIC',
            'kondisi' => Kondisi::Baik,
            'status' => AssetStatus::Aktif,
            'tanggal_perolehan' => '2023-06-14',
            'nilai_perolehan' => 5000000,
            'nilai_buku' => 1250000,
        ];
    }
}
```

- [ ] **Step 7: Migrate and run tests**

```bash
php artisan migrate
php artisan test tests/Feature/AssetModelTest.php tests/Feature/AssetCategoryModelTest.php tests/Feature/UnitModelTest.php
```

Expected: PASS (all).

- [ ] **Step 8: Commit**

```bash
git add app/Enums app/Models database/migrations database/factories tests/Feature/AssetModelTest.php
git commit -m "feat: add assets, asset_photos and asset_histories with enums"
```

---

### Task 3: One source of truth for unit scope — `accessibleUnitIds()` and `Asset::visibleTo()`

**Files:**
- Modify: `app/Models/User.php`
- Modify: `app/Models/Asset.php`
- Modify: `tests/Pest.php` (shared helpers)
- Test: `tests/Feature/AssetVisibilityTest.php`

**Interfaces:**
- Consumes: `Unit`, `Asset` (Task 2), spatie roles.
- Produces:
  - `User::accessibleUnitIds(): ?array` — `null` = every unit (kasubag); `[]` = none (no role or no unit); camat = own kecamatan id + its kelurahan ids; every other role = `[unit_id]`.
  - `User::canAccessUnit(Unit $unit): bool` re-implemented on top of `accessibleUnitIds()` (same behavior; Sprint 1 tests must stay green).
  - `Asset::scopeVisibleTo(Builder $query, User $user): void` (use as `Asset::query()->visibleTo($user)`).
  - Pest helpers in `tests/Pest.php`: `userWithRole(string $role, ?Unit $unit = null): User`, `makeKecamatan(string $name = 'Kecamatan Sagulung'): Unit`, `makeKelurahan(Unit $kecamatan, string $name): Unit`.

- [ ] **Step 1: Add the shared test helpers**

In `tests/Pest.php`, replace the placeholder block

```php
function something()
{
    // ..
}
```

with:

```php
function userWithRole(string $role, ?\App\Models\Unit $unit = null): \App\Models\User
{
    \Spatie\Permission\Models\Role::findOrCreate($role);

    $user = \App\Models\User::factory()->create(['unit_id' => $unit?->id]);
    $user->assignRole($role);

    return $user;
}

function makeKecamatan(string $name = 'Kecamatan Sagulung'): \App\Models\Unit
{
    return \App\Models\Unit::create(['name' => $name, 'type' => 'kecamatan']);
}

function makeKelurahan(\App\Models\Unit $kecamatan, string $name): \App\Models\Unit
{
    return \App\Models\Unit::create(['name' => $name, 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);
}
```

(If the placeholder text differs slightly, delete whatever `function something()` stub is there and add the three functions.)

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/AssetVisibilityTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\User;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Sungai Binti');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->assetKec = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $this->assetA = Asset::factory()->create(['unit_id' => $this->kelA->id]);
    $this->assetB = Asset::factory()->create(['unit_id' => $this->kelB->id]);
    $this->assetOther = Asset::factory()->create(['unit_id' => $this->otherKec->id]);
});

function visibleIds(User $user): array
{
    return Asset::query()->visibleTo($user)->orderBy('id')->pluck('id')->all();
}

it('shows kasubag every asset', function () {
    expect(visibleIds(userWithRole('kasubag')))->toHaveCount(4);
});

it('shows camat their kecamatan and its kelurahan only', function () {
    $ids = visibleIds(userWithRole('camat', $this->kec));

    expect($ids)->toBe([$this->assetKec->id, $this->assetA->id, $this->assetB->id]);
});

it('shows admin_kelurahan and lurah only their own kelurahan', function (string $role) {
    expect(visibleIds(userWithRole($role, $this->kelA)))->toBe([$this->assetA->id]);
})->with(['admin_kelurahan', 'lurah']);

it('shows admin_kecamatan only kecamatan-level assets', function () {
    expect(visibleIds(userWithRole('admin_kecamatan', $this->kec)))->toBe([$this->assetKec->id]);
});

it('shows a user with no role nothing', function () {
    $user = User::factory()->create(['unit_id' => $this->kec->id]);

    expect(visibleIds($user))->toBe([]);
});

it('agrees with canAccessUnit for every role and unit', function (string $role) {
    $home = in_array($role, ['admin_kelurahan', 'lurah', 'pegawai'], true) ? $this->kelA : $this->kec;
    $user = userWithRole($role, $role === 'kasubag' ? null : $home);
    $ids = $user->accessibleUnitIds();

    foreach ([$this->kec, $this->kelA, $this->kelB, $this->otherKec] as $unit) {
        $inList = $ids === null || in_array($unit->id, $ids, true);
        expect($user->canAccessUnit($unit))->toBe($inList);
    }
})->with(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai']);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetVisibilityTest.php`
Expected: FAIL — `Call to undefined method ... visibleTo()`.

- [ ] **Step 4: Implement `accessibleUnitIds()` and rebase `canAccessUnit()` on it**

In `app/Models/User.php`, add a `unit_id` integer cast to `casts()`:

```php
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'unit_id' => 'integer',
        ];
```

Replace the whole `canAccessUnit()` method with these two methods:

```php
    /**
     * Unit ids this user may see: null means every unit.
     *
     * @return list<int>|null
     */
    public function accessibleUnitIds(): ?array
    {
        if ($this->hasRole('kasubag')) {
            return null;
        }

        if ($this->getRoleNames()->isEmpty() || $this->unit_id === null) {
            return [];
        }

        if ($this->hasRole('camat')) {
            return Unit::query()
                ->where('id', $this->unit_id)
                ->orWhere('parent_id', $this->unit_id)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return [$this->unit_id];
    }

    public function canAccessUnit(Unit $unit): bool
    {
        $ids = $this->accessibleUnitIds();

        return $ids === null || in_array($unit->id, $ids, true);
    }
```

- [ ] **Step 5: Add the query scope**

In `app/Models/Asset.php` add `use Illuminate\Database\Eloquent\Builder;` to the imports and this method to the class:

```php
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids !== null) {
            $query->whereIn('unit_id', $ids);
        }
    }
```

- [ ] **Step 6: Run the new test and the Sprint 1 scoping tests**

```bash
php artisan test tests/Feature/AssetVisibilityTest.php tests/Feature/UserUnitAccessTest.php
```

Expected: PASS (both files — the Sprint 1 file proves the refactor kept behavior).

- [ ] **Step 7: Commit**

```bash
git add app/Models/User.php app/Models/Asset.php tests/Pest.php tests/Feature/AssetVisibilityTest.php
git commit -m "feat: single unit-scope source for canAccessUnit and asset queries"
```

---

### Task 4: `AssetService` and repositories — register numbering, history, photos

**Files:**
- Create: `app/Repositories/Contracts/AssetRepositoryInterface.php`
- Create: `app/Repositories/EloquentAssetRepository.php`
- Create: `app/Services/AssetService.php`
- Modify: `app/Providers/AppServiceProvider.php`
- Test: `tests/Feature/AssetServiceTest.php`

**Interfaces:**
- Consumes: `Asset`, `AssetPhoto`, `AssetHistory`, enums (Task 2), `visibleTo` scope (Task 3).
- Produces:
  - `AssetRepositoryInterface`:
    - `paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator` — filters `search` (nama_aset / kode_barang / no_dokumen, LIKE), `category_id` (a Kategori also matches its Subkategori), `unit_id`, `kondisi`; ordered nama_aset, kode_barang, nomor_register; eager `category.parent`, `unit`; query string kept.
    - `maxRegisterNumber(string $kodeBarang): int` (0 when none; row-locks).
    - `create(array $attributes): Asset`, `update(Asset $asset, array $attributes): Asset`.
  - `AssetService`:
    - `const DESCRIPTIVE_FIELDS` (list of editable column names).
    - `create(array $data, array $photos, User $actor): Asset` — `unit_id` = actor's unit, `status` = aktif, `kondisi` from `$data`, `nomor_register` = max+1 for the `kode_barang`, stores photos, writes history `event = 'dibuat'`.
    - `update(Asset $asset, array $data, array $photos): Asset` — only `DESCRIPTIVE_FIELDS`; changing `kode_barang` reassigns `nomor_register`; appends photos.
    - `deletePhoto(AssetPhoto $photo): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetServiceTest.php`:

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Services\AssetService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->sub = AssetCategory::factory()->subcategory()->create();
    $this->service = app(AssetService::class);

    $this->data = fn (array $overrides = []) => array_merge([
        'kode_barang' => '1.3.2.05.02.04.004',
        'nama_aset' => 'A.C. Split',
        'category_id' => $this->sub->id,
        'merk_type' => 'PANASONIC',
        'kondisi' => 'baik',
        'tanggal_perolehan' => '2023-06-14',
        'sumber_perolehan' => null,
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 1250000,
        'no_dokumen' => null,
        'keterangan' => null,
    ], $overrides);
});

it('numbers registers consecutively per kode_barang', function () {
    $first = $this->service->create(($this->data)(), [], $this->admin);
    $second = $this->service->create(($this->data)(), [], $this->admin);
    $otherCode = $this->service->create(($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), [], $this->admin);

    expect($first->nomor_register)->toBe(1)
        ->and($second->nomor_register)->toBe(2)
        ->and($otherCode->nomor_register)->toBe(1);
});

it('continues numbering from the max even when that asset lives in another unit', function () {
    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 41, 'unit_id' => $this->kel->id]);

    $asset = $this->service->create(($this->data)(), [], $this->admin);

    expect($asset->nomor_register)->toBe(42);
});

it('places the asset in the creator unit as aktif and records a history entry', function () {
    $asset = $this->service->create(($this->data)(['kondisi' => 'rusak_ringan']), [], $this->admin);

    $history = $asset->histories()->first();

    expect($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->kondisi)->toBe(Kondisi::RusakRingan)
        ->and($history->event)->toBe('dibuat')
        ->and($history->user_id)->toBe($this->admin->id)
        ->and($history->unit_id)->toBe($this->kec->id)
        ->and($history->kondisi)->toBe(Kondisi::RusakRingan);
});

it('ignores unit, status and holder fields smuggled into create data', function () {
    $asset = $this->service->create(($this->data)([
        'unit_id' => $this->kel->id,
        'status' => 'dalam_proses',
        'current_holder_id' => $this->admin->id,
        'nomor_register' => 999,
    ]), [], $this->admin);

    expect($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->current_holder_id)->toBeNull()
        ->and($asset->nomor_register)->toBe(1);
});

it('stores uploaded photos on the public disk', function () {
    $asset = $this->service->create(($this->data)(), [
        UploadedFile::fake()->create('depan.jpg', 200, 'image/jpeg'),
        UploadedFile::fake()->create('samping.jpg', 200, 'image/jpeg'),
    ], $this->admin);

    expect($asset->photos)->toHaveCount(2);
    foreach ($asset->photos as $photo) {
        expect($photo->path)->toStartWith("assets/{$asset->id}/");
        Storage::disk('public')->assertExists($photo->path);
    }
});

it('updates descriptive fields only', function () {
    $asset = $this->service->create(($this->data)(), [], $this->admin);

    $this->service->update($asset, ($this->data)([
        'nama_aset' => 'AC Split 1 PK',
        'kondisi' => 'hilang',
        'unit_id' => $this->kel->id,
        'status' => 'dalam_proses',
    ]), []);

    $asset->refresh();

    expect($asset->nama_aset)->toBe('AC Split 1 PK')
        ->and($asset->kondisi)->toBe(Kondisi::Baik)
        ->and($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif);
});

it('reassigns the register number when kode_barang changes', function () {
    $this->service->create(($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), [], $this->admin);
    $asset = $this->service->create(($this->data)(), [], $this->admin);

    $this->service->update($asset, ($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), []);

    expect($asset->refresh()->nomor_register)->toBe(2)
        ->and($asset->kode_barang)->toBe('1.3.2.10.02.03.004');
});

it('deletes a photo file and row', function () {
    $asset = $this->service->create(($this->data)(), [UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg')], $this->admin);
    $photo = $asset->photos()->first();

    $this->service->deletePhoto($photo);

    Storage::disk('public')->assertMissing($photo->path);
    expect($asset->photos()->count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetServiceTest.php`
Expected: FAIL — `Target class [App\Services\AssetService] does not exist.`

- [ ] **Step 3: Create the repository contract and implementation**

Create `app/Repositories/Contracts/AssetRepositoryInterface.php`:

```php
<?php

namespace App\Repositories\Contracts;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AssetRepositoryInterface
{
    /**
     * @param  array{search?: ?string, category_id?: int|string|null, unit_id?: int|string|null, kondisi?: ?string}  $filters
     */
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator;

    public function maxRegisterNumber(string $kodeBarang): int;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Asset;

    /** @param array<string, mixed> $attributes */
    public function update(Asset $asset, array $attributes): Asset;
}
```

Create `app/Repositories/EloquentAssetRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EloquentAssetRepository implements AssetRepositoryInterface
{
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator
    {
        return Asset::query()
            ->visibleTo($user)
            ->with(['category.parent', 'unit'])
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $query) use ($search) {
                    $query->where('nama_aset', 'like', "%{$search}%")
                        ->orWhere('kode_barang', 'like', "%{$search}%")
                        ->orWhere('no_dokumen', 'like', "%{$search}%");
                });
            })
            ->when($filters['category_id'] ?? null, function (Builder $query, $categoryId) {
                $query->whereIn('category_id', AssetCategory::query()
                    ->where('id', $categoryId)
                    ->orWhere('parent_id', $categoryId)
                    ->pluck('id'));
            })
            ->when($filters['unit_id'] ?? null, fn (Builder $query, $unitId) => $query->where('unit_id', $unitId))
            ->when($filters['kondisi'] ?? null, fn (Builder $query, $kondisi) => $query->where('kondisi', $kondisi))
            ->orderBy('nama_aset')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function maxRegisterNumber(string $kodeBarang): int
    {
        return (int) Asset::query()
            ->where('kode_barang', $kodeBarang)
            ->lockForUpdate()
            ->max('nomor_register');
    }

    public function create(array $attributes): Asset
    {
        return Asset::create($attributes);
    }

    public function update(Asset $asset, array $attributes): Asset
    {
        $asset->update($attributes);

        return $asset;
    }
}
```

- [ ] **Step 4: Create the service**

Create `app/Services/AssetService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AssetService
{
    public const DESCRIPTIVE_FIELDS = [
        'kode_barang',
        'nama_aset',
        'category_id',
        'merk_type',
        'tanggal_perolehan',
        'sumber_perolehan',
        'nilai_perolehan',
        'nilai_buku',
        'no_dokumen',
        'keterangan',
    ];

    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function create(array $data, array $photos, User $actor): Asset
    {
        return DB::transaction(function () use ($data, $photos, $actor) {
            $asset = $this->assets->create([
                ...Arr::only($data, self::DESCRIPTIVE_FIELDS),
                'kondisi' => $data['kondisi'],
                'unit_id' => $actor->unit_id,
                'status' => AssetStatus::Aktif,
                'nomor_register' => $this->assets->maxRegisterNumber($data['kode_barang']) + 1,
            ]);

            $this->storePhotos($asset, $photos);

            $asset->histories()->create([
                'event' => 'dibuat',
                'unit_id' => $asset->unit_id,
                'current_holder_id' => null,
                'kondisi' => $asset->kondisi,
                'user_id' => $actor->id,
            ]);

            return $asset;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function update(Asset $asset, array $data, array $photos): Asset
    {
        return DB::transaction(function () use ($asset, $data, $photos) {
            $attributes = Arr::only($data, self::DESCRIPTIVE_FIELDS);

            if (isset($attributes['kode_barang']) && $attributes['kode_barang'] !== $asset->kode_barang) {
                $attributes['nomor_register'] = $this->assets->maxRegisterNumber($attributes['kode_barang']) + 1;
            }

            $this->assets->update($asset, $attributes);
            $this->storePhotos($asset, $photos);

            return $asset;
        });
    }

    public function deletePhoto(AssetPhoto $photo): void
    {
        Storage::disk('public')->delete($photo->path);
        $photo->delete();
    }

    /** @param list<UploadedFile> $photos */
    private function storePhotos(Asset $asset, array $photos): void
    {
        foreach ($photos as $photo) {
            $asset->photos()->create(['path' => $photo->store("assets/{$asset->id}", 'public')]);
        }
    }
}
```

- [ ] **Step 5: Bind the repository**

In `app/Providers/AppServiceProvider.php`, add the imports

```php
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Repositories\EloquentAssetRepository;
```

and replace the body of `register()` (currently `//`) with:

```php
        $this->app->bind(AssetRepositoryInterface::class, EloquentAssetRepository::class);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test tests/Feature/AssetServiceTest.php`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Repositories app/Services app/Providers/AppServiceProvider.php tests/Feature/AssetServiceTest.php
git commit -m "feat: asset service with per-code register numbering, history and photos"
```

---

### Task 5: Category management for Kasubag (backend + page) and category seeder

**Files:**
- Create: `app/Repositories/Contracts/AssetCategoryRepositoryInterface.php`, `app/Repositories/EloquentAssetCategoryRepository.php`
- Create: `app/Services/AssetCategoryService.php`
- Create: `app/Policies/AssetCategoryPolicy.php`
- Create: `app/Http/Requests/AssetCategoryRequest.php`
- Create: `app/Http/Controllers/AssetCategoryController.php`
- Create: `database/seeders/AssetCategorySeeder.php`
- Create: `resources/js/Pages/AssetCategories/Index.tsx`
- Modify: `app/Providers/AppServiceProvider.php` (bind), `app/Http/Middleware/HandleInertiaRequests.php` (flash), `routes/web.php`, `database/seeders/DatabaseSeeder.php`, `tests/TestCase.php`, `resources/js/types/index.d.ts`, `resources/js/Layouts/AuthenticatedLayout.tsx`, `resources/js/config/navigation.ts`
- Test: `tests/Feature/AssetCategoryManagementTest.php`, `tests/Feature/DatabaseSeederTest.php`

**Interfaces:**
- Consumes: `AssetCategory` (Task 1), `Asset` factory (Task 2), Pest helpers (Task 3).
- Produces:
  - `AssetCategoryRepositoryInterface::tree(): Collection` — top-level categories ordered by name, each with `children` (ordered) and `assets_count` on both levels. Used again by Tasks 6 and 7.
  - Routes (all `auth`): `GET /asset-categories` `asset-categories.index`, `POST /asset-categories` `asset-categories.store`, `PUT /asset-categories/{assetCategory}` `asset-categories.update`, `DELETE /asset-categories/{assetCategory}` `asset-categories.destroy`.
  - Shared Inertia prop `flash: { success: string|null, error: string|null }`; TS `PageProps['flash']`.
  - TS type `AssetCategory`.
  - `tests/TestCase.php` calls `withoutVite()` so page tests don't need a built manifest.

- [ ] **Step 1: Make page tests independent of the Vite build**

`resources/views/app.blade.php` loads `resources/js/Pages/{component}.tsx` through `@vite`, so any test rendering a new page fails with a manifest error until `npm run build` runs. Replace `tests/TestCase.php` with:

```php
<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/AssetCategoryManagementTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
});

it('shows kasubag the category tree', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);
    AssetCategory::create(['name' => 'ALAT DAPUR', 'parent_id' => $kategori->id]);

    $this->actingAs($this->kasubag)
        ->get('/asset-categories')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('AssetCategories/Index')
            ->has('categories', 1)
            ->where('categories.0.name', 'ALAT RUMAH TANGGA')
            ->has('categories.0.children', 2)
            ->where('categories.0.children.0.name', 'ALAT DAPUR'));
});

it('forbids every other role from managing categories', function (string $role) {
    $user = userWithRole($role, $this->kec);

    $this->actingAs($user)->get('/asset-categories')->assertForbidden();
    $this->actingAs($user)->post('/asset-categories', ['name' => 'X'])->assertForbidden();
})->with(['camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai']);

it('lets kasubag create a kategori and a subkategori', function () {
    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'ALAT KANTOR'])
        ->assertRedirect()
        ->assertSessionHas('success');

    $kategori = AssetCategory::where('name', 'ALAT KANTOR')->firstOrFail();

    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $kategori->id])
        ->assertSessionHasNoErrors();

    expect($kategori->children()->pluck('name')->all())->toBe(['ALAT KANTOR LAINNYA']);
});

it('rejects a duplicate name at the same level but allows it under another kategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $a->id]);

    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'ALAT KANTOR'])
        ->assertSessionHasErrors('name');
    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'LAINNYA', 'parent_id' => $a->id])
        ->assertSessionHasErrors('name');
    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'LAINNYA', 'parent_id' => $b->id])
        ->assertSessionHasNoErrors();
});

it('only accepts a top-level kategori as parent', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $kategori->id]);

    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'CUCU', 'parent_id' => $sub->id])
        ->assertSessionHasErrors('parent_id');
});

it('renames a category and refuses to demote a kategori that has subkategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $a->id]);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);

    $this->actingAs($this->kasubag)->put("/asset-categories/{$a->id}", ['name' => 'PERALATAN KANTOR'])
        ->assertSessionHasNoErrors();
    expect($a->refresh()->name)->toBe('PERALATAN KANTOR');

    $this->actingAs($this->kasubag)->put("/asset-categories/{$a->id}", ['name' => 'PERALATAN KANTOR', 'parent_id' => $b->id])
        ->assertSessionHasErrors('parent_id');
    expect($a->refresh()->parent_id)->toBeNull();
});

it('refuses to delete a category that still has subkategori or assets, with a message', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $kategori->id]);
    Asset::factory()->create(['category_id' => $sub->id, 'unit_id' => $this->kec->id]);

    $this->actingAs($this->kasubag)->delete("/asset-categories/{$kategori->id}")
        ->assertSessionHasErrors('category');
    $this->actingAs($this->kasubag)->delete("/asset-categories/{$sub->id}")
        ->assertSessionHasErrors('category');

    expect(AssetCategory::count())->toBe(2);
});

it('deletes an unused category', function () {
    $kategori = AssetCategory::create(['name' => 'KOSONG']);

    $this->actingAs($this->kasubag)->delete("/asset-categories/{$kategori->id}")
        ->assertSessionHas('success');

    expect(AssetCategory::count())->toBe(0);
});

it('redirects guests to login', function () {
    $this->get('/asset-categories')->assertRedirect('/login');
});
```

Append to `tests/Feature/DatabaseSeederTest.php`:

```php
it('seeds the client asset categories idempotently in every environment', function () {
    app()->instance('env', 'production');

    try {
        app(DatabaseSeeder::class)->run();
        app(DatabaseSeeder::class)->run();
    } finally {
        app()->instance('env', 'testing');
    }

    expect(\App\Models\AssetCategory::whereNull('parent_id')->count())->toBe(7)
        ->and(\App\Models\AssetCategory::whereNotNull('parent_id')->count())->toBe(15)
        ->and(\App\Models\AssetCategory::where('name', 'ALAT PENDINGIN')->first()->parent->name)->toBe('ALAT RUMAH TANGGA');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `php artisan test tests/Feature/AssetCategoryManagementTest.php tests/Feature/DatabaseSeederTest.php`
Expected: FAIL — `/asset-categories` returns 404 and category counts are 0.

- [ ] **Step 4: Repository, service, policy, request**

Create `app/Repositories/Contracts/AssetCategoryRepositoryInterface.php`:

```php
<?php

namespace App\Repositories\Contracts;

use App\Models\AssetCategory;
use Illuminate\Database\Eloquent\Collection;

interface AssetCategoryRepositoryInterface
{
    /** @return Collection<int, AssetCategory> */
    public function tree(): Collection;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): AssetCategory;

    /** @param array<string, mixed> $attributes */
    public function update(AssetCategory $category, array $attributes): AssetCategory;

    public function delete(AssetCategory $category): void;

    public function hasDependents(AssetCategory $category): bool;
}
```

Create `app/Repositories/EloquentAssetCategoryRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class EloquentAssetCategoryRepository implements AssetCategoryRepositoryInterface
{
    public function tree(): Collection
    {
        return AssetCategory::query()
            ->whereNull('parent_id')
            ->withCount('assets')
            ->with(['children' => fn ($query) => $query->withCount('assets')])
            ->orderBy('name')
            ->get();
    }

    public function create(array $attributes): AssetCategory
    {
        return AssetCategory::create($attributes);
    }

    public function update(AssetCategory $category, array $attributes): AssetCategory
    {
        $category->update($attributes);

        return $category;
    }

    public function delete(AssetCategory $category): void
    {
        $category->delete();
    }

    public function hasDependents(AssetCategory $category): bool
    {
        return $category->children()->exists() || $category->assets()->exists();
    }
}
```

Create `app/Services/AssetCategoryService.php`:

```php
<?php

namespace App\Services;

use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use Illuminate\Validation\ValidationException;

class AssetCategoryService
{
    public function __construct(private readonly AssetCategoryRepositoryInterface $categories) {}

    /** @param array{name: string, parent_id?: int|null} $data */
    public function create(array $data): AssetCategory
    {
        return $this->categories->create($data);
    }

    /** @param array{name: string, parent_id?: int|null} $data */
    public function update(AssetCategory $category, array $data): AssetCategory
    {
        return $this->categories->update($category, $data);
    }

    public function delete(AssetCategory $category): void
    {
        if ($this->categories->hasDependents($category)) {
            throw ValidationException::withMessages([
                'category' => "Kategori \"{$category->name}\" masih dipakai (punya subkategori atau aset), tidak bisa dihapus.",
            ]);
        }

        $this->categories->delete($category);
    }
}
```

Create `app/Policies/AssetCategoryPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\AssetCategory;
use App\Models\User;

class AssetCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function update(User $user, AssetCategory $category): bool
    {
        return $user->hasRole('kasubag');
    }

    public function delete(User $user, AssetCategory $category): bool
    {
        return $user->hasRole('kasubag');
    }
}
```

Create `app/Http/Requests/AssetCategoryRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Models\AssetCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssetCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $category = $this->route('assetCategory');

        return $category instanceof AssetCategory
            ? $this->user()->can('update', $category)
            : $this->user()->can('create', AssetCategory::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $category = $this->route('assetCategory');
        $parentId = $this->input('parent_id');

        return [
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('asset_categories', 'name')
                    ->where(fn ($query) => $parentId === null
                        ? $query->whereNull('parent_id')
                        : $query->where('parent_id', $parentId))
                    ->ignore($category?->id),
            ],
            'parent_id' => [
                'nullable', 'integer',
                Rule::exists('asset_categories', 'id')->whereNull('parent_id'),
                Rule::notIn(array_filter([$category?->id])),
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $category = $this->route('assetCategory');

                if ($category instanceof AssetCategory && $this->input('parent_id') !== null && $category->children()->exists()) {
                    $validator->errors()->add('parent_id', 'Kategori yang punya subkategori tidak bisa dipindah menjadi subkategori.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama kategori wajib diisi.',
            'name.unique' => 'Nama ini sudah dipakai di level yang sama.',
            'parent_id.exists' => 'Induk harus kategori utama, bukan subkategori.',
            'parent_id.not_in' => 'Kategori tidak boleh menjadi induk dirinya sendiri.',
        ];
    }
}
```

In `app/Providers/AppServiceProvider.php` add the imports

```php
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Repositories\EloquentAssetCategoryRepository;
```

and add inside `register()`:

```php
        $this->app->bind(AssetCategoryRepositoryInterface::class, EloquentAssetCategoryRepository::class);
```

- [ ] **Step 5: Controller, routes, flash**

Create `app/Http/Controllers/AssetCategoryController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssetCategoryRequest;
use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Services\AssetCategoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AssetCategoryController extends Controller
{
    public function __construct(
        private readonly AssetCategoryService $service,
        private readonly AssetCategoryRepositoryInterface $categories,
    ) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', AssetCategory::class);

        return Inertia::render('AssetCategories/Index', [
            'categories' => $this->categories->tree(),
        ]);
    }

    public function store(AssetCategoryRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(AssetCategoryRequest $request, AssetCategory $assetCategory): RedirectResponse
    {
        $this->service->update($assetCategory, $request->validated());

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    public function destroy(AssetCategory $assetCategory): RedirectResponse
    {
        Gate::authorize('delete', $assetCategory);

        $this->service->delete($assetCategory);

        return back()->with('success', 'Kategori berhasil dihapus.');
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetCategoryController;` and, inside the existing `Route::middleware('auth')->group(...)`, add:

```php
    Route::get('/asset-categories', [AssetCategoryController::class, 'index'])->name('asset-categories.index');
    Route::post('/asset-categories', [AssetCategoryController::class, 'store'])->name('asset-categories.store');
    Route::put('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'update'])->name('asset-categories.update');
    Route::delete('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'destroy'])->name('asset-categories.destroy');
```

In `app/Http/Middleware/HandleInertiaRequests.php`, inside the array returned by `share()`, add after the `'auth'` entry:

```php
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
```

- [ ] **Step 6: Category seeder (client's real master data)**

Create `database/seeders/AssetCategorySeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    /** Kategori => Subkategori, taken from the client's DATA MASTER sheet (docs/PHOTO BARANG.xlsx). */
    private const CATEGORIES = [
        'ALAT ANGKUTAN DARAT BERMOTOR' => [
            'KENDARAAN BERMOTOR ANGKUTAN BARANG',
            'KENDARAAN BERMOTOR BERODA DUA',
            'KENDARAAN DINAS BERMOTOR PERORANGAN',
        ],
        'ALAT KANTOR' => ['ALAT KANTOR LAINNYA', 'ALAT PENYIMPAN PERLENGKAPAN KANTOR'],
        'ALAT RUMAH TANGGA' => ['ALAT DAPUR', 'ALAT PENDINGIN', 'ALAT RUMAH TANGGA LAINNYA (HOME USE)', 'MEUBELAIR'],
        'ALAT STUDIO' => ['PERALATAN STUDIO VIDEO DAN FILM'],
        'KOMPUTER UNIT' => ['PERSONAL KOMPUTER'],
        'MEJA DAN KURSI KERJA/RAPAT PEJABAT' => ['KURSI KERJA PEJABAT', 'LEMARI DAN ARSIP PEJABAT', 'MEJA KERJA PEJABAT'],
        'PERALATAN KOMPUTER' => ['PERALATAN PERSONAL KOMPUTER'],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $kategori => $subkategori) {
            $parent = AssetCategory::firstOrCreate(['name' => $kategori, 'parent_id' => null]);

            foreach ($subkategori as $name) {
                AssetCategory::firstOrCreate(['name' => $name, 'parent_id' => $parent->id]);
            }
        }
    }
}
```

In `database/seeders/DatabaseSeeder.php`, add `AssetCategorySeeder::class` to the always-run list:

```php
        $this->call([
            RoleSeeder::class,
            UnitSeeder::class,
            AssetCategorySeeder::class,
        ]);
```

- [ ] **Step 7: Run backend tests**

Run: `php artisan test tests/Feature/AssetCategoryManagementTest.php tests/Feature/DatabaseSeederTest.php`
Expected: FAIL only on `shows kasubag the category tree` with an Inertia "page component file does not exist" error (every other test passes). The page comes next.

- [ ] **Step 8: Frontend types, flash banner, navigation**

In `resources/js/types/index.d.ts` add:

```ts
export interface AssetCategory {
    id: number;
    name: string;
    parent_id: number | null;
    assets_count?: number;
    children?: AssetCategory[];
    parent?: AssetCategory | null;
}

export interface Flash {
    success: string | null;
    error: string | null;
}
```

and change the `PageProps` object type to include flash:

```ts
export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: AuthUser | null;
    };
    flash: Flash;
};
```

In `resources/js/Layouts/AuthenticatedLayout.tsx`, change `const { auth } = usePage<PageProps>().props;` to `const { auth, flash } = usePage<PageProps>().props;` and replace

```tsx
                <main className="flex-1 p-6">
                    {header && <div className="mb-6">{header}</div>}
```

with

```tsx
                <main className="flex-1 p-6">
                    {flash.success && (
                        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {flash.success}
                        </div>
                    )}
                    {flash.error && (
                        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {flash.error}
                        </div>
                    )}
                    {header && <div className="mb-6">{header}</div>}
```

In `resources/js/config/navigation.ts`, change kasubag's `Master Data Aset` item to:

```ts
        { label: 'Master Data Aset', href: '/asset-categories' },
```

- [ ] **Step 9: The page**

Create `resources/js/Pages/AssetCategories/Index.tsx`:

```tsx
import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

function CategoryRow({ category }: { category: AssetCategory }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({ name: category.name, parent_id: category.parent_id });

    const save = (e: FormEvent) => {
        e.preventDefault();
        form.put(route('asset-categories.update', category.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const remove = () => {
        if (confirm(`Hapus "${category.name}"?`)) {
            router.delete(route('asset-categories.destroy', category.id), { preserveScroll: true });
        }
    };

    if (editing) {
        return (
            <form onSubmit={save} className="flex items-start gap-2">
                <div className="flex-1">
                    <TextInput
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className="w-full"
                        isFocused
                    />
                    <InputError message={form.errors.name ?? form.errors.parent_id} className="mt-1" />
                </div>
                <PrimaryButton disabled={form.processing}>Simpan</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setEditing(false)}>
                    Batal
                </SecondaryButton>
            </form>
        );
    }

    return (
        <div className="flex items-center justify-between gap-2">
            <span>
                {category.name}{' '}
                <span className="text-xs text-gray-500">({category.assets_count ?? 0} aset)</span>
            </span>
            <span className="flex gap-2">
                <SecondaryButton type="button" onClick={() => setEditing(true)}>
                    Ubah
                </SecondaryButton>
                <DangerButton type="button" onClick={remove}>
                    Hapus
                </DangerButton>
            </span>
        </div>
    );
}

export default function Index({ categories }: PageProps<{ categories: AssetCategory[] }>) {
    const { errors } = usePage<PageProps<{ errors: Record<string, string> }>>().props;
    const form = useForm<{ name: string; parent_id: number | '' }>({ name: '', parent_id: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, parent_id: data.parent_id === '' ? null : data.parent_id }));
        form.post(route('asset-categories.store'), {
            preserveScroll: true,
            onSuccess: () => form.reset('name'),
        });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Master Kategori Aset</h1>}>
            <Head title="Kategori Aset" />

            {errors.category && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {errors.category}
                </div>
            )}

            <form onSubmit={submit} className="mb-6 flex flex-wrap items-start gap-2 rounded-lg bg-white p-4 shadow-sm">
                <div className="min-w-64 flex-1">
                    <TextInput
                        placeholder="Nama kategori / subkategori"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className="w-full"
                    />
                    <InputError message={form.errors.name} className="mt-1" />
                </div>
                <div>
                    <select
                        value={form.data.parent_id}
                        onChange={(e) => form.setData('parent_id', e.target.value === '' ? '' : Number(e.target.value))}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="">— Kategori utama —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                Subkategori dari: {c.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.parent_id} className="mt-1" />
                </div>
                <PrimaryButton disabled={form.processing}>Tambah</PrimaryButton>
            </form>

            <div className="space-y-4">
                {categories.length === 0 && <p className="text-sm text-gray-500">Belum ada kategori.</p>}
                {categories.map((category) => (
                    <div key={category.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="font-semibold">
                            <CategoryRow category={category} />
                        </div>
                        <ul className="mt-3 space-y-2 border-l border-gray-200 pl-4 text-sm">
                            {(category.children ?? []).map((child) => (
                                <li key={child.id}>
                                    <CategoryRow category={child} />
                                </li>
                            ))}
                            {(category.children ?? []).length === 0 && (
                                <li className="text-gray-400">Belum ada subkategori.</li>
                            )}
                        </ul>
                    </div>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 10: Run tests and type-check**

```bash
php artisan test tests/Feature/AssetCategoryManagementTest.php tests/Feature/DatabaseSeederTest.php
npm run build
```

Expected: PASS (all tests); build exits 0 with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add app routes database resources/js tests
git commit -m "feat: kasubag category management with client category seeder"
```

---

### Task 6: Browse assets — index with filters and detail page

**Files:**
- Create: `app/Repositories/Contracts/UnitRepositoryInterface.php`, `app/Repositories/EloquentUnitRepository.php`
- Create: `app/Policies/AssetPolicy.php`
- Create: `app/Http/Controllers/AssetController.php` (index, show)
- Create: `resources/js/lib/format.ts`
- Create: `resources/js/Pages/Assets/Index.tsx`, `resources/js/Pages/Assets/Show.tsx`
- Modify: `app/Providers/AppServiceProvider.php`, `routes/web.php`, `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts`
- Test: `tests/Feature/AssetBrowseTest.php`

**Interfaces:**
- Consumes: `AssetRepositoryInterface::paginateVisibleTo` (Task 4), `AssetCategoryRepositoryInterface::tree` (Task 5), `User::accessibleUnitIds` (Task 3), `Kondisi::options` (Task 2).
- Produces:
  - `UnitRepositoryInterface::accessibleBy(User $user): Collection` (units ordered type, name; columns id, name, type).
  - `AssetPolicy`: `viewAny` (kasubag, camat, admin_kecamatan, admin_kelurahan, lurah), `view` (viewAny + `canAccessUnit($asset->unit)`), `create` (admin_kecamatan/admin_kelurahan with a unit), `update` (admin_kecamatan/admin_kelurahan whose `unit_id` equals the asset's).
  - Routes: `GET /assets` `assets.index`, `GET /assets/{asset}` `assets.show` (registered via `Route::resource('assets', AssetController::class)->only(['index', 'show'])` — Task 7 widens `only`).
  - Page props — Index: `assets` (paginator), `filters`, `categories` (tree), `units`, `kondisiOptions`, `can.create`. Show: `asset` (with `category.parent`, `unit`, `current_holder`, `photos`, `histories.user`, `histories.unit`), `kondisiOptions`, `can.update`.
  - TS types `Asset`, `AssetPhoto`, `AssetHistory`, `UnitSummary`, `Option`, `Paginated<T>`; helpers `formatRupiah`, `formatDate`, `kondisiLabel` in `resources/js/lib/format.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetBrowseTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $this->pendingin = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $this->kategori->id]);
    $this->kantor = AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => AssetCategory::create(['name' => 'ALAT KANTOR'])->id]);

    $this->acKec = Asset::factory()->create(['nama_aset' => 'A.C. Split', 'unit_id' => $this->kec->id, 'category_id' => $this->pendingin->id]);
    $this->acKel = Asset::factory()->create(['nama_aset' => 'A.C. Split', 'unit_id' => $this->kelA->id, 'category_id' => $this->pendingin->id, 'no_dokumen' => 'M#GW04A268636-378-2023-0001']);
    $this->papan = Asset::factory()->create(['nama_aset' => 'Papan Pengumuman', 'kode_barang' => '1.3.2.05.01.05.077', 'unit_id' => $this->kelA->id, 'category_id' => $this->kantor->id, 'kondisi' => 'rusak_berat']);
    $this->other = Asset::factory()->create(['nama_aset' => 'Sedan', 'unit_id' => $this->otherKec->id, 'category_id' => $this->kantor->id]);
});

it('lists only in-scope assets for camat', function () {
    $this->actingAs(userWithRole('camat', $this->kec))
        ->get('/assets')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Index')
            ->has('assets.data', 3)
            ->has('kondisiOptions', 4)
            ->has('units', 2)
            ->where('can.create', false));
});

it('lists only its own kelurahan assets for admin_kelurahan', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get('/assets')
        ->assertInertia(fn (Assert $page) => $page
            ->has('assets.data', 2)
            ->has('units', 1)
            ->where('can.create', true));
});

it('forbids pegawai from browsing assets', function () {
    $this->actingAs(userWithRole('pegawai', $this->kec))->get('/assets')->assertForbidden();
});

it('searches by name, kode_barang and no_dokumen', function (string $term, int $expected) {
    $this->actingAs(userWithRole('kasubag'))
        ->get('/assets?search='.urlencode($term))
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', $expected));
})->with([
    ['papan', 1],
    ['1.3.2.05.01.05', 1],
    ['GW04A268636', 1],
    ['tidak-ada', 0],
]);

it('filters by kategori including its subkategori, and by kondisi', function () {
    $user = userWithRole('kasubag');

    $this->actingAs($user)->get("/assets?category_id={$this->kategori->id}")
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 2));
    $this->actingAs($user)->get('/assets?kondisi=rusak_berat')
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 1)->where('assets.data.0.id', $this->papan->id));
});

it('cannot widen scope with a unit filter', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get("/assets?unit_id={$this->otherKec->id}")
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 0));
});

it('shows an in-scope asset with its relations', function () {
    $this->acKel->histories()->create(['event' => 'dibuat', 'unit_id' => $this->kelA->id, 'kondisi' => 'baik']);

    $this->actingAs(userWithRole('lurah', $this->kelA))
        ->get("/assets/{$this->acKel->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Show')
            ->where('asset.id', $this->acKel->id)
            ->where('asset.unit.name', 'Kelurahan Tembesi')
            ->where('asset.category.parent.name', 'ALAT RUMAH TANGGA')
            ->has('asset.histories', 1)
            ->where('can.update', false));
});

it('returns 403 for an out-of-scope asset opened by URL', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get("/assets/{$this->acKec->id}")
        ->assertForbidden();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetBrowseTest.php`
Expected: FAIL — `/assets` 404.

- [ ] **Step 3: Unit repository, policy**

Create `app/Repositories/Contracts/UnitRepositoryInterface.php`:

```php
<?php

namespace App\Repositories\Contracts;

use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

interface UnitRepositoryInterface
{
    /** @return Collection<int, Unit> */
    public function accessibleBy(User $user): Collection;
}
```

Create `app/Repositories/EloquentUnitRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Models\Unit;
use App\Models\User;
use App\Repositories\Contracts\UnitRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class EloquentUnitRepository implements UnitRepositoryInterface
{
    public function accessibleBy(User $user): Collection
    {
        $ids = $user->accessibleUnitIds();

        return Unit::query()
            ->when($ids !== null, fn ($query) => $query->whereIn('id', $ids))
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'name', 'type']);
    }
}
```

In `app/Providers/AppServiceProvider.php` add imports `App\Repositories\Contracts\UnitRepositoryInterface` and `App\Repositories\EloquentUnitRepository`, and in `register()`:

```php
        $this->app->bind(UnitRepositoryInterface::class, EloquentUnitRepository::class);
```

Create `app/Policies/AssetPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

class AssetPolicy
{
    private const VIEWERS = ['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'];

    private const EDITORS = ['admin_kecamatan', 'admin_kelurahan'];

    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(self::VIEWERS);
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->hasAnyRole(self::VIEWERS) && $user->canAccessUnit($asset->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(self::EDITORS) && $user->unit_id !== null;
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->hasAnyRole(self::EDITORS) && $user->unit_id === $asset->unit_id;
    }
}
```

- [ ] **Step 4: Controller and routes**

Create `app/Http/Controllers/AssetController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Models\Asset;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Repositories\Contracts\UnitRepositoryInterface;
use App\Services\AssetService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AssetController extends Controller
{
    public function __construct(
        private readonly AssetService $service,
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetCategoryRepositoryInterface $categories,
        private readonly UnitRepositoryInterface $units,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Asset::class);

        $filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi']);

        return Inertia::render('Assets/Index', [
            'assets' => $this->assets->paginateVisibleTo($request->user(), $filters),
            'filters' => $filters,
            'categories' => $this->categories->tree(),
            'units' => $this->units->accessibleBy($request->user()),
            'kondisiOptions' => Kondisi::options(),
            'can' => ['create' => $request->user()->can('create', Asset::class)],
        ]);
    }

    public function show(Request $request, Asset $asset): Response
    {
        Gate::authorize('view', $asset);

        $asset->load(['category.parent', 'unit', 'currentHolder', 'photos', 'histories.user', 'histories.unit']);

        return Inertia::render('Assets/Show', [
            'asset' => $asset,
            'kondisiOptions' => Kondisi::options(),
            'can' => ['update' => $request->user()->can('update', $asset)],
        ]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetController;` and inside the `auth` group:

```php
    Route::resource('assets', AssetController::class)->only(['index', 'show']);
```

- [ ] **Step 5: Run backend test**

Run: `php artisan test tests/Feature/AssetBrowseTest.php`
Expected: the 403 tests and the pegawai test PASS; tests asserting `component('Assets/Index')` / `component('Assets/Show')` FAIL with "page component file does not exist". Pages come next.

- [ ] **Step 6: Frontend types and helpers**

Append to `resources/js/types/index.d.ts`:

```ts
export interface Option {
    value: string;
    label: string;
}

export interface UnitSummary {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

export interface AssetPhoto {
    id: number;
    path: string;
    url: string;
}

export interface AssetHistory {
    id: number;
    event: string;
    kondisi: string;
    keterangan: string | null;
    created_at: string;
    unit?: UnitSummary;
    user?: { id: number; name: string } | null;
}

export interface Asset {
    id: number;
    kode_barang: string;
    nomor_register: number;
    nama_aset: string;
    category_id: number;
    unit_id: number;
    current_holder_id: number | null;
    merk_type: string | null;
    kondisi: string;
    status: string;
    tanggal_perolehan: string;
    sumber_perolehan: string | null;
    nilai_perolehan: string;
    nilai_buku: string;
    no_dokumen: string | null;
    keterangan: string | null;
    category?: AssetCategory;
    unit?: UnitSummary;
    current_holder?: { id: number; name: string } | null;
    photos?: AssetPhoto[];
    histories?: AssetHistory[];
}

export interface Paginated<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
}
```

Create `resources/js/lib/format.ts`:

```ts
import { Option } from '@/types';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatRupiah(value: string | number): string {
    return rupiah.format(Number(value));
}

export function formatDate(value: string): string {
    return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function kondisiLabel(options: Option[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
}

export function registerLabel(nomor: number): string {
    return String(nomor).padStart(4, '0');
}
```

In `resources/js/config/navigation.ts`, set the asset items to point at `/assets` (remove `disabled`) and give kasubag, camat and lurah a `Data Aset` entry:

```ts
const DASHBOARD: NavItem = { label: 'Dashboard', href: '/dashboard' };
const DATA_ASET: NavItem = { label: 'Data Aset', href: '/assets' };

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
    kasubag: [
        DASHBOARD,
        DATA_ASET,
        { label: 'Kelola User', href: '#', disabled: true },
        { label: 'Master Data Aset', href: '/asset-categories' },
    ],
    camat: [
        DASHBOARD,
        DATA_ASET,
        { label: 'Approval Penerimaan Aset', href: '#', disabled: true },
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kecamatan: [
        DASHBOARD,
        DATA_ASET,
        { label: 'Penerimaan Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kelurahan: [
        DASHBOARD,
        DATA_ASET,
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    lurah: [
        DASHBOARD,
        DATA_ASET,
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    pegawai: [
        DASHBOARD,
        { label: 'Ajukan Aset', href: '#', disabled: true },
        { label: 'Lapor Aset Rusak/Hilang', href: '#', disabled: true },
    ],
};
```

- [ ] **Step 7: Index page**

Create `resources/js/Pages/Assets/Index.tsx`:

```tsx
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah, kondisiLabel, registerLabel } from '@/lib/format';
import { Asset, AssetCategory, Option, PageProps, Paginated, UnitSummary } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Filters = { search?: string; category_id?: string; unit_id?: string; kondisi?: string };

type Props = PageProps<{
    assets: Paginated<Asset>;
    filters: Filters;
    categories: AssetCategory[];
    units: UnitSummary[];
    kondisiOptions: Option[];
    can: { create: boolean };
}>;

export default function Index({ assets, filters, categories, units, kondisiOptions, can }: Props) {
    const [values, setValues] = useState<Filters>(filters);

    const apply = (e: FormEvent) => {
        e.preventDefault();
        const query = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('assets.index'), query, { preserveState: true, preserveScroll: true });
    };

    const reset = () => {
        setValues({});
        router.get(route('assets.index'));
    };

    const selectClass = 'rounded-md border-gray-300 text-sm shadow-sm';

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Data Aset</h1>}>
            <Head title="Data Aset" />

            <form onSubmit={apply} className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 shadow-sm">
                <TextInput
                    placeholder="Cari nama, kode barang, no. dokumen"
                    value={values.search ?? ''}
                    onChange={(e) => setValues({ ...values, search: e.target.value })}
                    className="min-w-64 flex-1"
                />
                <select
                    className={selectClass}
                    value={values.category_id ?? ''}
                    onChange={(e) => setValues({ ...values, category_id: e.target.value })}
                >
                    <option value="">Semua kategori</option>
                    {categories.map((c) => (
                        <optgroup key={c.id} label={c.name}>
                            <option value={c.id}>Semua {c.name}</option>
                            {(c.children ?? []).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {units.length > 1 && (
                    <select
                        className={selectClass}
                        value={values.unit_id ?? ''}
                        onChange={(e) => setValues({ ...values, unit_id: e.target.value })}
                    >
                        <option value="">Semua unit</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                )}
                <select
                    className={selectClass}
                    value={values.kondisi ?? ''}
                    onChange={(e) => setValues({ ...values, kondisi: e.target.value })}
                >
                    <option value="">Semua kondisi</option>
                    {kondisiOptions.map((k) => (
                        <option key={k.value} value={k.value}>
                            {k.label}
                        </option>
                    ))}
                </select>
                <PrimaryButton>Terapkan</PrimaryButton>
                <SecondaryButton type="button" onClick={reset}>
                    Reset
                </SecondaryButton>
            </form>

            <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                        <tr>
                            <th className="px-4 py-3">Kode / Register</th>
                            <th className="px-4 py-3">Nama Aset</th>
                            <th className="px-4 py-3">Kategori</th>
                            <th className="px-4 py-3">Unit</th>
                            <th className="px-4 py-3">Kondisi</th>
                            <th className="px-4 py-3 text-right">Nilai Buku</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {assets.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                                    Tidak ada aset yang cocok.
                                </td>
                            </tr>
                        )}
                        {assets.data.map((a) => (
                            <tr key={a.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs">
                                    {a.kode_barang} / {registerLabel(a.nomor_register)}
                                </td>
                                <td className="px-4 py-3">
                                    <Link href={route('assets.show', a.id)} className="font-medium text-blue-700 hover:underline">
                                        {a.nama_aset}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">{a.category?.name}</td>
                                <td className="px-4 py-3">{a.unit?.name}</td>
                                <td className="px-4 py-3">{kondisiLabel(kondisiOptions, a.kondisi)}</td>
                                <td className="px-4 py-3 text-right">{formatRupiah(a.nilai_buku)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <span>
                    {assets.total > 0 ? `Menampilkan ${assets.from}–${assets.to} dari ${assets.total} aset` : ''}
                </span>
                <span className="flex flex-wrap gap-1">
                    {assets.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveScroll
                                className={`rounded px-3 py-1 ${link.active ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ) : (
                            <span key={i} className="px-3 py-1 text-gray-400" dangerouslySetInnerHTML={{ __html: link.label }} />
                        ),
                    )}
                </span>
            </div>
        </AuthenticatedLayout>
    );
}
```

(`link.label` comes from Laravel's paginator — `&laquo; Previous` etc. — so `dangerouslySetInnerHTML` renders those entities; it never contains user input.)

- [ ] **Step 8: Show page**

Create `resources/js/Pages/Assets/Show.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatRupiah, kondisiLabel, registerLabel } from '@/lib/format';
import { Asset, Option, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ReactNode } from 'react';

type Props = PageProps<{ asset: Asset; kondisiOptions: Option[]; can: { update: boolean } }>;

const EVENT_LABELS: Record<string, string> = { dibuat: 'Aset dicatat' };

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs uppercase text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-sm text-gray-900">{children || '—'}</dd>
        </div>
    );
}

export default function Show({ asset, kondisiOptions }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <Link href={route('assets.index')} className="text-sm text-blue-700 hover:underline">
                            ← Data Aset
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-800">{asset.nama_aset}</h1>
                        <p className="font-mono text-xs text-gray-500">
                            {asset.kode_barang} / {registerLabel(asset.nomor_register)}
                        </p>
                    </div>
                </div>
            }
        >
            <Head title={asset.nama_aset} />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <dl className="grid grid-cols-2 gap-4 rounded-lg bg-white p-6 shadow-sm">
                        <Field label="Kategori">
                            {asset.category?.parent?.name} › {asset.category?.name}
                        </Field>
                        <Field label="Unit / Lokasi">{asset.unit?.name}</Field>
                        <Field label="Merk / Tipe">{asset.merk_type}</Field>
                        <Field label="Kondisi">{kondisiLabel(kondisiOptions, asset.kondisi)}</Field>
                        <Field label="Tanggal Perolehan">{formatDate(asset.tanggal_perolehan)}</Field>
                        <Field label="Sumber Perolehan">{asset.sumber_perolehan}</Field>
                        <Field label="Nilai Perolehan">{formatRupiah(asset.nilai_perolehan)}</Field>
                        <Field label="Nilai Buku">{formatRupiah(asset.nilai_buku)}</Field>
                        <Field label="No. Dokumen">{asset.no_dokumen}</Field>
                        <Field label="Pemegang">{asset.current_holder?.name}</Field>
                        <div className="col-span-2">
                            <Field label="Keterangan">{asset.keterangan}</Field>
                        </div>
                    </dl>

                    <section className="rounded-lg bg-white p-6 shadow-sm">
                        <h2 className="mb-3 font-semibold text-gray-800">Foto</h2>
                        {(asset.photos ?? []).length === 0 ? (
                            <p className="text-sm text-gray-500">Belum ada foto.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {asset.photos!.map((photo) => (
                                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                                        <img src={photo.url} alt={asset.nama_aset} className="h-40 w-full rounded object-cover" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <section className="rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="mb-3 font-semibold text-gray-800">Riwayat</h2>
                    <ol className="space-y-3 text-sm">
                        {(asset.histories ?? []).map((h) => (
                            <li key={h.id} className="border-l-2 border-blue-200 pl-3">
                                <div className="font-medium">{EVENT_LABELS[h.event] ?? h.event}</div>
                                <div className="text-gray-600">
                                    {h.unit?.name} · {kondisiLabel(kondisiOptions, h.kondisi)}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {formatDate(h.created_at)}
                                    {h.user ? ` · ${h.user.name}` : ''}
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 9: Run tests and type-check**

```bash
php artisan test tests/Feature/AssetBrowseTest.php
npm run build
```

Expected: PASS (all tests); build exits 0.

- [ ] **Step 10: Commit**

```bash
git add app routes resources/js tests/Feature/AssetBrowseTest.php
git commit -m "feat: scoped asset list with filters and asset detail page"
```

---

### Task 7: Record and edit assets — forms, photo upload and removal

**Files:**
- Create: `app/Http/Requests/StoreAssetRequest.php`, `app/Http/Requests/UpdateAssetRequest.php`
- Create: `app/Http/Controllers/AssetPhotoController.php`
- Create: `resources/js/Pages/Assets/Partials/AssetForm.tsx`, `resources/js/Pages/Assets/Create.tsx`, `resources/js/Pages/Assets/Edit.tsx`
- Modify: `app/Http/Controllers/AssetController.php` (create, store, edit, update), `routes/web.php`, `resources/js/Pages/Assets/Index.tsx` (add button), `resources/js/Pages/Assets/Show.tsx` (edit button, photo delete)
- Test: `tests/Feature/AssetManageTest.php`

**Interfaces:**
- Consumes: `AssetService::create/update/deletePhoto` + `DESCRIPTIVE_FIELDS` (Task 4), `AssetPolicy` (Task 6), category tree (Task 5).
- Produces:
  - `StoreAssetRequest::MAX_PHOTOS = 10`; validation of descriptive fields, `kondisi` (create only), `photos` / `photos.*`.
  - Routes: `GET /assets/create` `assets.create`, `POST /assets` `assets.store`, `GET /assets/{asset}/edit` `assets.edit`, `PUT /assets/{asset}` `assets.update` (resource `only` becomes `['index', 'create', 'store', 'show', 'edit', 'update']`), `DELETE /assets/{asset}/photos/{photo}` `assets.photos.destroy` (scoped binding).
  - Page props — Create: `categories`, `kondisiOptions`, `maxPhotos`. Edit: `asset` (with `photos`), `categories`, `maxPhotos`.

- [ ] **Step 1: Link public storage**

```bash
php artisan storage:link
```

Expected: `The [public/storage] link has been connected to [storage/app/public].` (already-exists message is fine). `public/storage` is git-ignored; deployment needs the same command (noted in Task 9).

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/AssetManageTest.php`:

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $this->sub = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $this->kategori->id]);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);

    $this->payload = fn (array $overrides = []) => array_merge([
        'kode_barang' => '1.3.2.05.02.04.004',
        'nama_aset' => 'A.C. Split',
        'category_id' => $this->sub->id,
        'merk_type' => 'PANASONIC',
        'kondisi' => 'baik',
        'tanggal_perolehan' => '2023-06-14',
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 1250000,
        'no_dokumen' => 'M#GW04A268636-378-2023-0001',
    ], $overrides);
});

function jpg(string $name = 'foto.jpg', int $kb = 200): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, 'image/jpeg');
}

it('shows the create form to an admin', function () {
    $this->actingAs($this->adminKel)->get('/assets/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Create')
            ->has('categories', 1)
            ->has('kondisiOptions', 4)
            ->where('maxPhotos', 10));
});

it('records an asset with photos in the admin unit', function () {
    $response = $this->actingAs($this->adminKel)->post('/assets', [
        ...($this->payload)(),
        'photos' => [jpg('depan.jpg'), jpg('belakang.jpg')],
    ]);

    $asset = Asset::firstOrFail();

    $response->assertRedirect("/assets/{$asset->id}")->assertSessionHas('success');
    expect($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->nomor_register)->toBe(1)
        ->and($asset->photos)->toHaveCount(2)
        ->and($asset->histories()->count())->toBe(1);
});

it('ignores unit, status and holder fields tampered into the request', function () {
    $this->actingAs($this->adminKel)->post('/assets', [
        ...($this->payload)(),
        'unit_id' => $this->kec->id,
        'status' => 'dalam_proses',
        'current_holder_id' => $this->adminKel->id,
    ])->assertSessionHasNoErrors();

    $asset = Asset::firstOrFail();

    expect($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->current_holder_id)->toBeNull();
});

it('forbids non-admin roles from recording assets', function (string $role) {
    $user = userWithRole($role, $role === 'kasubag' ? null : $this->kec);

    $this->actingAs($user)->get('/assets/create')->assertForbidden();
    $this->actingAs($user)->post('/assets', ($this->payload)())->assertForbidden();
    expect(Asset::count())->toBe(0);
})->with(['kasubag', 'camat', 'lurah', 'pegawai']);

it('validates asset fields', function (array $overrides, string $field) {
    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)($overrides))
        ->assertSessionHasErrors($field);
    expect(Asset::count())->toBe(0);
})->with([
    'top-level kategori' => [['category_id' => 'KATEGORI'], 'category_id'],
    'bad kode_barang' => [['kode_barang' => 'AC-001'], 'kode_barang'],
    'nilai_buku above perolehan' => [['nilai_buku' => 6000000], 'nilai_buku'],
    'future tanggal' => [['tanggal_perolehan' => '2999-01-01'], 'tanggal_perolehan'],
    'unknown kondisi' => [['kondisi' => 'lumayan'], 'kondisi'],
    'missing nama' => [['nama_aset' => ''], 'nama_aset'],
]);

it('rejects a top-level kategori id', function () {
    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)(['category_id' => $this->kategori->id]))
        ->assertSessionHasErrors('category_id');
});

it('rejects a duplicate no_dokumen', function () {
    Asset::factory()->create(['no_dokumen' => 'M#GW04A268636-378-2023-0001', 'category_id' => $this->sub->id, 'unit_id' => $this->kel->id]);

    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)())
        ->assertSessionHasErrors('no_dokumen');
});

it('rejects non-images, oversized photos and more than 10 photos', function () {
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => [UploadedFile::fake()->create('scan.pdf', 100, 'application/pdf')]])
        ->assertSessionHasErrors('photos.0');
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => [jpg('besar.jpg', 6000)]])
        ->assertSessionHasErrors('photos.0');
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => array_map(fn ($i) => jpg("f{$i}.jpg", 10), range(1, 11))])
        ->assertSessionHasErrors('photos');

    expect(Asset::count())->toBe(0);
});

it('edits descriptive fields and ignores kondisi and unit', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id, 'kondisi' => 'baik']);

    $this->actingAs($this->adminKel)->get("/assets/{$asset->id}/edit")
        ->assertInertia(fn (Assert $page) => $page->component('Assets/Edit')->where('asset.id', $asset->id));

    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", [
        ...($this->payload)(['nama_aset' => 'AC Split 1 PK', 'no_dokumen' => null]),
        'kondisi' => 'hilang',
        'unit_id' => $this->kec->id,
        'photos' => [jpg()],
    ])->assertRedirect("/assets/{$asset->id}");

    $asset->refresh();
    expect($asset->nama_aset)->toBe('AC Split 1 PK')
        ->and($asset->kondisi)->toBe(Kondisi::Baik)
        ->and($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->photos()->count())->toBe(1);
});

it('keeps an asset under 10 photos across edits', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    foreach (range(1, 9) as $i) {
        $asset->photos()->create(['path' => "assets/{$asset->id}/{$i}.jpg"]);
    }

    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", [...($this->payload)(['no_dokumen' => null]), 'photos' => [jpg('a.jpg'), jpg('b.jpg')]])
        ->assertSessionHasErrors('photos');

    expect($asset->photos()->count())->toBe(9);
});

it('forbids editing an asset of another unit', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);

    $this->actingAs($this->adminKel)->get("/assets/{$asset->id}/edit")->assertForbidden();
    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", ($this->payload)(['no_dokumen' => null]))->assertForbidden();
});

it('deletes a photo only through its own asset', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    $other = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    Storage::disk('public')->put("assets/{$asset->id}/a.jpg", 'x');
    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    $this->actingAs($this->adminKel)->delete("/assets/{$other->id}/photos/{$photo->id}")->assertNotFound();

    $this->actingAs($this->adminKel)->delete("/assets/{$asset->id}/photos/{$photo->id}")->assertSessionHas('success');

    Storage::disk('public')->assertMissing("assets/{$asset->id}/a.jpg");
    expect($asset->photos()->count())->toBe(0);
});

it('forbids deleting a photo of another unit asset', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);
    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    $this->actingAs($this->adminKel)->delete("/assets/{$asset->id}/photos/{$photo->id}")->assertForbidden();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetManageTest.php`
Expected: FAIL — `/assets/create` resolves to the `show` route with a non-numeric id (404) and `POST /assets` returns 405.

- [ ] **Step 4: Form requests**

Create `app/Http/Requests/StoreAssetRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\Kondisi;
use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetRequest extends FormRequest
{
    public const MAX_PHOTOS = 10;

    public function authorize(): bool
    {
        return $this->user()->can('create', Asset::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...$this->descriptiveRules(),
            'kondisi' => ['required', Rule::enum(Kondisi::class)],
            ...$this->photoRules(),
        ];
    }

    /** @return array<string, mixed> */
    protected function descriptiveRules(): array
    {
        $asset = $this->route('asset');

        return [
            'kode_barang' => ['required', 'string', 'max:50', 'regex:/^\d+(\.\d+)+$/'],
            'nama_aset' => ['required', 'string', 'max:255'],
            'category_id' => ['required', 'integer', Rule::exists('asset_categories', 'id')->whereNotNull('parent_id')],
            'merk_type' => ['nullable', 'string', 'max:100'],
            'tanggal_perolehan' => ['required', 'date', 'before_or_equal:today'],
            'sumber_perolehan' => ['nullable', 'string', 'max:100'],
            'nilai_perolehan' => ['required', 'numeric', 'min:0', 'max:9999999999999'],
            'nilai_buku' => ['required', 'numeric', 'min:0', 'lte:nilai_perolehan'],
            'no_dokumen' => ['nullable', 'string', 'max:100', Rule::unique('assets', 'no_dokumen')->ignore($asset?->id)],
            'keterangan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, mixed> */
    protected function photoRules(): array
    {
        return [
            'photos' => ['nullable', 'array', 'max:'.self::MAX_PHOTOS],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kode_barang.regex' => 'Format kode barang harus angka dipisah titik, mis. 1.3.2.05.02.04.004.',
            'category_id.exists' => 'Pilih subkategori, bukan kategori utama.',
            'nilai_buku.lte' => 'Nilai buku tidak boleh melebihi nilai perolehan.',
            'tanggal_perolehan.before_or_equal' => 'Tanggal perolehan tidak boleh di masa depan.',
            'no_dokumen.unique' => 'No. dokumen ini sudah dipakai aset lain.',
            'photos.max' => 'Maksimal '.self::MAX_PHOTOS.' foto.',
            'photos.*.image' => 'File harus berupa gambar.',
            'photos.*.mimes' => 'Foto harus JPG, PNG, atau WEBP.',
            'photos.*.max' => 'Ukuran foto maksimal 5 MB.',
        ];
    }
}
```

Create `app/Http/Requests/UpdateAssetRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Validation\Validator;

class UpdateAssetRequest extends StoreAssetRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('asset'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [...$this->descriptiveRules(), ...$this->photoRules()];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $existing = $this->route('asset')->photos()->count();
                $incoming = count($this->file('photos', []));

                if ($existing + $incoming > self::MAX_PHOTOS) {
                    $validator->errors()->add('photos', 'Maksimal '.self::MAX_PHOTOS." foto per aset (sudah ada {$existing}).");
                }
            },
        ];
    }
}
```

- [ ] **Step 5: Controller actions, photo controller, routes**

In `app/Http/Controllers/AssetController.php` add the imports

```php
use App\Http\Requests\StoreAssetRequest;
use App\Http\Requests\UpdateAssetRequest;
use Illuminate\Http\RedirectResponse;
```

and add these methods to the class:

```php
    public function create(): Response
    {
        Gate::authorize('create', Asset::class);

        return Inertia::render('Assets/Create', [
            'categories' => $this->categories->tree(),
            'kondisiOptions' => Kondisi::options(),
            'maxPhotos' => StoreAssetRequest::MAX_PHOTOS,
        ]);
    }

    public function store(StoreAssetRequest $request): RedirectResponse
    {
        $asset = $this->service->create(
            $request->safe()->except('photos'),
            $request->file('photos', []),
            $request->user(),
        );

        return redirect()->route('assets.show', $asset)->with('success', 'Aset berhasil dicatat.');
    }

    public function edit(Asset $asset): Response
    {
        Gate::authorize('update', $asset);

        return Inertia::render('Assets/Edit', [
            'asset' => $asset->load('photos'),
            'categories' => $this->categories->tree(),
            'maxPhotos' => StoreAssetRequest::MAX_PHOTOS,
        ]);
    }

    public function update(UpdateAssetRequest $request, Asset $asset): RedirectResponse
    {
        $this->service->update($asset, $request->safe()->except('photos'), $request->file('photos', []));

        return redirect()->route('assets.show', $asset)->with('success', 'Aset berhasil diperbarui.');
    }
```

Create `app/Http/Controllers/AssetPhotoController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Services\AssetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class AssetPhotoController extends Controller
{
    public function __construct(private readonly AssetService $service) {}

    public function destroy(Asset $asset, AssetPhoto $photo): RedirectResponse
    {
        Gate::authorize('update', $asset);

        $this->service->deletePhoto($photo);

        return back()->with('success', 'Foto dihapus.');
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetPhotoController;`, replace the assets resource line with:

```php
    Route::resource('assets', AssetController::class)->only(['index', 'create', 'store', 'show', 'edit', 'update']);
    Route::delete('/assets/{asset}/photos/{photo}', [AssetPhotoController::class, 'destroy'])
        ->scopeBindings()
        ->name('assets.photos.destroy');
```

(`scopeBindings()` resolves `{photo}` through `$asset->photos()`, so a photo id belonging to another asset returns 404 before the controller runs.)

- [ ] **Step 6: Run backend test**

Run: `php artisan test tests/Feature/AssetManageTest.php`
Expected: only the tests asserting `component('Assets/Create')` / `component('Assets/Edit')` FAIL (page file missing); everything else PASSES.

- [ ] **Step 7: Shared form component**

Create `resources/js/Pages/Assets/Partials/AssetForm.tsx`:

```tsx
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { AssetCategory, Option } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { FormEvent, ReactNode } from 'react';

export type AssetFormData = {
    kode_barang: string;
    nama_aset: string;
    category_id: number | '';
    merk_type: string;
    kondisi?: string;
    tanggal_perolehan: string;
    sumber_perolehan: string;
    nilai_perolehan: string;
    nilai_buku: string;
    no_dokumen: string;
    keterangan: string;
    photos: File[];
};

type Props = {
    form: InertiaFormProps<AssetFormData>;
    categories: AssetCategory[];
    kondisiOptions?: Option[];
    maxPhotos: number;
    existingPhotoCount?: number;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    children?: ReactNode;
};

const inputClass = 'mt-1 block w-full';
const selectClass = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500';

export default function AssetForm({
    form,
    categories,
    kondisiOptions,
    maxPhotos,
    existingPhotoCount = 0,
    submitLabel,
    onSubmit,
    children,
}: Props) {
    const { data, setData, errors, processing } = form;
    const photoError = errors.photos ?? Object.entries(errors).find(([k]) => k.startsWith('photos.'))?.[1];

    const text = (field: keyof AssetFormData, label: string, props: Record<string, unknown> = {}) => (
        <div>
            <InputLabel htmlFor={field} value={label} />
            <TextInput
                id={field}
                className={inputClass}
                value={data[field] as string}
                onChange={(e) => setData(field, e.target.value as never)}
                {...props}
            />
            <InputError message={errors[field]} className="mt-1" />
        </div>
    );

    return (
        <form onSubmit={onSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
                {text('kode_barang', 'Kode Barang (KIB)', { placeholder: '1.3.2.05.02.04.004' })}
                {text('nama_aset', 'Nama Aset')}
                <div>
                    <InputLabel htmlFor="category_id" value="Kategori / Subkategori" />
                    <select
                        id="category_id"
                        className={selectClass}
                        value={data.category_id}
                        onChange={(e) => setData('category_id', e.target.value === '' ? '' : Number(e.target.value))}
                    >
                        <option value="">— Pilih subkategori —</option>
                        {categories.map((c) => (
                            <optgroup key={c.id} label={c.name}>
                                {(c.children ?? []).map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <InputError message={errors.category_id} className="mt-1" />
                </div>
                {text('merk_type', 'Merk / Tipe')}
                {kondisiOptions && (
                    <div>
                        <InputLabel htmlFor="kondisi" value="Kondisi Awal" />
                        <select
                            id="kondisi"
                            className={selectClass}
                            value={data.kondisi}
                            onChange={(e) => setData('kondisi', e.target.value)}
                        >
                            {kondisiOptions.map((k) => (
                                <option key={k.value} value={k.value}>
                                    {k.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.kondisi} className="mt-1" />
                    </div>
                )}
                {text('tanggal_perolehan', 'Tanggal Perolehan', { type: 'date' })}
                {text('sumber_perolehan', 'Sumber Perolehan')}
                {text('nilai_perolehan', 'Nilai Perolehan (Rp)', { type: 'number', min: 0, step: '0.01' })}
                {text('nilai_buku', 'Nilai Buku (Rp)', { type: 'number', min: 0, step: '0.01' })}
                {text('no_dokumen', 'No. Dokumen')}
            </div>

            <div>
                <InputLabel htmlFor="keterangan" value="Keterangan" />
                <textarea
                    id="keterangan"
                    rows={3}
                    className={selectClass}
                    value={data.keterangan}
                    onChange={(e) => setData('keterangan', e.target.value)}
                />
                <InputError message={errors.keterangan} className="mt-1" />
            </div>

            <div>
                <InputLabel
                    htmlFor="photos"
                    value={`Foto (JPG/PNG/WEBP, maks 5 MB, sisa slot ${Math.max(maxPhotos - existingPhotoCount, 0)})`}
                />
                <input
                    id="photos"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => setData('photos', Array.from(e.target.files ?? []))}
                />
                {data.photos.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{data.photos.length} file dipilih</p>
                )}
                <InputError message={photoError} className="mt-1" />
            </div>

            {children}

            <PrimaryButton disabled={processing}>{submitLabel}</PrimaryButton>
        </form>
    );
}
```

- [ ] **Step 8: Create and Edit pages**

Create `resources/js/Pages/Assets/Create.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, Option, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import AssetForm, { AssetFormData } from './Partials/AssetForm';

type Props = PageProps<{ categories: AssetCategory[]; kondisiOptions: Option[]; maxPhotos: number }>;

export default function Create({ categories, kondisiOptions, maxPhotos }: Props) {
    const form = useForm<AssetFormData>({
        kode_barang: '',
        nama_aset: '',
        category_id: '',
        merk_type: '',
        kondisi: 'baik',
        tanggal_perolehan: '',
        sumber_perolehan: '',
        nilai_perolehan: '',
        nilai_buku: '',
        no_dokumen: '',
        keterangan: '',
        photos: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('assets.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Catat Aset Baru</h1>}>
            <Head title="Catat Aset" />
            <AssetForm
                form={form}
                categories={categories}
                kondisiOptions={kondisiOptions}
                maxPhotos={maxPhotos}
                submitLabel="Simpan Aset"
                onSubmit={submit}
            />
        </AuthenticatedLayout>
    );
}
```

Create `resources/js/Pages/Assets/Edit.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, AssetCategory, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import AssetForm, { AssetFormData } from './Partials/AssetForm';

type Props = PageProps<{ asset: Asset; categories: AssetCategory[]; maxPhotos: number }>;

export default function Edit({ asset, categories, maxPhotos }: Props) {
    const form = useForm<AssetFormData>({
        kode_barang: asset.kode_barang,
        nama_aset: asset.nama_aset,
        category_id: asset.category_id,
        merk_type: asset.merk_type ?? '',
        tanggal_perolehan: asset.tanggal_perolehan,
        sumber_perolehan: asset.sumber_perolehan ?? '',
        nilai_perolehan: asset.nilai_perolehan,
        nilai_buku: asset.nilai_buku,
        no_dokumen: asset.no_dokumen ?? '',
        keterangan: asset.keterangan ?? '',
        photos: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(route('assets.update', asset.id), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <Link href={route('assets.show', asset.id)} className="text-sm text-blue-700 hover:underline">
                        ← Kembali ke detail
                    </Link>
                    <h1 className="text-xl font-semibold text-gray-800">Ubah Aset</h1>
                </div>
            }
        >
            <Head title={`Ubah ${asset.nama_aset}`} />
            <AssetForm
                form={form}
                categories={categories}
                maxPhotos={maxPhotos}
                existingPhotoCount={asset.photos?.length ?? 0}
                submitLabel="Simpan Perubahan"
                onSubmit={submit}
            >
                <p className="text-xs text-gray-500">
                    Kondisi, lokasi, dan pemegang aset hanya berubah melalui transaksi (mutasi / lapor kerusakan).
                    Foto lama bisa dihapus dari halaman detail.
                </p>
            </AssetForm>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 9: Add entry points on Index and Show**

In `resources/js/Pages/Assets/Index.tsx`, change the layout header to show the button when `can.create`:

```tsx
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between gap-2">
                    <h1 className="text-xl font-semibold text-gray-800">Data Aset</h1>
                    {can.create && (
                        <Link href={route('assets.create')}>
                            <PrimaryButton type="button">Catat Aset</PrimaryButton>
                        </Link>
                    )}
                </div>
            }
        >
```

In `resources/js/Pages/Assets/Show.tsx`:

1. Change the imports to include `DangerButton`, `SecondaryButton` and `router`:

```tsx
import DangerButton from '@/Components/DangerButton';
import SecondaryButton from '@/Components/SecondaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatRupiah, kondisiLabel, registerLabel } from '@/lib/format';
import { Asset, Option, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ReactNode } from 'react';
```

2. Change the component signature to `export default function Show({ asset, kondisiOptions, can }: Props) {` and add, as the first statement in its body:

```tsx
    const deletePhoto = (photoId: number) => {
        if (confirm('Hapus foto ini?')) {
            router.delete(route('assets.photos.destroy', [asset.id, photoId]), { preserveScroll: true });
        }
    };
```

3. In the header, after the closing `</div>` of the title block (inside the flex wrapper), add:

```tsx
                    {can.update && (
                        <Link href={route('assets.edit', asset.id)}>
                            <SecondaryButton type="button">Ubah</SecondaryButton>
                        </Link>
                    )}
```

4. Replace the photo `<a …>…</a>` element inside `asset.photos!.map(...)` with:

```tsx
                                    <div key={photo.id} className="space-y-1">
                                        <a href={photo.url} target="_blank" rel="noreferrer">
                                            <img src={photo.url} alt={asset.nama_aset} className="h-40 w-full rounded object-cover" />
                                        </a>
                                        {can.update && (
                                            <DangerButton type="button" onClick={() => deletePhoto(photo.id)} className="w-full justify-center">
                                                Hapus
                                            </DangerButton>
                                        )}
                                    </div>
```

- [ ] **Step 10: Run tests and type-check**

```bash
php artisan test tests/Feature/AssetManageTest.php tests/Feature/AssetBrowseTest.php
npm run build
```

Expected: PASS; build exits 0.

- [ ] **Step 11: Commit**

```bash
git add app routes resources/js tests/Feature/AssetManageTest.php
git commit -m "feat: record and edit assets with photo upload and removal"
```

---

### Task 8: QR code per asset and printable label PDF

**Files:**
- Modify: `composer.json` / `composer.lock` (via `composer require`)
- Create: `app/Services/QrCodeService.php`, `app/Services/AssetLabelService.php`
- Create: `resources/views/pdf/asset-labels.blade.php`
- Create: `app/Http/Requests/PrintAssetLabelsRequest.php`
- Create: `app/Http/Controllers/AssetLabelController.php`
- Modify: `app/Repositories/Contracts/AssetRepositoryInterface.php`, `app/Repositories/EloquentAssetRepository.php` (`findMany`), `app/Http/Controllers/AssetController.php` (`show` adds `qr`), `routes/web.php`, `resources/js/Pages/Assets/Show.tsx`, `resources/js/Pages/Assets/Index.tsx`
- Test: `tests/Feature/AssetLabelTest.php`

**Interfaces:**
- Consumes: `AssetPolicy::view` (Task 6), `assets.show` route.
- Produces:
  - `QrCodeService::pngDataUri(string $content, int $size = 300): string`, `QrCodeService::forAsset(Asset $asset): string` (encodes the absolute `assets.show` URL, so any phone camera opens the asset).
  - `AssetLabelService::pdf(Collection $assets): string` (PDF bytes, A4, 3 labels per row).
  - `AssetRepositoryInterface::findMany(array $ids): Collection` (with `unit`, ordered kode_barang, nomor_register).
  - Route `GET /assets/labels?ids[]=…` `assets.labels` — registered **before** the `assets` resource so `labels` is not captured as `{asset}`.
  - Show page prop `qr` (PNG data URI).

- [ ] **Step 1: Install libraries**

```bash
composer require bacon/bacon-qr-code:^3.1 dompdf/dompdf:^3.1
```

Expected: both install. (`bacon/bacon-qr-code` needs ext-iconv; `GDLibRenderer` needs ext-gd; dompdf needs dom/mbstring/gd — all present on the dev machine.)

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/AssetLabelTest.php`:

```php
<?php

use App\Models\Asset;
use App\Services\QrCodeService;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->own = Asset::factory()->create(['unit_id' => $this->kel->id, 'nomor_register' => 1]);
    $this->own2 = Asset::factory()->create(['unit_id' => $this->kel->id, 'nomor_register' => 2]);
    $this->foreign = Asset::factory()->create(['unit_id' => $this->kec->id, 'nomor_register' => 3]);
    $this->admin = userWithRole('admin_kelurahan', $this->kel);
});

it('renders a PNG data uri QR code', function () {
    $uri = app(QrCodeService::class)->pngDataUri('https://simaset.test/assets/1');

    expect($uri)->toStartWith('data:image/png;base64,')
        ->and(substr(base64_decode(substr($uri, strlen('data:image/png;base64,'))), 0, 8))->toBe("\x89PNG\r\n\x1a\n");
});

it('shows the QR code on the asset page', function () {
    $this->actingAs($this->admin)->get("/assets/{$this->own->id}")
        ->assertInertia(fn (Assert $page) => $page->where('qr', fn (string $qr) => str_starts_with($qr, 'data:image/png;base64,')));
});

it('prints in-scope asset labels as a PDF', function () {
    $response = $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->own2->id]]));

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 5))->toBe('%PDF-');
});

it('refuses to print when any selected asset is out of scope', function () {
    $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->foreign->id]]))
        ->assertForbidden();
});

it('validates the id list', function (array $ids) {
    $this->actingAs($this->admin)
        ->from('/assets')
        ->get('/assets/labels?'.http_build_query(['ids' => $ids]))
        ->assertRedirect('/assets')
        ->assertSessionHasErrors();
})->with([
    'empty' => [[]],
    'unknown id' => [[999999]],
    'too many' => [range(1, 100)],
]);

it('forbids pegawai from printing labels', function () {
    $this->actingAs(userWithRole('pegawai', $this->kel))
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id]]))
        ->assertForbidden();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetLabelTest.php`
Expected: FAIL — `Target class [App\Services\QrCodeService] does not exist.`

- [ ] **Step 4: QR and label services**

Create `app/Services/QrCodeService.php`:

```php
<?php

namespace App\Services;

use App\Models\Asset;
use BaconQrCode\Renderer\GDLibRenderer;
use BaconQrCode\Writer;

class QrCodeService
{
    public function pngDataUri(string $content, int $size = 300): string
    {
        $png = (new Writer(new GDLibRenderer($size)))->writeString($content);

        return 'data:image/png;base64,'.base64_encode($png);
    }

    public function forAsset(Asset $asset): string
    {
        return $this->pngDataUri(route('assets.show', $asset));
    }
}
```

Create `app/Services/AssetLabelService.php`:

```php
<?php

namespace App\Services;

use App\Models\Asset;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;

class AssetLabelService
{
    public function __construct(private readonly QrCodeService $qr) {}

    /** @param Collection<int, Asset> $assets */
    public function pdf(Collection $assets): string
    {
        $labels = $assets->map(fn (Asset $asset) => [
            'asset' => $asset,
            'qr' => $this->qr->forAsset($asset),
        ]);

        $html = view('pdf.asset-labels', ['rows' => $labels->chunk(3)])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
```

Create `resources/views/pdf/asset-labels.blade.php`:

```blade
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 10mm; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #111; }
        table { width: 100%; border-collapse: separate; border-spacing: 3mm; }
        td.label { width: 33%; border: 0.3mm solid #444; padding: 2mm; vertical-align: top; }
        .brand { font-weight: bold; font-size: 7pt; letter-spacing: 0.5pt; }
        .qr { width: 26mm; height: 26mm; }
        .name { font-weight: bold; font-size: 9pt; margin-top: 1mm; }
        .code { font-family: 'DejaVu Sans Mono', monospace; font-size: 7pt; }
        .unit { font-size: 7pt; color: #444; }
    </style>
</head>
<body>
<table>
    @foreach ($rows as $row)
        <tr>
            @foreach ($row as $label)
                <td class="label">
                    <div class="brand">SIMASET · KECAMATAN SAGULUNG</div>
                    <img class="qr" src="{{ $label['qr'] }}" alt="QR">
                    <div class="name">{{ $label['asset']->nama_aset }}</div>
                    <div class="code">{{ $label['asset']->kode_barang }} / {{ $label['asset']->registerLabel() }}</div>
                    <div class="unit">{{ $label['asset']->unit->name }}</div>
                </td>
            @endforeach
            @for ($i = $row->count(); $i < 3; $i++)
                <td></td>
            @endfor
        </tr>
    @endforeach
</table>
</body>
</html>
```

- [ ] **Step 5: Repository method, request, controller, routes, show prop**

In `app/Repositories/Contracts/AssetRepositoryInterface.php` add `use Illuminate\Database\Eloquent\Collection;` and:

```php
    /**
     * @param  list<int>  $ids
     * @return Collection<int, Asset>
     */
    public function findMany(array $ids): Collection;
```

In `app/Repositories/EloquentAssetRepository.php` add `use Illuminate\Database\Eloquent\Collection;` and:

```php
    public function findMany(array $ids): Collection
    {
        return Asset::query()
            ->with('unit')
            ->whereIn('id', $ids)
            ->orderBy('kode_barang')
            ->orderBy('nomor_register')
            ->get();
    }
```

Create `app/Http/Requests/PrintAssetLabelsRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PrintAssetLabelsRequest extends FormRequest
{
    public const MAX_LABELS = 99;

    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Asset::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_LABELS],
            'ids.*' => ['integer', 'distinct', Rule::exists('assets', 'id')],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'ids.required' => 'Pilih minimal satu aset untuk dicetak labelnya.',
            'ids.max' => 'Maksimal '.self::MAX_LABELS.' label sekali cetak.',
        ];
    }
}
```

Create `app/Http/Controllers/AssetLabelController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\PrintAssetLabelsRequest;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Services\AssetLabelService;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class AssetLabelController extends Controller
{
    public function __construct(
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetLabelService $labels,
    ) {}

    public function show(PrintAssetLabelsRequest $request): Response
    {
        $assets = $this->assets->findMany(array_map('intval', $request->validated('ids')));

        foreach ($assets as $asset) {
            Gate::authorize('view', $asset);
        }

        return response($this->labels->pdf($assets), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="label-aset.pdf"',
        ]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetLabelController;` and put this line **immediately above** the `Route::resource('assets', ...)` line:

```php
    Route::get('/assets/labels', [AssetLabelController::class, 'show'])->name('assets.labels');
```

In `app/Http/Controllers/AssetController.php`, add `use App\Services\QrCodeService;`, add `private readonly QrCodeService $qr,` as the last constructor parameter, and in `show()` add to the props array:

```php
            'qr' => $this->qr->forAsset($asset),
```

- [ ] **Step 6: Run the test**

Run: `php artisan test tests/Feature/AssetLabelTest.php`
Expected: PASS. If the Inertia assertion in `shows the QR code on the asset page` reports a type error on the closure argument, that means `qr` is missing from the props — re-check Step 5's `show()` edit.

- [ ] **Step 7: Frontend — QR on detail, print buttons**

In `resources/js/Pages/Assets/Show.tsx`:

1. Change the `Props` type to add `qr: string`, and the signature to `({ asset, kondisiOptions, can, qr }: Props)`.
2. Add inside the component body:

```tsx
    const printLabel = () => window.open(route('assets.labels', { ids: [asset.id] }), '_blank');
```

3. In the right-hand column, wrap the existing Riwayat `<section>` in a `<div className="space-y-6">` and put this section above it:

```tsx
                    <section className="rounded-lg bg-white p-6 text-center shadow-sm">
                        <h2 className="mb-3 font-semibold text-gray-800">Label QR</h2>
                        <img src={qr} alt="QR aset" className="mx-auto h-40 w-40" />
                        <SecondaryButton type="button" onClick={printLabel} className="mt-3">
                            Cetak Label (PDF)
                        </SecondaryButton>
                    </section>
```

In `resources/js/Pages/Assets/Index.tsx`:

1. Add selection state inside the component:

```tsx
    const [selected, setSelected] = useState<number[]>([]);
    const toggle = (id: number) =>
        setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    const allOnPage = assets.data.length > 0 && assets.data.every((a) => selected.includes(a.id));
    const togglePage = () =>
        setSelected((current) =>
            allOnPage
                ? current.filter((id) => !assets.data.some((a) => a.id === id))
                : [...new Set([...current, ...assets.data.map((a) => a.id)])],
        );
    const printSelected = () => window.open(route('assets.labels', { ids: selected }), '_blank');
```

2. Just above the table wrapper `<div className="overflow-x-auto ...">`, add:

```tsx
            {selected.length > 0 && (
                <div className="mb-2 flex items-center gap-3 text-sm">
                    <span>{selected.length} aset dipilih</span>
                    <PrimaryButton type="button" onClick={printSelected} disabled={selected.length > 99}>
                        Cetak Label
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => setSelected([])}>
                        Batal pilih
                    </SecondaryButton>
                    {selected.length > 99 && <span className="text-red-600">Maksimal 99 label sekali cetak.</span>}
                </div>
            )}
```

3. Add a first header cell `<th className="px-4 py-3"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Pilih semua di halaman ini" /></th>`, a first body cell `<td className="px-4 py-3"><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} aria-label={`Pilih ${a.nama_aset}`} /></td>`, and change the empty-state `colSpan={6}` to `colSpan={7}`.

- [ ] **Step 8: Run tests and type-check**

```bash
php artisan test tests/Feature/AssetLabelTest.php tests/Feature/AssetBrowseTest.php
npm run build
```

Expected: PASS; build exits 0.

- [ ] **Step 9: Commit**

```bash
git add composer.json composer.lock app resources routes tests/Feature/AssetLabelTest.php
git commit -m "feat: QR code per asset and printable label PDF"
```

---

### Task 9: Lint pass, full suite, and hands-on check

**Files:**
- Modify: any files flagged by Pint/ESLint; `.env.example` (APP_NAME/DB defaults)

**Interfaces:**
- Consumes: everything above.
- Produces: a clean, verified Sprint 2A.

- [ ] **Step 1: Fix the stale `.env.example`** (a deferred Sprint 1 minor that bites anyone cloning to try this sprint)

In `.env.example` set:

```
APP_NAME=SIMASET
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=simaset
DB_USERNAME=root
DB_PASSWORD=
```

(Replace the existing `APP_NAME=Laravel`, `DB_CONNECTION=sqlite` and commented `# DB_*` lines.)

- [ ] **Step 2: Format and lint**

```bash
./vendor/bin/pint
npm run lint
```

Expected: both exit 0 (auto-fixes applied).

- [ ] **Step 3: Full suite and build**

```bash
php artisan test
npm run build
```

Expected: all tests PASS; build exits 0.

- [ ] **Step 4: Refresh the dev database**

```bash
php artisan migrate:fresh --seed
```

Expected: migrations run, seeders run (`AssetCategorySeeder` creates the 7 kategori / 15 subkategori).

- [ ] **Step 5: Hands-on check in a browser**

Run `php artisan serve` and `npm run dev`. Demo password is `password`.

1. `kasubag@simaset.test` → Master Data Aset shows the 7 client categories; add a subkategori, rename it, try deleting "ALAT RUMAH TANGGA" (must show the "masih dipakai" message), delete the new empty one.
2. `admin.kecamatan@simaset.test` → Data Aset → Catat Aset: fill a record with 2 photos → lands on the detail page with photos, QR image and one Riwayat entry "Aset dicatat". Scan the QR with a phone on the same network or open the encoded URL — it opens this asset. Click **Cetak Label (PDF)** — a PDF with one label opens in a new tab and the label is readable. Record a second asset with the same kode barang → register `0002`.
3. On the list, tick both assets → **Cetak Label** → one PDF with two labels.
4. `admin.kelurahan@simaset.test` → Data Aset does not show the kecamatan assets; typing `/assets/<kecamatan asset id>` shows 403.
5. `camat@simaset.test` → sees both assets and the unit filter; no **Catat Aset** / **Ubah** buttons.
6. Check the **Akun** dropdown still opens visibly on these new pages (it relies on the layout's Preline init).

Note anything that does not match as a finding before committing.

- [ ] **Step 6: Commit**

```bash
git add -A
git status --short
git commit -m "chore: Sprint 2A lint pass and env example for SIMASET"
```

(Before committing, confirm `git status --short` lists no `docs/*.xlsx` / `docs/*.pdf` client files; unstage them with `git restore --staged <file>` if they appear.)

---

## Self-Review Notes

- **Spec coverage:** 2-level `asset_categories` (Task 1, 5); `assets` with every spec field incl. `merk_type`, `nilai_buku`, `no_dokumen`, `tanggal_perolehan`, system `nomor_register` (Task 2, 4); `asset_photos` polymorphic multi-foto (Task 2, 4, 7); `asset_histories` written on creation (Task 4) and shown (Task 6); unit scoping via Policy + query (Task 3, 6); Service/Repository/FormRequest convention (Tasks 4–8); QR per asset scannable from a browser camera and PDF label (Task 8). Out of scope and left for later plans: approval workflow engine, Penerimaan Aset approval (new assets are active immediately in this sprint; Sprint 3 routes intake through approval), mutasi/kondisi changes, QR scan page (Sprint 4), Excel import (Sprint 5).
- **Placeholder scan:** none — every step carries its code or exact command.
- **Type consistency:** `AssetService::DESCRIPTIVE_FIELDS` ⇔ `StoreAssetRequest::descriptiveRules()` keys ⇔ TS `AssetFormData` (minus `kondisi`/`photos`); `accessibleUnitIds()` used by `canAccessUnit`, `Asset::visibleTo`, `UnitRepository::accessibleBy`; `AssetCategoryRepositoryInterface::tree()` shape (`children`, `assets_count`) ⇔ TS `AssetCategory`; route names `assets.index|create|store|show|edit|update|labels`, `assets.photos.destroy`, `asset-categories.*` used identically in PHP tests and `route()` calls.
- **Review Focus:** register sequencing → Task 4 tests 1–2; tampered request → Task 4 test 4 + Task 7 test 3; out-of-scope URL/label → Task 6 last test + Task 8 test 4; bad/oversized/too-many photos → Task 7 photo tests; category delete with dependents → Task 5 delete test.
