# Asset Damage/Loss Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kecamatan/kelurahan can report an asset as damaged or lost on behalf of the pegawai currently holding it (with photos and a chronology), the pegawai's camat/lurah approves or rejects it, and on approval the asset's `kondisi` updates automatically — no further manual step.

**Architecture:** One table, `asset_reports`, with a single-step `pending → approved/rejected` status (no `fulfilled` state — approval's effect on `Asset.kondisi` is automatic, unlike Asset Request's manual fulfillment). Reuses the existing polymorphic `asset_photos` relation instead of a new photo table. Follows the existing convention: thin Controller → FormRequest → Service → Policy.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-09-24-simaset-design.md` (see "Data Model — Request & Laporan Aset", alur h).

**Depends on:** `docs/superpowers/plans/2026-09-26-pegawai-data.md` must be merged first (`Pegawai` model, `pegawais` table). Independent of `2026-09-26-asset-request.md` — the two can be implemented in either order, or in parallel.

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:`.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Policy.
- Reuses `AssetPhoto`'s existing polymorphic relation (`photoable`) — do not create a new photo table.
- Reuses the existing `Kondisi` enum (`baik`/`rusak_ringan`/`rusak_berat`/`hilang`) for `kondisi_baru` — do not introduce a parallel status enum for the asset's post-report condition.
- `pegawai_id` on a report must match the asset's *current* holder at submission time (`Asset.current_holder_id`) — this is validated, not assumed.
- Approval routing (fixed): camat if the pegawai's unit is a kecamatan, lurah if kelurahan — the same routing rule as the Asset Request plan's pegawai-type requests.
- Approval effect is automatic and unconditional: `Asset.kondisi` updates the moment the report is approved, with no separate manual step (contrast with Asset Request's manual `fulfill`).
- Photos: `public` disk, jpg/jpeg/png/webp, ≤ 5 MB each, ≤ 10 per report (same limits as `AssetService`'s asset photos).
- UI copy in Bahasa Indonesia.

## Review Focus

- The `pegawai_id` submitted doesn't match the asset's actual `current_holder_id` (e.g. admin picks the wrong pegawai, or the asset already changed hands) → must be rejected with a validation error, not silently recorded → pinned in Task 3.
- Reporting `type = hilang` but the admin also sends a `kondisi_baru` value → the stored condition must still resolve to `hilang`, not whatever was smuggled in → pinned in Task 2.
- Approving the same report twice → the second call must be rejected, not double-write the asset's condition/history → pinned in Task 2.
- Camat tries to approve a report for a pegawai in a *kelurahan* (only that kelurahan's lurah may) → must be rejected (403) → pinned in Task 3.
- An admin submits more than 10 photos, or a non-image file renamed `.jpg` → must be rejected with a message, not stored → pinned in Task 3.

---

### Task 1: `asset_reports` table, enum, model, factory

**Files:**
- Create: `app/Enums/AssetReportType.php`
- Create: `app/Enums/AssetReportStatus.php`
- Create: `database/migrations/2026_09_26_000001_create_asset_reports_table.php`
- Create: `app/Models/AssetReport.php`
- Create: `database/factories/AssetReportFactory.php`
- Test: `tests/Feature/AssetReportModelTest.php`

**Interfaces:**
- Consumes: `Asset`, `Pegawai`, `AssetPhoto`, `Kondisi` enum (existing/prior plan).
- Produces: `App\Enums\AssetReportType` (`Rusak='rusak'`, `Hilang='hilang'`), `App\Enums\AssetReportStatus` (`Pending='pending'`, `Approved='approved'`, `Rejected='rejected'`), both with `label(): string`. `App\Models\AssetReport` with relations `asset()`, `pegawai()`, `approvedBy()`, `createdBy()` (`BelongsTo`), `photos(): MorphMany`, `scopeVisibleTo(Builder $query, User $user): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetReportModelTest.php`:

```php
<?php

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\Pegawai;
use Illuminate\Support\Facades\Storage;

it('casts type, status and kondisi_baru and links relations', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id]);
    $report = AssetReport::factory()->create([
        'asset_id' => $asset->id,
        'pegawai_id' => $pegawai->id,
        'type' => 'rusak',
        'kondisi_baru' => 'rusak_ringan',
        'status' => 'pending',
    ]);

    expect($report->type)->toBe(AssetReportType::Rusak)
        ->and($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->kondisi_baru)->toBe(Kondisi::RusakRingan)
        ->and($report->asset->is($asset))->toBeTrue()
        ->and($report->pegawai->is($pegawai))->toBeTrue();
});

it('attaches photos through the existing polymorphic relation', function () {
    Storage::fake('public');
    $report = AssetReport::factory()->create();

    $report->photos()->create(['path' => 'asset-reports/1/a.jpg']);

    expect($report->photos()->count())->toBe(1)
        ->and($report->photos()->first()->photoable->is($report))->toBeTrue();
});

it('scopes visibility to the reporting pegawai unit', function () {
    $kec = makeKecamatan();
    $kel = makeKelurahan($kec, 'Kelurahan Tembesi');
    $pegawaiKel = Pegawai::factory()->create(['unit_id' => $kel->id]);
    $pegawaiKec = Pegawai::factory()->create(['unit_id' => $kec->id]);

    AssetReport::factory()->create(['pegawai_id' => $pegawaiKel->id, 'asset_id' => Asset::factory()->create(['unit_id' => $kel->id])->id]);
    AssetReport::factory()->create(['pegawai_id' => $pegawaiKec->id, 'asset_id' => Asset::factory()->create(['unit_id' => $kec->id])->id]);

    $lurah = userWithRole('lurah', $kel);

    expect(AssetReport::query()->visibleTo($lurah)->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportModelTest.php`
Expected: FAIL — `Class "App\Models\AssetReport" not found`.

- [ ] **Step 3: Create the enums**

Create `app/Enums/AssetReportType.php`:

```php
<?php

namespace App\Enums;

enum AssetReportType: string
{
    case Rusak = 'rusak';
    case Hilang = 'hilang';

    public function label(): string
    {
        return match ($this) {
            self::Rusak => 'Rusak',
            self::Hilang => 'Hilang',
        };
    }
}
```

Create `app/Enums/AssetReportStatus.php`:

```php
<?php

namespace App\Enums;

enum AssetReportStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
        };
    }
}
```

- [ ] **Step 4: Create the migration**

Create `database/migrations/2026_09_26_000001_create_asset_reports_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->restrictOnDelete();
            $table->foreignId('pegawai_id')->constrained('pegawais')->restrictOnDelete();
            $table->string('type');
            $table->string('kondisi_baru')->nullable();
            $table->text('kronologi');
            $table->string('status')->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_reports');
    }
};
```

- [ ] **Step 5: Create the model**

Create `app/Models/AssetReport.php`:

```php
<?php

namespace App\Models;

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class AssetReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'asset_id',
        'pegawai_id',
        'type',
        'kondisi_baru',
        'kronologi',
        'status',
        'approved_by',
        'approved_at',
        'rejected_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AssetReportType::class,
            'kondisi_baru' => Kondisi::class,
            'status' => AssetReportStatus::class,
            'approved_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids !== null) {
            $query->whereHas('pegawai', fn (Builder $q) => $q->whereIn('unit_id', $ids));
        }
    }
}
```

- [ ] **Step 6: Create the factory**

Create `database/factories/AssetReportFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\Pegawai;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetReport> */
class AssetReportFactory extends Factory
{
    public function definition(): array
    {
        $pegawai = Pegawai::factory()->create();
        $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id, 'unit_id' => $pegawai->unit_id]);

        return [
            'asset_id' => $asset->id,
            'pegawai_id' => $pegawai->id,
            'type' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'kronologi' => 'Rusak karena jatuh.',
            'status' => 'pending',
            'created_by' => fn () => \App\Models\User::factory()->create()->id,
        ];
    }
}
```

- [ ] **Step 7: Migrate and run the test**

```bash
php artisan migrate
php artisan test tests/Feature/AssetReportModelTest.php
```

Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add app/Enums/AssetReportType.php app/Enums/AssetReportStatus.php app/Models/AssetReport.php database/migrations/2026_09_26_000001_create_asset_reports_table.php database/factories/AssetReportFactory.php tests/Feature/AssetReportModelTest.php
git commit -m "feat: add asset_reports table, enums and model"
```

---

### Task 2: `AssetReportService` — create with photos, decide with automatic effect

**Files:**
- Create: `app/Services/AssetReportService.php`
- Test: `tests/Feature/AssetReportServiceTest.php`

**Interfaces:**
- Consumes: `AssetReport`, enums (Task 1), `Asset`, `Kondisi`.
- Produces:
  - `AssetReportService::create(array $data, array $photos, User $actor): AssetReport` — `$data` keys: `asset_id`, `pegawai_id`, `type`, `kondisi_baru` (only used when `type=rusak`), `kronologi`. Stores `$photos` (list of `UploadedFile`) via the polymorphic relation.
  - `AssetReportService::decide(AssetReport $report, string $status, User $actor, ?string $reason = null): AssetReport` — throws `InvalidArgumentException` unless `$report->status` is `pending`. On `approved`, updates `Asset.kondisi` (to `kondisi_baru` for `rusak`, to `Kondisi::Hilang` for `hilang` regardless of what `kondisi_baru` holds) and writes an `AssetHistory` row, in the same transaction.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetReportServiceTest.php`:

```php
<?php

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\Pegawai;
use App\Services\AssetReportService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kel = makeKelurahan(makeKecamatan(), 'Kelurahan Tembesi');
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    $this->asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'current_holder_id' => $this->pegawai->id, 'kondisi' => 'baik']);
    $this->admin = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->service = app(AssetReportService::class);
});

it('creates a rusak report with photos', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'rusak',
        'kondisi_baru' => 'rusak_ringan',
        'kronologi' => 'Jatuh saat dipindahkan.',
    ], [UploadedFile::fake()->image('rusak.jpg')], $this->admin);

    expect($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->photos)->toHaveCount(1);
});

it('forces kondisi_baru to null for a hilang report even if one is smuggled in', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'hilang',
        'kondisi_baru' => 'rusak_berat',
        'kronologi' => 'Hilang saat pindah kantor.',
    ], [], $this->admin);

    expect($report->kondisi_baru)->toBeNull();
});

it('approving a rusak report updates the asset kondisi and writes history', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'rusak',
        'kondisi_baru' => 'rusak_berat',
        'kronologi' => 'Terbakar.',
    ], [], $this->admin);

    $this->service->decide($report, 'approved', $this->lurah);

    expect($this->asset->refresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->refresh()->status)->toBe(AssetReportStatus::Approved)
        ->and($this->asset->histories()->first()->event)->toBe('dilaporkan_rusak');
});

it('approving a hilang report sets kondisi to hilang regardless of kondisi_baru', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'hilang',
        'kronologi' => 'Hilang.',
    ], [], $this->admin);

    $this->service->decide($report, 'approved', $this->lurah);

    expect($this->asset->refresh()->kondisi)->toBe(Kondisi::Hilang)
        ->and($this->asset->histories()->first()->event)->toBe('dilaporkan_hilang');
});

it('rejecting a report does not touch the asset kondisi', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'rusak',
        'kondisi_baru' => 'rusak_ringan',
        'kronologi' => 'Retak.',
    ], [], $this->admin);

    $this->service->decide($report, 'rejected', $this->lurah, 'Tidak ada bukti kerusakan');

    expect($this->asset->refresh()->kondisi)->toBe(Kondisi::Baik)
        ->and($report->refresh()->rejected_reason)->toBe('Tidak ada bukti kerusakan');
});

it('refuses to decide the same report twice', function () {
    $report = $this->service->create([
        'asset_id' => $this->asset->id,
        'pegawai_id' => $this->pegawai->id,
        'type' => 'rusak',
        'kondisi_baru' => 'rusak_ringan',
        'kronologi' => 'Retak.',
    ], [], $this->admin);
    $this->service->decide($report, 'approved', $this->lurah);

    $this->service->decide($report, 'approved', $this->lurah);
})->throws(InvalidArgumentException::class);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportServiceTest.php`
Expected: FAIL — `Target class [App\Services\AssetReportService] does not exist.`

- [ ] **Step 3: Create the service**

Create `app/Services/AssetReportService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetReportService
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function create(array $data, array $photos, User $actor): AssetReport
    {
        return DB::transaction(function () use ($data, $photos, $actor) {
            $type = AssetReportType::from($data['type']);

            $report = AssetReport::create([
                'asset_id' => $data['asset_id'],
                'pegawai_id' => $data['pegawai_id'],
                'type' => $type,
                'kondisi_baru' => $type === AssetReportType::Rusak ? $data['kondisi_baru'] : null,
                'kronologi' => $data['kronologi'],
                'status' => AssetReportStatus::Pending,
                'created_by' => $actor->id,
            ]);

            foreach ($photos as $photo) {
                $report->photos()->create(['path' => $photo->store("asset-reports/{$report->id}", 'public')]);
            }

            return $report;
        });
    }

    public function decide(AssetReport $report, string $status, User $actor, ?string $reason = null): AssetReport
    {
        if ($report->status !== AssetReportStatus::Pending) {
            throw new InvalidArgumentException('Laporan ini sudah diproses sebelumnya.');
        }

        return DB::transaction(function () use ($report, $status, $actor, $reason) {
            $report->update([
                'status' => $status,
                'approved_by' => $actor->id,
                'approved_at' => now(),
                'rejected_reason' => $status === AssetReportStatus::Rejected->value ? $reason : null,
            ]);

            if ($status === AssetReportStatus::Approved->value) {
                $kondisiBaru = $report->type === AssetReportType::Hilang ? Kondisi::Hilang : $report->kondisi_baru;
                $asset = $report->asset;

                $asset->update(['kondisi' => $kondisiBaru]);
                $asset->histories()->create([
                    'event' => $report->type === AssetReportType::Hilang ? 'dilaporkan_hilang' : 'dilaporkan_rusak',
                    'unit_id' => $asset->unit_id,
                    'current_holder_id' => $asset->current_holder_id,
                    'kondisi' => $kondisiBaru,
                    'user_id' => $actor->id,
                    'keterangan' => $report->kronologi,
                ]);
            }

            return $report;
        });
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test tests/Feature/AssetReportServiceTest.php`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetReportService.php tests/Feature/AssetReportServiceTest.php
git commit -m "feat: add AssetReportService with automatic approval effect"
```

---

### Task 3: `AssetReportPolicy`, FormRequests, `AssetReportController`, routes

**Files:**
- Create: `app/Policies/AssetReportPolicy.php`
- Create: `app/Http/Requests/StoreAssetReportRequest.php`
- Create: `app/Http/Requests/DecideAssetReportRequest.php`
- Create: `app/Http/Controllers/AssetReportController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/AssetReportManagementTest.php`

**Interfaces:**
- Consumes: `AssetReportService` (Task 2), `AssetReport` (Task 1).
- Produces: Routes (all `auth`): `GET /asset-reports` `asset-reports.index`, `POST /asset-reports` `asset-reports.store`, `PATCH /asset-reports/{assetReport}/decide` `asset-reports.decide`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/AssetReportManagementTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\Pegawai;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    $this->asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'current_holder_id' => $this->pegawai->id]);
});

it('lets admin_kelurahan submit a report for the actual current holder', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-reports', [
            'asset_id' => $this->asset->id,
            'pegawai_id' => $this->pegawai->id,
            'type' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'kronologi' => 'Jatuh.',
            'photos' => [UploadedFile::fake()->image('a.jpg')],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');
});

it('rejects a report where pegawai_id does not match the asset current holder', function () {
    $someoneElse = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-reports', [
            'asset_id' => $this->asset->id,
            'pegawai_id' => $someoneElse->id,
            'type' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'kronologi' => 'Jatuh.',
        ])
        ->assertSessionHasErrors('asset_id');
});

it('rejects more than 10 photos', function () {
    $photos = array_map(fn ($i) => UploadedFile::fake()->image("foto{$i}.jpg"), range(1, 11));

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/asset-reports', [
            'asset_id' => $this->asset->id,
            'pegawai_id' => $this->pegawai->id,
            'type' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'kronologi' => 'Jatuh.',
            'photos' => $photos,
        ])
        ->assertSessionHasErrors('photos');
});

it('lets lurah approve a report for their own kelurahan and forbids camat', function () {
    $report = AssetReport::factory()->create(['asset_id' => $this->asset->id, 'pegawai_id' => $this->pegawai->id]);

    $this->actingAs(userWithRole('camat', $this->kec))
        ->patch("/asset-reports/{$report->id}/decide", ['status' => 'approved'])
        ->assertForbidden();

    $this->actingAs(userWithRole('lurah', $this->kel))
        ->patch("/asset-reports/{$report->id}/decide", ['status' => 'approved'])
        ->assertSessionHas('success');

    expect($this->asset->refresh()->kondisi->value)->toBe('rusak_ringan');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportManagementTest.php`
Expected: FAIL — route `asset-reports.store` not found.

- [ ] **Step 3: Create the policy**

Create `app/Policies/AssetReportPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\AssetReport;
use App\Models\Pegawai;
use App\Models\User;

class AssetReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function create(User $user, Pegawai $pegawai): bool
    {
        return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->canAccessUnit($pegawai->unit);
    }

    public function decide(User $user, AssetReport $report): bool
    {
        $unit = $report->pegawai->unit;

        return ($unit->isKecamatan() && $user->hasRole('camat') && $user->unit_id === $unit->id)
            || ($unit->isKelurahan() && $user->hasRole('lurah') && $user->unit_id === $unit->id);
    }
}
```

- [ ] **Step 4: Create the FormRequests**

Create `app/Http/Requests/StoreAssetReportRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Models\AssetReport;
use App\Models\Pegawai;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreAssetReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $pegawai = Pegawai::find($this->input('pegawai_id'));

        return $pegawai !== null && $this->user()->can('create', [AssetReport::class, $pegawai]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', Rule::exists('assets', 'id')],
            'pegawai_id' => ['required', 'integer', Rule::exists('pegawais', 'id')],
            'type' => ['required', Rule::in(['rusak', 'hilang'])],
            'kondisi_baru' => ['required_if:type,rusak', 'nullable', Rule::in(['rusak_ringan', 'rusak_berat'])],
            'kronologi' => ['required', 'string'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['image', 'max:5120'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $asset = \App\Models\Asset::find($this->input('asset_id'));

                if ($asset && (int) $asset->current_holder_id !== (int) $this->input('pegawai_id')) {
                    $validator->errors()->add('asset_id', 'Aset ini bukan sedang dipegang oleh pegawai yang dipilih.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kronologi.required' => 'Kronologi wajib diisi.',
            'photos.max' => 'Maksimal 10 foto per laporan.',
            'photos.*.image' => 'Setiap lampiran harus berupa gambar.',
        ];
    }
}
```

Create `app/Http/Requests/DecideAssetReportRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideAssetReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('decide', $this->route('assetReport'));
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

- [ ] **Step 5: Create the controller and routes**

Create `app/Http/Controllers/AssetReportController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\DecideAssetReportRequest;
use App\Http\Requests\StoreAssetReportRequest;
use App\Models\AssetReport;
use App\Models\Pegawai;
use App\Services\AssetReportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetReportController extends Controller
{
    public function __construct(private readonly AssetReportService $service) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetReport::class);
        $user = $request->user();

        return Inertia::render('AssetReports/Index', [
            'reports' => AssetReport::query()
                ->visibleTo($user)
                ->with(['asset', 'pegawai.unit', 'photos'])
                ->latest()
                ->get(),
            'pegawaiOptions' => Pegawai::query()->visibleTo($user)->orderBy('nama')->get(['id', 'nama', 'unit_id']),
            'can' => ['create' => $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan'])],
        ]);
    }

    public function store(StoreAssetReportRequest $request): RedirectResponse
    {
        $this->service->create($request->validated(), $request->file('photos', []), $request->user());

        return back()->with('success', 'Laporan berhasil diajukan.');
    }

    public function decide(DecideAssetReportRequest $request, AssetReport $assetReport): RedirectResponse
    {
        try {
            $this->service->decide($assetReport, $request->validated('status'), $request->user(), $request->validated('rejected_reason'));
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['status' => $e->getMessage()]);
        }

        return back()->with('success', 'Laporan berhasil diproses.');
    }
}
```

In `routes/web.php`, add the import `use App\Http\Controllers\AssetReportController;` and, inside the `auth` middleware group:

```php
    Route::get('/asset-reports', [AssetReportController::class, 'index'])->name('asset-reports.index');
    Route::post('/asset-reports', [AssetReportController::class, 'store'])->name('asset-reports.store');
    Route::patch('/asset-reports/{assetReport}/decide', [AssetReportController::class, 'decide'])->name('asset-reports.decide');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test tests/Feature/AssetReportManagementTest.php`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add app/Policies/AssetReportPolicy.php app/Http/Requests/StoreAssetReportRequest.php app/Http/Requests/DecideAssetReportRequest.php app/Http/Controllers/AssetReportController.php routes/web.php tests/Feature/AssetReportManagementTest.php
git commit -m "feat: add asset report policy, HTTP layer and routes"
```

---

### Task 4: Frontend — Asset Report page and navigation

**Files:**
- Create: `resources/js/Pages/AssetReports/Index.tsx`
- Modify: `resources/js/types/index.d.ts`
- Modify: `resources/js/config/navigation.ts`

**Interfaces:**
- Consumes: `asset-reports.*` routes (Task 3).

- [ ] **Step 1: Add TS types**

In `resources/js/types/index.d.ts`, add:

```typescript
export interface AssetReport {
    id: number;
    type: 'rusak' | 'hilang';
    kondisi_baru: 'rusak_ringan' | 'rusak_berat' | null;
    kronologi: string;
    status: 'pending' | 'approved' | 'rejected';
    rejected_reason: string | null;
    asset: { id: number; nama_aset: string; kode_barang: string };
    pegawai: { id: number; nama: string; unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } };
    photos: { id: number; url: string }[];
}
```

- [ ] **Step 2: Add navigation entries**

In `resources/js/config/navigation.ts`, add a `LAPOR_ASET: NavItem = { label: 'Lapor Rusak/Hilang', href: '/asset-reports' };` constant and add it to `camat`, `admin_kecamatan`, `admin_kelurahan`, and `lurah` arrays (kasubag doesn't approve these — leave it off `kasubag` unless it's already there for another reason).

- [ ] **Step 3: Build the page**

Create `resources/js/Pages/AssetReports/Index.tsx`:

```tsx
import DangerButton from '@/Components/DangerButton';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetReport, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface PegawaiOption {
    id: number;
    nama: string;
    unit_id: number;
}

function DecideButtons({ report }: { report: AssetReport }) {
    const approve = useForm({ status: 'approved' });
    const reject = useForm({ status: 'rejected', rejected_reason: '' });
    const [rejecting, setRejecting] = useState(false);

    if (report.status !== 'pending') {
        return null;
    }

    if (rejecting) {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    reject.patch(route('asset-reports.decide', report.id), { preserveScroll: true, onSuccess: () => setRejecting(false) });
                }}
                className="flex items-center gap-2"
            >
                <TextInput placeholder="Alasan penolakan" value={reject.data.rejected_reason} onChange={(e) => reject.setData('rejected_reason', e.target.value)} />
                <PrimaryButton disabled={reject.processing}>Kirim</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setRejecting(false)}>
                    Batal
                </SecondaryButton>
            </form>
        );
    }

    return (
        <span className="flex gap-2">
            <PrimaryButton type="button" disabled={approve.processing} onClick={() => approve.patch(route('asset-reports.decide', report.id), { preserveScroll: true })}>
                Setujui
            </PrimaryButton>
            <DangerButton type="button" onClick={() => setRejecting(true)}>
                Tolak
            </DangerButton>
        </span>
    );
}

export default function Index({ reports, pegawaiOptions, can }: PageProps<{ reports: AssetReport[]; pegawaiOptions: PegawaiOption[]; can: { create: boolean } }>) {
    const form = useForm<{ asset_id: number | ''; pegawai_id: number | ''; type: 'rusak' | 'hilang'; kondisi_baru: string; kronologi: string; photos: File[] }>({
        asset_id: '',
        pegawai_id: '',
        type: 'rusak',
        kondisi_baru: 'rusak_ringan',
        kronologi: '',
        photos: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('asset-reports.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Lapor Aset Rusak/Hilang</h1>}>
            <Head title="Lapor Aset Rusak/Hilang" />

            {can.create && (
                <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-white p-4 shadow-sm md:grid-cols-3">
                    <select value={form.data.pegawai_id} onChange={(e) => form.setData('pegawai_id', Number(e.target.value))} className="rounded-md border-gray-300 text-sm shadow-sm">
                        <option value="">— Pegawai pemegang aset —</option>
                        {pegawaiOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nama}
                            </option>
                        ))}
                    </select>
                    <TextInput
                        type="number"
                        placeholder="ID aset"
                        value={form.data.asset_id}
                        onChange={(e) => form.setData('asset_id', Number(e.target.value))}
                    />
                    <select value={form.data.type} onChange={(e) => form.setData('type', e.target.value as 'rusak' | 'hilang')} className="rounded-md border-gray-300 text-sm shadow-sm">
                        <option value="rusak">Rusak</option>
                        <option value="hilang">Hilang</option>
                    </select>
                    {form.data.type === 'rusak' && (
                        <select value={form.data.kondisi_baru} onChange={(e) => form.setData('kondisi_baru', e.target.value)} className="rounded-md border-gray-300 text-sm shadow-sm">
                            <option value="rusak_ringan">Rusak Ringan</option>
                            <option value="rusak_berat">Rusak Berat</option>
                        </select>
                    )}
                    <textarea
                        placeholder="Kronologi kerusakan/kehilangan"
                        value={form.data.kronologi}
                        onChange={(e) => form.setData('kronologi', e.target.value)}
                        className="col-span-2 rounded-md border-gray-300 text-sm shadow-sm md:col-span-3"
                    />
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => form.setData('photos', Array.from(e.target.files ?? []))}
                        className="col-span-2 text-sm md:col-span-3"
                    />
                    <PrimaryButton disabled={form.processing}>Kirim Laporan</PrimaryButton>
                </form>
            )}

            <div className="space-y-3">
                {reports.map((report) => (
                    <div key={report.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <span className="font-semibold">{report.asset.nama_aset}</span>{' '}
                                <span className="text-xs text-gray-500">
                                    {report.type === 'rusak' ? `Rusak (${report.kondisi_baru})` : 'Hilang'} — {report.pegawai.nama}
                                </span>
                            </div>
                            <span className="text-xs uppercase text-gray-500">{report.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{report.kronologi}</p>
                        {report.rejected_reason && <p className="mt-1 text-sm text-red-700">Ditolak: {report.rejected_reason}</p>}
                        {report.photos.length > 0 && (
                            <div className="mt-2 flex gap-2">
                                {report.photos.map((photo) => (
                                    <img key={photo.id} src={photo.url} className="h-16 w-16 rounded object-cover" />
                                ))}
                            </div>
                        )}
                        <div className="mt-2">
                            <DecideButtons report={report} />
                        </div>
                    </div>
                ))}
                {reports.length === 0 && <p className="text-sm text-gray-500">Belum ada laporan.</p>}
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Manual verification**

Log in as `admin.kelurahan@simaset.test`, submit a "rusak" report with a photo for a pegawai holding an asset in that unit; log in as `lurah@simaset.test`, approve it; confirm the asset's `kondisi` changed without any extra manual step.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/AssetReports/Index.tsx resources/js/types/index.d.ts resources/js/config/navigation.ts
git commit -m "feat: add asset report page and navigation"
```
