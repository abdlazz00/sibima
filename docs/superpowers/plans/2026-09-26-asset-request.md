# Asset Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kecamatan/kelurahan can submit an asset request on behalf of a pegawai, or (kelurahan only) a request for stock from the kecamatan; the right approver (camat/lurah for a pegawai request, kasubag for a unit request) approves or rejects it; once approved, an admin manually picks which asset fulfills it, moving the asset to the right holder/unit.

**Architecture:** One table, `asset_requests`, handles both request kinds via a `type` column — a single-step `pending → approved/rejected → fulfilled` status, no multi-step workflow engine (see spec: "Data Model — Request & Laporan Aset"). Follows the existing convention: thin Controller → FormRequest (validation + `authorize()`) → Service (business rules, including the routing/fulfillment guards) → Policy (who may act).

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md` (see "Data Model — Request & Laporan Aset", alur f/g).

**Depends on:** `docs/superpowers/plans/2026-09-26-pegawai-data.md` must be merged first (`Pegawai` model, `pegawais` table, `Asset.current_holder_id` pointing at `pegawais`).

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:`.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Policy. Controllers use `Gate::authorize()` where a FormRequest isn't already in play.
- `requesting_unit_id` is **never** taken from client input — for `type = pegawai` it is derived from the pegawai's own unit; for `type = unit` it is the submitting admin's own unit. This mirrors `AssetService::create()`'s existing pattern of ignoring a smuggled `unit_id`.
- `category_id` must reference a subkategori (`parent_id` not null) — same rule `Asset` already enforces.
- Approval routing (fixed, not configurable): `type = pegawai` → camat if the pegawai's unit is a kecamatan, lurah if kelurahan; `type = unit` → kasubag only. Fulfillment is done by the same actor class that could have created the request (admin_kecamatan/admin_kelurahan for a pegawai request, admin_kecamatan of the parent kecamatan for a unit request), and only once `status = approved`.
- UI copy in Bahasa Indonesia.

## Review Focus

- An admin kelurahan submits a `type = pegawai` request for a pegawai in a *different* unit by hand-typing `pegawai_id` → must be rejected (403), not accepted → pinned in Task 3.
- An admin kecamatan tries to submit a `type = unit` request (only kelurahan may ask kecamatan for stock, never the other way in this flow) → must be rejected → pinned in Task 3.
- Calling `fulfill` on a request that is still `pending` (approval skipped) → must throw, not silently reassign an asset → pinned in Task 2 (the HTTP layer inherits this for free: `AssetRequestPolicy::fulfill()` returns `false` for a non-approved request, so the route 403s before the service is even reached).
- Fulfilling a pegawai request with an asset that physically lives in a *different* unit than the pegawai → must be rejected with a clear message, not silently create a cross-unit holder mismatch → pinned in Task 2.
- Deciding (approve/reject) the same request twice → the second call must be rejected, not overwrite the first decision → pinned in Task 2.

---

### Task 1: `asset_requests` table, enums, model, factory

**Files:**
- Create: `app/Enums/AssetRequestType.php`
- Create: `app/Enums/AssetRequestStatus.php`
- Create: `database/migrations/2026_09_26_000000_create_asset_requests_table.php`
- Create: `app/Models/AssetRequest.php`
- Create: `database/factories/AssetRequestFactory.php`
- Test: `tests/Feature/AssetRequestModelTest.php`

**Interfaces:**
- Consumes: `Pegawai`, `Unit`, `AssetCategory`, `Asset`, `User` (existing/prior plan).
- Produces: `App\Enums\AssetRequestType` (`Pegawai='pegawai'`, `Unit='unit'`), `App\Enums\AssetRequestStatus` (`Pending='pending'`, `Approved='approved'`, `Rejected='rejected'`, `Fulfilled='fulfilled'`), both with `label(): string`. `App\Models\AssetRequest` with relations `pegawai()`, `requestingUnit()`, `category()`, `fulfilledAsset()`, `approvedBy()`, `fulfilledBy()`, `createdBy()` (all `BelongsTo`), `scopeVisibleTo(Builder $query, User $user): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetRequestModelTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use App\Models\Pegawai;

it('casts type and status and links relations', function () {
    $pegawai = Pegawai::factory()->create();
    $request = AssetRequest::factory()->create([
        'type' => 'pegawai',
        'pegawai_id' => $pegawai->id,
        'requesting_unit_id' => $pegawai->unit_id,
        'status' => 'pending',
    ]);

    expect($request->type)->toBe(AssetRequestType::Pegawai)
        ->and($request->status)->toBe(AssetRequestStatus::Pending)
        ->and($request->pegawai->is($pegawai))->toBeTrue()
        ->and($request->requestingUnit->is($pegawai->unit))->toBeTrue();
});

it('scopes visibility: a pegawai request is visible to its own unit only', function () {
    $kec = makeKecamatan();
    $kel = makeKelurahan($kec, 'Kelurahan Tembesi');
    $pegawaiKel = Pegawai::factory()->create(['unit_id' => $kel->id]);
    $pegawaiKec = Pegawai::factory()->create(['unit_id' => $kec->id]);

    AssetRequest::factory()->create(['type' => 'pegawai', 'pegawai_id' => $pegawaiKel->id, 'requesting_unit_id' => $kel->id]);
    AssetRequest::factory()->create(['type' => 'pegawai', 'pegawai_id' => $pegawaiKec->id, 'requesting_unit_id' => $kec->id]);

    $lurah = userWithRole('lurah', $kel);

    expect(AssetRequest::query()->visibleTo($lurah)->count())->toBe(1);
});

it('scopes visibility: a unit request is visible to both the requesting kelurahan and its parent kecamatan', function () {
    $kec = makeKecamatan();
    $kel = makeKelurahan($kec, 'Kelurahan Tembesi');
    AssetRequest::factory()->create(['type' => 'unit', 'pegawai_id' => null, 'requesting_unit_id' => $kel->id]);

    $adminKel = userWithRole('admin_kelurahan', $kel);
    $adminKec = userWithRole('admin_kecamatan', $kec);
    $otherKec = makeKecamatan('Kecamatan Lain');
    $adminOtherKec = userWithRole('admin_kecamatan', $otherKec);

    expect(AssetRequest::query()->visibleTo($adminKel)->count())->toBe(1)
        ->and(AssetRequest::query()->visibleTo($adminKec)->count())->toBe(1)
        ->and(AssetRequest::query()->visibleTo($adminOtherKec)->count())->toBe(0);
});

it('shows kasubag every request', function () {
    $pegawai = Pegawai::factory()->create();
    AssetRequest::factory()->create(['type' => 'pegawai', 'pegawai_id' => $pegawai->id, 'requesting_unit_id' => $pegawai->unit_id]);
    AssetRequest::factory()->create(['type' => 'unit', 'pegawai_id' => null, 'requesting_unit_id' => makeKelurahan(makeKecamatan('Kec 2'), 'Kel 2')->id]);

    expect(AssetRequest::query()->visibleTo(userWithRole('kasubag'))->count())->toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestModelTest.php`
Expected: FAIL — `Class "App\Models\AssetRequest" not found`.

- [ ] **Step 3: Create the enums**

Create `app/Enums/AssetRequestType.php`:

```php
<?php

namespace App\Enums;

enum AssetRequestType: string
{
    case Pegawai = 'pegawai';
    case Unit = 'unit';

    public function label(): string
    {
        return match ($this) {
            self::Pegawai => 'Pegawai',
            self::Unit => 'Kelurahan ke Kecamatan',
        };
    }
}
```

Create `app/Enums/AssetRequestStatus.php`:

```php
<?php

namespace App\Enums;

enum AssetRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Fulfilled = 'fulfilled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
            self::Fulfilled => 'Terpenuhi',
        };
    }
}
```

- [ ] **Step 4: Create the migration**

Create `database/migrations/2026_09_26_000000_create_asset_requests_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_requests', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->foreignId('pegawai_id')->nullable()->constrained('pegawais')->restrictOnDelete();
            $table->foreignId('requesting_unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('category_id')->constrained('asset_categories')->restrictOnDelete();
            $table->text('keterangan')->nullable();
            $table->string('status')->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->foreignId('fulfilled_asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('fulfilled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fulfilled_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_requests');
    }
};
```

- [ ] **Step 5: Create the model**

Create `app/Models/AssetRequest.php`:

```php
<?php

namespace App\Models;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'pegawai_id',
        'requesting_unit_id',
        'category_id',
        'keterangan',
        'status',
        'approved_by',
        'approved_at',
        'rejected_reason',
        'fulfilled_asset_id',
        'fulfilled_by',
        'fulfilled_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AssetRequestType::class,
            'status' => AssetRequestStatus::class,
            'approved_at' => 'datetime',
            'fulfilled_at' => 'datetime',
        ];
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function requestingUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'requesting_unit_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function fulfilledAsset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'fulfilled_asset_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function fulfilledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fulfilled_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids === null) {
            return;
        }

        $query->where(function (Builder $query) use ($ids) {
            $query->where(function (Builder $query) use ($ids) {
                $query->where('type', AssetRequestType::Pegawai->value)
                    ->whereHas('pegawai', fn (Builder $q) => $q->whereIn('unit_id', $ids));
            })->orWhere(function (Builder $query) use ($ids) {
                $query->where('type', AssetRequestType::Unit->value)
                    ->where(function (Builder $query) use ($ids) {
                        $query->whereIn('requesting_unit_id', $ids)
                            ->orWhereHas('requestingUnit', fn (Builder $q) => $q->whereIn('parent_id', $ids));
                    });
            });
        });
    }
}
```

- [ ] **Step 6: Create the factory**

Create `database/factories/AssetRequestFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetRequest> */
class AssetRequestFactory extends Factory
{
    public function definition(): array
    {
        $pegawai = Pegawai::factory()->create();

        return [
            'type' => 'pegawai',
            'pegawai_id' => $pegawai->id,
            'requesting_unit_id' => $pegawai->unit_id,
            'category_id' => fn () => AssetCategory::factory()->subcategory()->create()->id,
            'keterangan' => 'Butuh aset baru',
            'status' => 'pending',
            'created_by' => fn () => \App\Models\User::factory()->create()->id,
        ];
    }
}
```

- [ ] **Step 7: Migrate and run the test**

```bash
php artisan migrate
php artisan test tests/Feature/AssetRequestModelTest.php
```

Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add app/Enums/AssetRequestType.php app/Enums/AssetRequestStatus.php app/Models/AssetRequest.php database/migrations/2026_09_26_000000_create_asset_requests_table.php database/factories/AssetRequestFactory.php tests/Feature/AssetRequestModelTest.php
git commit -m "feat: add asset_requests table, enums and model"
```

---

### Task 2: `AssetRequestService` — create, decide, fulfill

**Files:**
- Create: `app/Services/AssetRequestService.php`
- Test: `tests/Feature/AssetRequestServiceTest.php`

**Interfaces:**
- Consumes: `AssetRequest`, enums (Task 1), `Pegawai`, `Asset`, `Unit::isKecamatan()`/`isKelurahan()` (existing).
- Produces:
  - `AssetRequestService::create(array $data, User $actor): AssetRequest` — `$data` keys: `type`, `pegawai_id` (required when `type=pegawai`), `category_id`, `keterangan`. Derives `requesting_unit_id` (never trusts client input for it).
  - `AssetRequestService::decide(AssetRequest $request, string $status, User $actor, ?string $reason = null): AssetRequest` — throws `InvalidArgumentException` unless `$request->status` is currently `pending`.
  - `AssetRequestService::fulfill(AssetRequest $request, Asset $asset, User $actor): AssetRequest` — throws `InvalidArgumentException` unless `$request->status` is `approved`, and unless `$asset` is in the correct unit for the request's type.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetRequestServiceTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Services\AssetRequestService;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->sub = AssetCategory::factory()->subcategory()->create();
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->service = app(AssetRequestService::class);
});

it('creates a pegawai-type request with requesting_unit_id derived from the pegawai', function () {
    $request = $this->service->create([
        'type' => 'pegawai',
        'pegawai_id' => $this->pegawai->id,
        'category_id' => $this->sub->id,
        'keterangan' => 'Butuh laptop',
    ], $this->adminKel);

    expect($request->type)->toBe(AssetRequestType::Pegawai)
        ->and($request->requesting_unit_id)->toBe($this->kel->id)
        ->and($request->status)->toBe(AssetRequestStatus::Pending);
});

it('creates a unit-type request with requesting_unit_id derived from the actor, ignoring a smuggled unit', function () {
    $request = $this->service->create([
        'type' => 'unit',
        'category_id' => $this->sub->id,
        'requesting_unit_id' => $this->kec->id,
    ], $this->adminKel);

    expect($request->type)->toBe(AssetRequestType::Unit)
        ->and($request->pegawai_id)->toBeNull()
        ->and($request->requesting_unit_id)->toBe($this->kel->id);
});

it('approves a pending request', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);

    $this->service->decide($request, 'approved', $this->lurah);

    expect($request->refresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->approved_by)->toBe($this->lurah->id);
});

it('rejects a pending request with a reason', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);

    $this->service->decide($request, 'rejected', $this->lurah, 'Anggaran belum ada');

    expect($request->refresh()->status)->toBe(AssetRequestStatus::Rejected)
        ->and($request->rejected_reason)->toBe('Anggaran belum ada');
});

it('refuses to decide a request twice', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);
    $this->service->decide($request, 'approved', $this->lurah);

    $this->service->decide($request, 'approved', $this->lurah);
})->throws(InvalidArgumentException::class);

it('fulfills a pegawai request by assigning the chosen asset as its holder', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);
    $this->service->decide($request, 'approved', $this->lurah);
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);

    $this->service->fulfill($request, $asset, $this->adminKel);

    expect($asset->refresh()->current_holder_id)->toBe($this->pegawai->id)
        ->and($request->refresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($request->fulfilled_asset_id)->toBe($asset->id)
        ->and($asset->histories()->first()->event)->toBe('request_pegawai_terpenuhi');
});

it('refuses to fulfill a pegawai request with an asset from a different unit', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);
    $this->service->decide($request, 'approved', $this->lurah);
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);

    $this->service->fulfill($request, $asset, $this->adminKel);
})->throws(InvalidArgumentException::class);

it('refuses to fulfill before the request is approved', function () {
    $request = $this->service->create(['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id], $this->adminKel);
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);

    $this->service->fulfill($request, $asset, $this->adminKel);
})->throws(InvalidArgumentException::class);

it('fulfills a unit request by moving the asset to the requesting kelurahan', function () {
    $request = $this->service->create(['type' => 'unit', 'category_id' => $this->sub->id], $this->adminKel);
    $this->service->decide($request, 'approved', userWithRole('kasubag'));
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);
    $adminKec = userWithRole('admin_kecamatan', $this->kec);

    $this->service->fulfill($request, $asset, $adminKec);

    expect($asset->refresh()->unit_id)->toBe($this->kel->id)
        ->and($request->refresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($asset->histories()->first()->event)->toBe('request_unit_terpenuhi');
});

it('refuses to fulfill a unit request with an asset that is not in the parent kecamatan', function () {
    $request = $this->service->create(['type' => 'unit', 'category_id' => $this->sub->id], $this->adminKel);
    $this->service->decide($request, 'approved', userWithRole('kasubag'));
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);

    $this->service->fulfill($request, $asset, userWithRole('admin_kecamatan', $this->kec));
})->throws(InvalidArgumentException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestServiceTest.php`
Expected: FAIL — `Target class [App\Services\AssetRequestService] does not exist.`

- [ ] **Step 3: Create the service**

Create `app/Services/AssetRequestService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\Asset;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetRequestService
{
    /** @param array<string, mixed> $data */
    public function create(array $data, User $actor): AssetRequest
    {
        $type = AssetRequestType::from($data['type']);

        $attributes = [
            'type' => $type,
            'category_id' => $data['category_id'],
            'keterangan' => $data['keterangan'] ?? null,
            'status' => AssetRequestStatus::Pending,
            'created_by' => $actor->id,
        ];

        if ($type === AssetRequestType::Pegawai) {
            $pegawai = Pegawai::findOrFail($data['pegawai_id']);
            $attributes['pegawai_id'] = $pegawai->id;
            $attributes['requesting_unit_id'] = $pegawai->unit_id;
        } else {
            $attributes['pegawai_id'] = null;
            $attributes['requesting_unit_id'] = $actor->unit_id;
        }

        return AssetRequest::create($attributes);
    }

    public function decide(AssetRequest $request, string $status, User $actor, ?string $reason = null): AssetRequest
    {
        if ($request->status !== AssetRequestStatus::Pending) {
            throw new InvalidArgumentException('Request ini sudah diproses sebelumnya.');
        }

        $request->update([
            'status' => $status,
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'rejected_reason' => $status === AssetRequestStatus::Rejected->value ? $reason : null,
        ]);

        return $request;
    }

    public function fulfill(AssetRequest $request, Asset $asset, User $actor): AssetRequest
    {
        if ($request->status !== AssetRequestStatus::Approved) {
            throw new InvalidArgumentException('Request harus disetujui dulu sebelum dipenuhi.');
        }

        return DB::transaction(function () use ($request, $asset, $actor) {
            if ($request->type === AssetRequestType::Pegawai) {
                if ($asset->unit_id !== $request->pegawai->unit_id) {
                    throw new InvalidArgumentException('Aset yang dipilih harus berada di unit pegawai ini.');
                }

                $asset->update(['current_holder_id' => $request->pegawai_id]);
                $asset->histories()->create([
                    'event' => 'request_pegawai_terpenuhi',
                    'unit_id' => $asset->unit_id,
                    'current_holder_id' => $request->pegawai_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => $actor->id,
                ]);
            } else {
                $kecamatan = $request->requestingUnit->parent;

                if ($kecamatan === null || $asset->unit_id !== $kecamatan->id) {
                    throw new InvalidArgumentException('Aset yang dipilih harus berada di kecamatan induk.');
                }

                $asset->update(['unit_id' => $request->requesting_unit_id]);
                $asset->histories()->create([
                    'event' => 'request_unit_terpenuhi',
                    'unit_id' => $asset->unit_id,
                    'current_holder_id' => $asset->current_holder_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => $actor->id,
                ]);
            }

            $request->update([
                'status' => AssetRequestStatus::Fulfilled,
                'fulfilled_asset_id' => $asset->id,
                'fulfilled_by' => $actor->id,
                'fulfilled_at' => now(),
            ]);

            return $request;
        });
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test tests/Feature/AssetRequestServiceTest.php`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetRequestService.php tests/Feature/AssetRequestServiceTest.php
git commit -m "feat: add AssetRequestService with routing-aware decide and fulfill"
```

---

### Task 3: `AssetRequestPolicy`, FormRequests, `AssetRequestController`, routes

**Files:**
- Create: `app/Policies/AssetRequestPolicy.php`
- Create: `app/Http/Requests/StoreAssetRequestRequest.php`
- Create: `app/Http/Requests/DecideAssetRequestRequest.php`
- Create: `app/Http/Requests/FulfillAssetRequestRequest.php`
- Create: `app/Http/Controllers/AssetRequestController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/AssetRequestManagementTest.php`

**Interfaces:**
- Consumes: `AssetRequestService` (Task 2), `AssetRequest` (Task 1), `Pegawai`.
- Produces: Routes (all `auth`): `GET /asset-requests` `asset-requests.index`, `POST /asset-requests` `asset-requests.store`, `PATCH /asset-requests/{assetRequest}/decide` `asset-requests.decide`, `POST /asset-requests/{assetRequest}/fulfill` `asset-requests.fulfill`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/AssetRequestManagementTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->sub = AssetCategory::factory()->subcategory()->create();
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
});

it('lets admin_kelurahan submit a pegawai request for a pegawai in their own unit', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', [
            'type' => 'pegawai',
            'pegawai_id' => $this->pegawai->id,
            'category_id' => $this->sub->id,
            'keterangan' => 'Butuh laptop',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');
});

it('forbids submitting a pegawai request for a pegawai in another unit', function () {
    $outsider = Pegawai::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', [
            'type' => 'pegawai',
            'pegawai_id' => $outsider->id,
            'category_id' => $this->sub->id,
        ])
        ->assertForbidden();
});

it('forbids admin_kecamatan from submitting a unit-type request', function () {
    $this->actingAs(userWithRole('admin_kecamatan', $this->kec))
        ->post('/asset-requests', ['type' => 'unit', 'category_id' => $this->sub->id])
        ->assertForbidden();
});

it('lets lurah approve a pegawai request for their own kelurahan and forbids camat from doing it', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', ['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id]);
    $request = \App\Models\AssetRequest::firstOrFail();

    $this->actingAs(userWithRole('camat', $this->kec))
        ->patch("/asset-requests/{$request->id}/decide", ['status' => 'approved'])
        ->assertForbidden();

    $this->actingAs(userWithRole('lurah', $this->kel))
        ->patch("/asset-requests/{$request->id}/decide", ['status' => 'approved'])
        ->assertSessionHas('success');

    expect($request->refresh()->status->value)->toBe('approved');
});

it('lets kasubag approve a unit request and forbids camat from doing it', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', ['type' => 'unit', 'category_id' => $this->sub->id]);
    $request = \App\Models\AssetRequest::firstOrFail();

    $this->actingAs(userWithRole('camat', $this->kec))
        ->patch("/asset-requests/{$request->id}/decide", ['status' => 'approved'])
        ->assertForbidden();

    $this->actingAs(userWithRole('kasubag'))
        ->patch("/asset-requests/{$request->id}/decide", ['status' => 'approved'])
        ->assertSessionHas('success');
});

it('lets admin_kelurahan fulfill an approved pegawai request', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', ['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id]);
    $request = \App\Models\AssetRequest::firstOrFail();
    $this->actingAs(userWithRole('lurah', $this->kel))->patch("/asset-requests/{$request->id}/decide", ['status' => 'approved']);
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post("/asset-requests/{$request->id}/fulfill", ['fulfilled_asset_id' => $asset->id])
        ->assertSessionHas('success');

    expect($asset->refresh()->current_holder_id)->toBe($this->pegawai->id);
});

it('rejects a request with a reason', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-requests', ['type' => 'pegawai', 'pegawai_id' => $this->pegawai->id, 'category_id' => $this->sub->id]);
    $request = \App\Models\AssetRequest::firstOrFail();

    $this->actingAs(userWithRole('lurah', $this->kel))
        ->patch("/asset-requests/{$request->id}/decide", ['status' => 'rejected', 'rejected_reason' => 'Anggaran belum ada'])
        ->assertSessionHasNoErrors();

    expect($request->refresh()->status->value)->toBe('rejected')
        ->and($request->rejected_reason)->toBe('Anggaran belum ada');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestManagementTest.php`
Expected: FAIL — route `asset-requests.store` not found.

- [ ] **Step 3: Create the policy**

Create `app/Policies/AssetRequestPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use App\Models\User;

class AssetRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function create(User $user, string $type): bool
    {
        return match ($type) {
            'pegawai' => $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']),
            'unit' => $user->hasRole('admin_kelurahan'),
            default => false,
        };
    }

    public function decide(User $user, AssetRequest $request): bool
    {
        if ($request->type === AssetRequestType::Unit) {
            return $user->hasRole('kasubag');
        }

        $unit = $request->pegawai->unit;

        return ($unit->isKecamatan() && $user->hasRole('camat') && $user->unit_id === $unit->id)
            || ($unit->isKelurahan() && $user->hasRole('lurah') && $user->unit_id === $unit->id);
    }

    public function fulfill(User $user, AssetRequest $request): bool
    {
        if ($request->status !== AssetRequestStatus::Approved) {
            return false;
        }

        if ($request->type === AssetRequestType::Unit) {
            $kecamatan = $request->requestingUnit->parent;

            return $user->hasRole('admin_kecamatan') && $kecamatan !== null && $user->unit_id === $kecamatan->id;
        }

        return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->canAccessUnit($request->pegawai->unit);
    }
}
```

- [ ] **Step 4: Create the FormRequests**

Create `app/Http/Requests/StoreAssetRequestRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Models\AssetRequest;
use App\Models\Pegawai;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $type = $this->input('type');

        if (! $this->user()->can('create', [AssetRequest::class, $type])) {
            return false;
        }

        if ($type === 'pegawai') {
            $pegawai = Pegawai::find($this->input('pegawai_id'));

            return $pegawai !== null && $this->user()->canAccessUnit($pegawai->unit);
        }

        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['pegawai', 'unit'])],
            'pegawai_id' => ['required_if:type,pegawai', 'nullable', 'integer', Rule::exists('pegawais', 'id')],
            'category_id' => [
                'required', 'integer',
                Rule::exists('asset_categories', 'id')->whereNotNull('parent_id'),
            ],
            'keterangan' => ['nullable', 'string'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'pegawai_id.required_if' => 'Pilih pegawai untuk request jenis ini.',
            'category_id.exists' => 'Kategori harus berupa subkategori.',
        ];
    }
}
```

Create `app/Http/Requests/DecideAssetRequestRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideAssetRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('decide', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'rejected_reason' => ['required_if:status,rejected', 'nullable', 'string'],
        ];
    }
}
```

Create `app/Http/Requests/FulfillAssetRequestRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FulfillAssetRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('fulfill', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['fulfilled_asset_id' => ['required', 'integer', Rule::exists('assets', 'id')]];
    }
}
```

- [ ] **Step 5: Create the controller and routes**

Create `app/Http/Controllers/AssetRequestController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\DecideAssetRequestRequest;
use App\Http\Requests\FulfillAssetRequestRequest;
use App\Http\Requests\StoreAssetRequestRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\AssetRequestService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetRequestController extends Controller
{
    public function __construct(private readonly AssetRequestService $service) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetRequest::class);
        $user = $request->user();

        return Inertia::render('AssetRequests/Index', [
            'requests' => AssetRequest::query()
                ->visibleTo($user)
                ->with(['pegawai.unit', 'requestingUnit', 'category.parent', 'fulfilledAsset'])
                ->latest()
                ->get(),
            'pegawaiOptions' => Pegawai::query()->visibleTo($user)->orderBy('nama')->get(['id', 'nama', 'unit_id']),
            'categoryOptions' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'can' => [
                'createPegawai' => $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']),
                'createUnit' => $user->hasRole('admin_kelurahan'),
            ],
        ]);
    }

    public function store(StoreAssetRequestRequest $request): RedirectResponse
    {
        $this->service->create($request->validated(), $request->user());

        return back()->with('success', 'Request aset berhasil diajukan.');
    }

    public function decide(DecideAssetRequestRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        try {
            $this->service->decide($assetRequest, $request->validated('status'), $request->user(), $request->validated('rejected_reason'));
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['status' => $e->getMessage()]);
        }

        return back()->with('success', 'Request berhasil diproses.');
    }

    public function fulfill(FulfillAssetRequestRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        $asset = Asset::findOrFail($request->validated('fulfilled_asset_id'));

        try {
            $this->service->fulfill($assetRequest, $asset, $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['fulfilled_asset_id' => $e->getMessage()]);
        }

        return back()->with('success', 'Request berhasil dipenuhi.');
    }
}
```

In `routes/web.php`, add the import `use App\Http\Controllers\AssetRequestController;` and, inside the `auth` middleware group:

```php
    Route::get('/asset-requests', [AssetRequestController::class, 'index'])->name('asset-requests.index');
    Route::post('/asset-requests', [AssetRequestController::class, 'store'])->name('asset-requests.store');
    Route::patch('/asset-requests/{assetRequest}/decide', [AssetRequestController::class, 'decide'])->name('asset-requests.decide');
    Route::post('/asset-requests/{assetRequest}/fulfill', [AssetRequestController::class, 'fulfill'])->name('asset-requests.fulfill');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test tests/Feature/AssetRequestManagementTest.php`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Policies/AssetRequestPolicy.php app/Http/Requests/StoreAssetRequestRequest.php app/Http/Requests/DecideAssetRequestRequest.php app/Http/Requests/FulfillAssetRequestRequest.php app/Http/Controllers/AssetRequestController.php routes/web.php tests/Feature/AssetRequestManagementTest.php
git commit -m "feat: add asset request policy, HTTP layer and routes"
```

---

### Task 4: Frontend — Asset Request page and navigation

**Files:**
- Create: `resources/js/Pages/AssetRequests/Index.tsx`
- Modify: `resources/js/types/index.d.ts`
- Modify: `resources/js/config/navigation.ts`

**Interfaces:**
- Consumes: `asset-requests.*` routes (Task 3), `Pegawai` type (from the Pegawai plan).

- [ ] **Step 1: Add TS types**

In `resources/js/types/index.d.ts`, add:

```typescript
export interface AssetRequest {
    id: number;
    type: 'pegawai' | 'unit';
    keterangan: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    rejected_reason: string | null;
    pegawai?: { id: number; nama: string; unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } } | null;
    requesting_unit: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    category: { id: number; name: string; parent?: { id: number; name: string } };
    fulfilled_asset?: { id: number; nama_aset: string } | null;
}
```

- [ ] **Step 2: Add navigation entries**

In `resources/js/config/navigation.ts`, add a `REQUEST_ASET: NavItem = { label: 'Request Aset', href: '/asset-requests' };` constant and replace the disabled placeholders it supersedes:

```typescript
const REQUEST_ASET: NavItem = { label: 'Request Aset', href: '/asset-requests' };
```

Add `REQUEST_ASET` to `kasubag`, `camat`, `admin_kecamatan`, `admin_kelurahan`, and `lurah` arrays (each role either creates or approves requests).

- [ ] **Step 3: Build the page**

Create `resources/js/Pages/AssetRequests/Index.tsx`:

```tsx
import DangerButton from '@/Components/DangerButton';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetRequest, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface PegawaiOption {
    id: number;
    nama: string;
    unit_id: number;
}

interface CategoryOption {
    id: number;
    name: string;
}

function DecideButtons({ request }: { request: AssetRequest }) {
    const approve = useForm({ status: 'approved' });
    const reject = useForm({ status: 'rejected', rejected_reason: '' });
    const [rejecting, setRejecting] = useState(false);

    if (request.status !== 'pending') {
        return null;
    }

    if (rejecting) {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    reject.patch(route('asset-requests.decide', request.id), { preserveScroll: true, onSuccess: () => setRejecting(false) });
                }}
                className="flex items-center gap-2"
            >
                <TextInput
                    placeholder="Alasan penolakan"
                    value={reject.data.rejected_reason}
                    onChange={(e) => reject.setData('rejected_reason', e.target.value)}
                />
                <PrimaryButton disabled={reject.processing}>Kirim</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setRejecting(false)}>
                    Batal
                </SecondaryButton>
            </form>
        );
    }

    return (
        <span className="flex gap-2">
            <PrimaryButton
                type="button"
                disabled={approve.processing}
                onClick={() => approve.patch(route('asset-requests.decide', request.id), { preserveScroll: true })}
            >
                Setujui
            </PrimaryButton>
            <DangerButton type="button" onClick={() => setRejecting(true)}>
                Tolak
            </DangerButton>
        </span>
    );
}

function FulfillForm({ request }: { request: AssetRequest }) {
    const form = useForm({ fulfilled_asset_id: '' });

    if (request.status !== 'approved') {
        return null;
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.post(route('asset-requests.fulfill', request.id), { preserveScroll: true });
            }}
            className="flex items-center gap-2"
        >
            <TextInput
                type="number"
                placeholder="ID aset yang diserahkan"
                value={form.data.fulfilled_asset_id}
                onChange={(e) => form.setData('fulfilled_asset_id', e.target.value)}
            />
            <PrimaryButton disabled={form.processing}>Penuhi</PrimaryButton>
        </form>
    );
}

export default function Index({
    requests,
    pegawaiOptions,
    categoryOptions,
    can,
}: PageProps<{ requests: AssetRequest[]; pegawaiOptions: PegawaiOption[]; categoryOptions: CategoryOption[]; can: { createPegawai: boolean; createUnit: boolean } }>) {
    const form = useForm<{ type: 'pegawai' | 'unit'; pegawai_id: number | ''; category_id: number | ''; keterangan: string }>({
        type: can.createPegawai ? 'pegawai' : 'unit',
        pegawai_id: '',
        category_id: '',
        keterangan: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('asset-requests.store'), { preserveScroll: true, onSuccess: () => form.reset('pegawai_id', 'keterangan') });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Request Aset</h1>}>
            <Head title="Request Aset" />

            {(can.createPegawai || can.createUnit) && (
                <form onSubmit={submit} className="mb-6 flex flex-wrap items-start gap-2 rounded-lg bg-white p-4 shadow-sm">
                    <select value={form.data.type} onChange={(e) => form.setData('type', e.target.value as 'pegawai' | 'unit')} className="rounded-md border-gray-300 text-sm shadow-sm">
                        {can.createPegawai && <option value="pegawai">Untuk Pegawai</option>}
                        {can.createUnit && <option value="unit">Kelurahan ke Kecamatan</option>}
                    </select>
                    {form.data.type === 'pegawai' && (
                        <select value={form.data.pegawai_id} onChange={(e) => form.setData('pegawai_id', Number(e.target.value))} className="rounded-md border-gray-300 text-sm shadow-sm">
                            <option value="">— Pilih pegawai —</option>
                            {pegawaiOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.nama}
                                </option>
                            ))}
                        </select>
                    )}
                    <select value={form.data.category_id} onChange={(e) => form.setData('category_id', Number(e.target.value))} className="rounded-md border-gray-300 text-sm shadow-sm">
                        <option value="">— Kategori aset —</option>
                        {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <TextInput placeholder="Keterangan" value={form.data.keterangan} onChange={(e) => form.setData('keterangan', e.target.value)} className="min-w-64 flex-1" />
                    <PrimaryButton disabled={form.processing}>Ajukan</PrimaryButton>
                </form>
            )}

            <div className="space-y-3">
                {requests.map((request) => (
                    <div key={request.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <span className="font-semibold">{request.category.parent ? `${request.category.parent.name} / ${request.category.name}` : request.category.name}</span>{' '}
                                <span className="text-xs text-gray-500">
                                    {request.type === 'pegawai' ? `untuk ${request.pegawai?.nama}` : `dari ${request.requesting_unit.name}`}
                                </span>
                            </div>
                            <span className="text-xs uppercase text-gray-500">{request.status}</span>
                        </div>
                        {request.keterangan && <p className="mt-1 text-sm text-gray-600">{request.keterangan}</p>}
                        {request.rejected_reason && <p className="mt-1 text-sm text-red-700">Ditolak: {request.rejected_reason}</p>}
                        <div className="mt-2">
                            <DecideButtons request={request} />
                            <FulfillForm request={request} />
                        </div>
                    </div>
                ))}
                {requests.length === 0 && <p className="text-sm text-gray-500">Belum ada request.</p>}
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Manual verification**

Log in as `admin.kelurahan@simaset.test`, submit a pegawai-type request; log in as `lurah@simaset.test`, approve it; log in back as the admin, fulfill it with a real asset id from `/pegawais` scoped assets, and confirm the asset's holder changes.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/AssetRequests/Index.tsx resources/js/types/index.d.ts resources/js/config/navigation.ts
git commit -m "feat: add asset request page and navigation"
```
