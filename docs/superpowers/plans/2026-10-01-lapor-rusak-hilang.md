# Lapor Rusak/Hilang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kecamatan/kelurahan can report an asset in their unit as damaged or lost (with photos and a chronology); the unit's superior (Camat for a kecamatan asset, Lurah for a kelurahan asset) approves through the generic approval engine; on approval the asset's `kondisi` changes automatically and is logged. A lost asset can no longer be mutated or reported again.

**Architecture:** New table `asset_reports` whose model implements `Approvable` + `HandlesApprovalOutcome`, submitted to a new workflow `lapor_rusak_hilang` (one `atasan_unit` step, capability `subject`) so the inbox, notifications, cancel, reassign and the Pengaturan Alur UI apply for free. `AssetReportService` validates and creates; `AssetReportEffect` re-validates under a row lock and applies the condition change. Photos reuse the polymorphic `asset_photos`.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-10-01-lapor-rusak-hilang-design.md`

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:` — no MySQL-only SQL.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Policy. Controllers catch `InvalidArgumentException` from services and flash `error` (pattern in `AssetMutationController::store`).
- Reporters are only `admin_kecamatan` / `admin_kelurahan`, only for assets in their own unit (`User::canAccessUnit()`; never re-derive scoping).
- One `pending` report per asset. Assets that are `dalam_proses` may still be reported. No asset locking.
- Photos: `public` disk, jpg/jpeg/png/webp, ≤ 5 MB each, ≤ 10 per report; `rusak` needs ≥ 1 photo, `hilang` optional. Reuse `AssetPhoto` (no new photo table).
- Reuse `Kondisi` enum (`baik`/`rusak_ringan`/`rusak_berat`/`hilang`); add `severity()` for ordering, no parallel enum.
- Approval goes through `ApprovalWorkflowService` (workflow code `lapor_rusak_hilang`); do not add a separate approve/reject endpoint. The submitter can never approve their own request (engine guard already exists).
- UI copy in Bahasa Indonesia.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution) line. Stage files by explicit path (never `git add docs` / `git add .`): the untracked `docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx` must stay out of commits.**

## Review Focus

- **Approving after the asset's condition changed must fail clearly, never overwrite with a better/equal condition** (e.g. asset already `rusak_berat`, or already `hilang`, when the report is applied). → Task 2.
- **A second report for the same asset while one is pending must be refused**, including two near-simultaneous submissions (row lock). → Task 3.
- **A crafted `asset_id` from another unit, or a non-admin role, must get 403 over HTTP** (the UI hides such assets, but that is not a boundary). → Task 4.
- **Bad uploads (11 photos, a non-image renamed `.jpg`, >5 MB, `rusak` without photo) must be rejected and create no report and store no files.** → Tasks 3 and 4.
- **A lost asset must be refused in Mutasi even via a crafted POST**, not only hidden in the form. → Task 5.

## File Structure

| File | Responsibility |
|---|---|
| `app/Enums/AssetReportType.php`, `AssetReportStatus.php` (new) | `rusak/hilang`; `pending/approved/rejected/cancelled` |
| `app/Enums/Kondisi.php` | + `severity()` |
| `app/Models/AssetReport.php` (new), `Asset.php` | model, relations; `Asset::reports()` |
| `database/migrations/2026_10_01_100000_create_asset_reports_table.php`, `database/factories/AssetReportFactory.php` (new) | schema, factory |
| `app/Support/WorkflowDefaults.php`, `config/workflow.php` | `lapor_rusak_hilang` default, capability, effect |
| `app/Services/AssetReportEffect.php`, `AssetReportService.php` (new) | apply on approval; create + validate |
| `app/Policies/AssetReportPolicy.php`, `app/Http/Requests/StoreAssetReportRequest.php`, `app/Http/Controllers/AssetReportController.php` (new), `routes/web.php` | HTTP layer |
| `app/Services/AssetMutationService.php`, `app/Http/Controllers/AssetMutationController.php` | block lost assets |
| `resources/js/Pages/AssetReports/{Index,Create,Show}.tsx`, `resources/js/lib/assetReport.ts` (new), `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts` | UI |

---

## Task 1: Schema, enums, model and factory

**Files:**
- Create: `app/Enums/AssetReportType.php`, `app/Enums/AssetReportStatus.php`
- Modify: `app/Enums/Kondisi.php` (add `severity()`), `app/Models/Asset.php` (add `reports()`)
- Create: `database/migrations/2026_10_01_100000_create_asset_reports_table.php`
- Create: `app/Models/AssetReport.php`, `database/factories/AssetReportFactory.php`
- Test: `tests/Feature/AssetReportModelTest.php`

**Interfaces:**
- Produces: `AssetReportType` (`Rusak='rusak'`, `Hilang='hilang'`, `label()`), `AssetReportStatus` (`Pending`, `Approved`, `Rejected`, `Cancelled`, `label()`), `Kondisi::severity(): int` (baik 0, rusak_ringan 1, rusak_berat 2, hilang 3), `AssetReport` model (`asset()`, `unit()`, `pegawai()`, `creator()`, `photos()`, `approvalRequest()`; casts `jenis`, `kondisi_baru`, `status`; `approvalTitle()`, `approvalShowUrl()`, `onApprovalRejected()`, `onApprovalCancelled()`), `Asset::reports(): HasMany`, `AssetReport::factory()`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetReportModelTest.php`:

```php
<?php

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;

it('orders conditions by severity', function () {
    expect(Kondisi::Baik->severity())->toBeLessThan(Kondisi::RusakRingan->severity())
        ->and(Kondisi::RusakRingan->severity())->toBeLessThan(Kondisi::RusakBerat->severity())
        ->and(Kondisi::RusakBerat->severity())->toBeLessThan(Kondisi::Hilang->severity());
});

it('creates a report with casts, relations and photos', function () {
    $unit = makeKecamatan();
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create(['asset_id' => $asset->id, 'unit_id' => $unit->id]);

    $report->photos()->create(['path' => 'asset-reports/1/a.jpg']);

    expect($report->jenis)->toBe(AssetReportType::Rusak)
        ->and($report->kondisi_baru)->toBe(Kondisi::RusakRingan)
        ->and($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->asset->is($asset))->toBeTrue()
        ->and($report->unit->is($unit))->toBeTrue()
        ->and($report->photos)->toHaveCount(1)
        ->and($asset->reports)->toHaveCount(1)
        ->and($report->approvalTitle())->toBe("Laporan Rusak #{$report->nomor_laporan}");
});

it('releases nothing on the asset when rejected or cancelled, only its own status', function () {
    $unit = makeKecamatan();
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create(['asset_id' => $asset->id, 'unit_id' => $unit->id]);

    $report->onApprovalRejected();
    expect($report->fresh()->status)->toBe(AssetReportStatus::Rejected);

    $report->update(['status' => 'pending']);
    $report->onApprovalCancelled();
    expect($report->fresh()->status)->toBe(AssetReportStatus::Cancelled)
        ->and($asset->fresh()->kondisi)->toBe(Kondisi::Baik);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportModelTest.php`
Expected: FAIL (`Class "App\Models\AssetReport" not found` / `Call to undefined method ...severity()`).

- [ ] **Step 3: Enums, `severity()`, migration, model, factory**

`app/Enums/AssetReportType.php`:

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

`app/Enums/AssetReportStatus.php`:

```php
<?php

namespace App\Enums;

enum AssetReportStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
            self::Cancelled => 'Dibatalkan',
        };
    }
}
```

In `app/Enums/Kondisi.php` add, after `label()`:

```php
    public function severity(): int
    {
        return match ($this) {
            self::Baik => 0,
            self::RusakRingan => 1,
            self::RusakBerat => 2,
            self::Hilang => 3,
        };
    }
```

`database/migrations/2026_10_01_100000_create_asset_reports_table.php`:

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
            $table->string('nomor_laporan')->unique();
            $table->foreignId('asset_id')->constrained();
            $table->foreignId('unit_id')->constrained('units');
            $table->foreignId('pegawai_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->string('jenis');
            $table->string('kondisi_baru');
            $table->date('tanggal_kejadian');
            $table->text('kronologi');
            $table->string('status')->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->index(['asset_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_reports');
    }
};
```

`app/Models/AssetReport.php`:

```php
<?php

namespace App\Models;

use App\Contracts\Approvable;
use App\Contracts\HandlesApprovalOutcome;
use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetReport extends Model implements Approvable, HandlesApprovalOutcome
{
    use HasFactory;

    protected $fillable = [
        'nomor_laporan', 'asset_id', 'unit_id', 'pegawai_id', 'jenis', 'kondisi_baru',
        'tanggal_kejadian', 'kronologi', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'jenis' => AssetReportType::class,
            'kondisi_baru' => Kondisi::class,
            'status' => AssetReportStatus::class,
            'tanggal_kejadian' => 'date:Y-m-d',
            'asset_id' => 'integer',
            'unit_id' => 'integer',
            'pegawai_id' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function approvalTitle(): string
    {
        return "Laporan {$this->jenis->label()} #{$this->nomor_laporan}";
    }

    public function approvalShowUrl(): string
    {
        return route('asset-reports.show', $this);
    }

    public function onApprovalRejected(): void
    {
        $this->update(['status' => AssetReportStatus::Rejected]);
    }

    public function onApprovalCancelled(): void
    {
        $this->update(['status' => AssetReportStatus::Cancelled]);
    }
}
```

In `app/Models/Asset.php` add the relation (next to `histories()`) and the import `use Illuminate\Database\Eloquent\Relations\HasMany;` already exists:

```php
    public function reports(): HasMany
    {
        return $this->hasMany(AssetReport::class);
    }
```

`database/factories/AssetReportFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetReport> */
class AssetReportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nomor_laporan' => 'LP/'.now()->year.'/'.str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'asset_id' => fn () => Asset::factory()->create()->id,
            'unit_id' => fn (array $attrs) => Asset::find($attrs['asset_id'])->unit_id,
            'pegawai_id' => null,
            'jenis' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'tanggal_kejadian' => now()->toDateString(),
            'kronologi' => 'Jatuh saat dipindahkan.',
            'status' => 'pending',
            'created_by' => fn () => User::factory()->create()->id,
        ];
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetReportModelTest.php`
Expected: PASS (3 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app database tests
git commit -m "feat: add asset_reports table, model and condition severity"
```

---

## Task 2: Workflow registration and `AssetReportEffect`

**Files:**
- Modify: `app/Support/WorkflowDefaults.php`, `config/workflow.php`
- Create: `app/Services/AssetReportEffect.php`
- Modify (existing test): `tests/Feature/WorkflowSettingsTest.php` (`has('workflows', 6)` → `7`)
- Test: `tests/Feature/AssetReportEffectTest.php`

**Interfaces:**
- Consumes: `AssetReport`, `Kondisi::severity()` (Task 1); `WorkflowDefaults`, engine.
- Produces: workflow `lapor_rusak_hilang` (one `atasan_unit` step, label "Persetujuan Atasan Unit"), `config('workflow.capabilities.lapor_rusak_hilang') === 'subject'`, `config('workflow.effects.lapor_rusak_hilang') === AssetReportEffect::class`; `AssetReportEffect::apply(Model $approvable): void` (throws `InvalidArgumentException` when the asset is missing, already `hilang`, or the report's condition is not worse than the asset's current one).

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetReportEffectTest.php`:

```php
<?php

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'lurah', 'kasubag'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->service = app(ApprovalWorkflowService::class);
});

function submitReport(object $t, $unit, $creator, array $attrs = []): AssetReport
{
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create($attrs + ['asset_id' => $asset->id, 'unit_id' => $unit->id, 'created_by' => $creator->id]);
    $t->service->submit($report, 'lapor_rusak_hilang', $creator);

    return $report->fresh();
}

it('seeds the lapor_rusak_hilang workflow with one atasan_unit step', function () {
    $definition = WorkflowDefinition::where('code', 'lapor_rusak_hilang')->firstOrFail();

    expect($definition->steps)->toHaveCount(1)
        ->and($definition->steps[0]->approver_type->value)->toBe('atasan_unit')
        ->and($definition->steps[0]->label)->toBe('Persetujuan Atasan Unit')
        ->and(config('workflow.capabilities.lapor_rusak_hilang'))->toBe('subject');
});

it('applies a rusak report: updates kondisi, logs history with the approver and marks approved', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_berat', 'kronologi' => 'Terbakar sebagian.']);

    $this->actingAs($this->camat); // the history records auth()->id(), as it is during a real HTTP approval
    $this->service->approve($report->approvalRequest, $this->camat);

    $history = $report->asset->fresh()->histories()->first();
    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status)->toBe(AssetReportStatus::Approved)
        ->and($history->event)->toBe('laporan_rusak')
        ->and($history->keterangan)->toBe('Terbakar sebagian.')
        ->and($history->user_id)->toBe($this->camat->id)
        ->and($history->kondisi)->toBe(Kondisi::RusakBerat);
});

it('applies a hilang report', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['jenis' => 'hilang', 'kondisi_baru' => 'hilang']);

    $this->service->approve($report->approvalRequest, $this->camat);

    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::Hilang)
        ->and($report->asset->fresh()->histories()->first()->event)->toBe('laporan_hilang');
});

it('routes to the camat for a kecamatan asset and to the lurah for a kelurahan asset', function () {
    $kecReport = submitReport($this, $this->kec, $this->adminKec);
    $kelReport = submitReport($this, $this->kel, $this->adminKel);

    expect($this->service->canAct($this->camat, $kecReport->approvalRequest))->toBeTrue()
        ->and($this->service->canAct($this->lurah, $kecReport->approvalRequest))->toBeFalse()
        ->and($this->service->canAct($this->lurah, $kelReport->approvalRequest))->toBeTrue()
        ->and($this->service->canAct($this->camat, $kelReport->approvalRequest))->toBeFalse()
        ->and($this->service->canAct($this->adminKec, $kecReport->approvalRequest))->toBeFalse();
});

it('fails clearly and changes nothing when the asset got worse than the report after submission', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_ringan']);
    $report->asset->update(['kondisi' => Kondisi::RusakBerat]);

    expect(fn () => $this->service->approve($report->approvalRequest, $this->camat))->toThrow(InvalidArgumentException::class);

    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status)->toBe(AssetReportStatus::Pending)
        ->and($report->approvalRequest->fresh()->status->value)->toBe('pending');
});

it('fails clearly when the asset was already reported lost in the meantime', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_ringan']);
    $report->asset->update(['kondisi' => Kondisi::Hilang]);

    expect(fn () => $this->service->approve($report->approvalRequest, $this->camat))->toThrow(InvalidArgumentException::class);
    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::Hilang);
});

it('leaves the asset untouched on reject and cancel', function () {
    $rejected = submitReport($this, $this->kec, $this->adminKec);
    $this->service->reject($rejected->approvalRequest, $this->camat, 'Data tidak sesuai');

    $cancelled = submitReport($this, $this->kec, $this->adminKec);
    $this->service->cancel($cancelled->approvalRequest, $this->adminKec, 'Salah input');

    expect($rejected->fresh()->status)->toBe(AssetReportStatus::Rejected)
        ->and($cancelled->fresh()->status)->toBe(AssetReportStatus::Cancelled)
        ->and($rejected->asset->fresh()->kondisi)->toBe(Kondisi::Baik)
        ->and($cancelled->asset->fresh()->kondisi)->toBe(Kondisi::Baik);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportEffectTest.php`
Expected: FAIL (`No query results for model [App\Models\WorkflowDefinition]` — the workflow is not seeded yet).

- [ ] **Step 3: Defaults, config, effect**

In `app/Support/WorkflowDefaults.php` add this entry to the array returned by `all()` (after `mutasi_internal_kel`):

```php
            'lapor_rusak_hilang' => [
                'name' => 'Lapor Rusak/Hilang',
                'steps' => [self::atasanUnit('Persetujuan Atasan Unit')],
            ],
```

and this helper next to `role()`:

```php
    /** @return array<string, string|null> */
    private static function atasanUnit(string $label): array
    {
        return ['label' => $label, 'approver_type' => 'atasan_unit', 'approver_role' => null, 'unit_scope' => 'subject'];
    }
```

(Widen the docblock return types of `all()`/`steps()` to `array<string, string|null>` if the analyzer complains.)

In `config/workflow.php`: add `use App\Services\AssetReportEffect;` at the top, `'lapor_rusak_hilang' => AssetReportEffect::class,` inside `'effects'`, and `'lapor_rusak_hilang' => 'subject',` inside `'capabilities'`.

`app/Services/AssetReportEffect.php`:

```php
<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetReportEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetReport) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetReport.');
        }

        DB::transaction(function () use ($approvable) {
            $asset = Asset::whereKey($approvable->asset_id)->lockForUpdate()->first();

            if ($asset === null) {
                throw new InvalidArgumentException('Aset pada laporan ini sudah tidak ditemukan.');
            }

            if ($asset->kondisi === Kondisi::Hilang) {
                throw new InvalidArgumentException('Aset ini sudah berkondisi hilang, laporan tidak dapat diterapkan.');
            }

            if ($approvable->kondisi_baru->severity() <= $asset->kondisi->severity()) {
                throw new InvalidArgumentException(
                    "Kondisi aset sekarang ({$asset->kondisi->label()}) sudah sama atau lebih buruk dari kondisi pada laporan ({$approvable->kondisi_baru->label()})."
                );
            }

            $asset->update(['kondisi' => $approvable->kondisi_baru]);

            $asset->histories()->create([
                'event' => 'laporan_'.$approvable->jenis->value,
                'unit_id' => $asset->unit_id,
                'current_holder_id' => $asset->current_holder_id,
                'kondisi' => $asset->kondisi,
                'user_id' => auth()->id() ?? $approvable->created_by,
                'keterangan' => $approvable->kronologi,
            ]);

            $approvable->update(['status' => AssetReportStatus::Approved]);
        });
    }
}
```

In `tests/Feature/WorkflowSettingsTest.php` change `->has('workflows', 6)` to `->has('workflows', 7)`.

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetReportEffectTest.php`
Expected: PASS (7 tests).

Run: `php artisan test`
Expected: all green (including `WorkflowDefaultsTest`, which counts defaults dynamically).

- [ ] **Step 5: Commit**

```bash
git add app config tests
git commit -m "feat: register lapor_rusak_hilang workflow and apply reports on approval"
```

---

## Task 3: `AssetReportService` (create with validation, numbering, photos)

**Files:**
- Create: `app/Services/AssetReportService.php`
- Test: `tests/Feature/AssetReportServiceTest.php`

**Interfaces:**
- Consumes: `AssetReport`, `ApprovalWorkflowService::submit`, `Kondisi::severity`.
- Produces: `AssetReportService::create(array $data, array $photos, User $actor): AssetReport` — `$data` keys `asset_id`, `jenis`, `kondisi_baru` (only for `rusak`), `tanggal_kejadian`, `kronologi`; `$photos` is `list<UploadedFile>`; throws `InvalidArgumentException` with a user-facing message on any rule violation, creating nothing.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetReportServiceTest.php`:

```php
<?php

use App\Enums\AssetReportStatus;
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Services\AssetReportService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('public');
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->service = app(AssetReportService::class);
    $this->asset = Asset::factory()->create(['unit_id' => $this->kec->id]);
});

function reportData(object $t, array $override = []): array
{
    return array_merge([
        'asset_id' => $t->asset->id, 'jenis' => 'rusak', 'kondisi_baru' => 'rusak_ringan',
        'tanggal_kejadian' => now()->toDateString(), 'kronologi' => 'Jatuh saat dipindahkan.',
    ], $override);
}

function photo(string $name = 'a.jpg'): UploadedFile
{
    return UploadedFile::fake()->image($name);
}

it('creates a rusak report with photos, an auto number, the holder and a submitted approval', function () {
    $pegawai = App\Models\Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $this->asset->update(['current_holder_id' => $pegawai->id]);

    $report = $this->service->create(reportData($this), [photo()], $this->admin);

    expect($report->nomor_laporan)->toBe('LP/'.now()->year.'/0001')
        ->and($report->unit_id)->toBe($this->kec->id)
        ->and($report->pegawai_id)->toBe($pegawai->id)
        ->and($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->photos)->toHaveCount(1)
        ->and($report->approvalRequest->definition->code)->toBe('lapor_rusak_hilang')
        ->and($report->approvalRequest->steps)->toHaveCount(1);
    Storage::disk('public')->assertExists($report->photos->first()->path);
});

it('creates a hilang report without photos, forcing kondisi_baru to hilang, and numbers sequentially', function () {
    $first = $this->service->create(reportData($this, ['jenis' => 'hilang', 'kondisi_baru' => 'rusak_ringan']), [], $this->admin);
    $first->update(['status' => 'rejected']);
    $second = $this->service->create(reportData($this, ['jenis' => 'hilang']), [], $this->admin);

    expect($first->kondisi_baru)->toBe(Kondisi::Hilang)
        ->and($second->nomor_laporan)->toBe('LP/'.now()->year.'/0002');
});

it('still allows reporting an asset that is dalam_proses', function () {
    $this->asset->update(['status' => AssetStatus::DalamProses]);

    expect($this->service->create(reportData($this), [photo()], $this->admin))->toBeInstanceOf(AssetReport::class);
});

it('refuses invalid reports and creates nothing', function (string $case) {
    $photos = [photo()];
    $data = reportData($this);
    $actor = $this->admin;

    switch ($case) {
        case 'asset already hilang':
            $this->asset->update(['kondisi' => Kondisi::Hilang]);
            break;
        case 'rusak without photo':
            $photos = [];
            break;
        case 'same condition':
            $this->asset->update(['kondisi' => Kondisi::RusakRingan]);
            break;
        case 'better condition':
            $this->asset->update(['kondisi' => Kondisi::RusakBerat]);
            break;
        case 'kondisi baru missing':
            $data['kondisi_baru'] = null;
            break;
        case 'kondisi baru not a damage level':
            $data['kondisi_baru'] = 'baik';
            break;
        case 'more than 10 photos':
            $photos = array_map(fn ($i) => photo("f{$i}.jpg"), range(1, 11));
            break;
        case 'asset of another unit':
            $actor = userWithRole('admin_kelurahan', $this->kel);
            break;
        case 'pending report exists':
            $this->service->create(reportData($this), [photo()], $this->admin);
            break;
    }

    $before = AssetReport::count();
    expect(fn () => $this->service->create($data, $photos, $actor))->toThrow(InvalidArgumentException::class);
    expect(AssetReport::count())->toBe($before);
})->with([
    'asset already hilang', 'rusak without photo', 'same condition', 'better condition',
    'kondisi baru missing', 'kondisi baru not a damage level', 'more than 10 photos',
    'asset of another unit', 'pending report exists',
]);

it('serialises concurrent submissions: the second one sees the first as pending', function () {
    $this->service->create(reportData($this), [photo()], $this->admin);

    expect(fn () => $this->service->create(reportData($this, ['kondisi_baru' => 'rusak_berat']), [photo()], $this->admin))
        ->toThrow(InvalidArgumentException::class);
    expect(AssetReport::where('asset_id', $this->asset->id)->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportServiceTest.php`
Expected: FAIL (`Target class [App\Services\AssetReportService] does not exist`).

- [ ] **Step 3: Service**

`app/Services/AssetReportService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetReportService
{
    public const MAX_PHOTOS = 10;

    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function create(array $data, array $photos, User $actor): AssetReport
    {
        $type = AssetReportType::from($data['jenis']);

        return DB::transaction(function () use ($data, $photos, $actor, $type) {
            $asset = Asset::whereKey($data['asset_id'])->lockForUpdate()->firstOrFail();

            if (! $actor->canAccessUnit($asset->unit)) {
                throw new InvalidArgumentException('Aset ini bukan milik unit Anda.');
            }

            if ($asset->kondisi === Kondisi::Hilang) {
                throw new InvalidArgumentException('Aset ini sudah dilaporkan hilang.');
            }

            $kondisiBaru = $this->resolveKondisiBaru($type, $data['kondisi_baru'] ?? null, $asset);

            if (AssetReport::where('asset_id', $asset->id)->where('status', AssetReportStatus::Pending)->exists()) {
                throw new InvalidArgumentException('Aset ini masih punya laporan yang menunggu persetujuan.');
            }

            if ($type === AssetReportType::Rusak && count($photos) < 1) {
                throw new InvalidArgumentException('Laporan rusak wajib menyertakan minimal 1 foto.');
            }

            if (count($photos) > self::MAX_PHOTOS) {
                throw new InvalidArgumentException('Maksimal '.self::MAX_PHOTOS.' foto per laporan.');
            }

            $report = AssetReport::create([
                'nomor_laporan' => $this->nextNumber(),
                'asset_id' => $asset->id,
                'unit_id' => $asset->unit_id,
                'pegawai_id' => $asset->current_holder_id,
                'jenis' => $type,
                'kondisi_baru' => $kondisiBaru,
                'tanggal_kejadian' => $data['tanggal_kejadian'],
                'kronologi' => $data['kronologi'],
                'status' => AssetReportStatus::Pending,
                'created_by' => $actor->id,
            ]);

            $this->workflow->submit($report, 'lapor_rusak_hilang', $actor);

            foreach ($photos as $photo) {
                $report->photos()->create(['path' => $photo->store("asset-reports/{$report->id}", 'public')]);
            }

            return $report;
        });
    }

    private function resolveKondisiBaru(AssetReportType $type, ?string $requested, Asset $asset): Kondisi
    {
        if ($type === AssetReportType::Hilang) {
            return Kondisi::Hilang;
        }

        $kondisi = Kondisi::tryFrom($requested ?? '');

        if (! in_array($kondisi, [Kondisi::RusakRingan, Kondisi::RusakBerat], true)) {
            throw new InvalidArgumentException('Pilih kondisi baru: rusak ringan atau rusak berat.');
        }

        if ($kondisi->severity() <= $asset->kondisi->severity()) {
            throw new InvalidArgumentException(
                "Kondisi aset sekarang ({$asset->kondisi->label()}) sudah sama atau lebih buruk dari {$kondisi->label()}."
            );
        }

        return $kondisi;
    }

    private function nextNumber(): string
    {
        $prefix = 'LP/'.now()->year.'/';

        $last = AssetReport::where('nomor_laporan', 'like', $prefix.'%')
            ->orderByDesc('nomor_laporan')
            ->lockForUpdate()
            ->value('nomor_laporan');

        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetReportServiceTest.php`
Expected: PASS (all tests; the dataset runs 9 cases).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app tests
git commit -m "feat: add AssetReportService with validation, numbering and photos"
```

---

## Task 4: Policy, form request, controller and routes

**Files:**
- Create: `app/Policies/AssetReportPolicy.php`, `app/Http/Requests/StoreAssetReportRequest.php`, `app/Http/Controllers/AssetReportController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/AssetReportControllerTest.php`

**Interfaces:**
- Consumes: `AssetReportService::create` (Task 3), engine props helpers (`ApprovalWorkflowService::canAct/canCancel/canReassign/reassignCandidates`).
- Produces: routes `asset-reports.index|create|store|show`; Inertia components `AssetReports/Index` (props `items`: paginator of reports with `asset`, `unit`, `creator`, `approval_request`; `filters` `{search,status,jenis}`; `can.create`), `AssetReports/Create` (props `assets`: list of `{id,kode_barang,nama_aset,merk_type,kondisi,holder}`, `kondisiOptions`), `AssetReports/Show` (props `report` with `asset.category`, `unit`, `pegawai`, `creator`, `photos`, `approval_request.{definition,steps,actions.user}`; `can.{act,cancel,reassign}`; `reassignCandidates`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetReportControllerTest.php`:

```php
<?php

use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('public');
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'lurah', 'kasubag'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->lurahB = userWithRole('lurah', $this->kelB);
    $this->kasubag = userWithRole('kasubag');
    $this->assetKec = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $this->assetKelA = Asset::factory()->create(['unit_id' => $this->kelA->id]);
});

function reportPayload(array $override = []): array
{
    return array_merge([
        'jenis' => 'rusak', 'kondisi_baru' => 'rusak_ringan', 'tanggal_kejadian' => now()->toDateString(),
        'kronologi' => 'Jatuh saat dipindahkan.', 'photos' => [UploadedFile::fake()->image('a.jpg')],
    ], $override);
}

it('lets an admin file a rusak report for an asset in their unit', function () {
    $response = $this->actingAs($this->adminKelA)->post(route('asset-reports.store'), reportPayload(['asset_id' => $this->assetKelA->id]));

    $report = AssetReport::firstOrFail();
    $response->assertRedirect(route('asset-reports.show', $report));
    expect($report->unit_id)->toBe($this->kelA->id)->and($report->photos)->toHaveCount(1);
});

it('refuses other units and non-admin roles with 403', function () {
    $payload = reportPayload(['asset_id' => $this->assetKelA->id]);

    $this->actingAs($this->adminKelB)->post(route('asset-reports.store'), $payload)->assertForbidden();
    $this->actingAs($this->adminKec)->post(route('asset-reports.store'), $payload)->assertForbidden();
    foreach (['camat', 'lurahA', 'kasubag'] as $who) {
        $this->actingAs($this->$who)->post(route('asset-reports.store'), $payload)->assertForbidden();
        $this->actingAs($this->$who)->get(route('asset-reports.create'))->assertForbidden();
    }
    expect(AssetReport::count())->toBe(0);
});

it('rejects bad uploads and business-rule violations without creating anything', function () {
    $base = ['asset_id' => $this->assetKelA->id];

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => array_map(fn ($i) => UploadedFile::fake()->image("f{$i}.jpg"), range(1, 11)),
    ]))->assertSessionHasErrors('photos');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => [UploadedFile::fake()->create('fake.jpg', 10, 'text/plain')],
    ]))->assertSessionHasErrors('photos.0');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => [UploadedFile::fake()->image('big.jpg')->size(6000)],
    ]))->assertSessionHasErrors('photos.0');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + ['photos' => []]))
        ->assertRedirect('/x')->assertSessionHas('error');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + ['tanggal_kejadian' => now()->addDay()->toDateString()]))
        ->assertSessionHasErrors('tanggal_kejadian');

    $this->assetKelA->update(['kondisi' => Kondisi::Hilang]);
    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base))
        ->assertRedirect('/x')->assertSessionHas('error');

    expect(AssetReport::count())->toBe(0);
    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('offers only reportable assets of the admin unit on the create page', function () {
    $hilang = Asset::factory()->create(['unit_id' => $this->kelA->id, 'kondisi' => Kondisi::Hilang]);
    $pending = Asset::factory()->create(['unit_id' => $this->kelA->id]);
    AssetReport::factory()->create(['asset_id' => $pending->id, 'unit_id' => $this->kelA->id]);
    Asset::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-reports.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('AssetReports/Create')
            ->where('assets', fn ($a) => collect($a)->pluck('id')->all() === [$this->assetKelA->id])
            ->has('kondisiOptions', 2));
});

it('scopes the index and detail page by unit and filters by status and jenis', function () {
    $mine = AssetReport::factory()->create(['asset_id' => $this->assetKelA->id, 'unit_id' => $this->kelA->id, 'status' => 'pending']);
    $otherAsset = Asset::factory()->create(['unit_id' => $this->kelB->id]);
    $theirs = AssetReport::factory()->create(['asset_id' => $otherAsset->id, 'unit_id' => $this->kelB->id, 'status' => 'approved', 'jenis' => 'hilang', 'kondisi_baru' => 'hilang']);

    $ids = fn ($user, $query = '') => collect($this->actingAs($user)->get('/asset-reports'.$query)->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();

    expect($ids($this->adminKelA))->toBe([$mine->id])
        ->and($ids($this->lurahB))->toBe([$theirs->id])
        ->and($ids($this->camat))->toBe(collect([$mine->id, $theirs->id])->sort()->values()->all())
        ->and($ids($this->kasubag, '?status=approved'))->toBe([$theirs->id])
        ->and($ids($this->kasubag, '?jenis=rusak'))->toBe([$mine->id]);

    $this->actingAs($this->adminKelB)->get(route('asset-reports.show', $mine))->assertForbidden();
    $this->actingAs($this->lurahA)->get(route('asset-reports.show', $mine))->assertOk();
});

it('exposes the tracker and action flags on the detail page and completes through the generic approval endpoint', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-reports.store'), reportPayload(['asset_id' => $this->assetKelA->id, 'kondisi_baru' => 'rusak_berat']));
    $report = AssetReport::firstOrFail();

    $this->actingAs($this->adminKelA)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p
            ->has('report.approval_request.steps', 1)
            ->where('can.act', false)->where('can.cancel', true)->where('can.reassign', false));
    $this->actingAs($this->lurahA)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p->where('can.act', true)->where('can.cancel', false));
    $this->actingAs($this->kasubag)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p->where('can.reassign', true)->has('reassignCandidates'));

    $this->actingAs($this->camat)->post(route('approval-requests.approve', $report->approvalRequest))->assertForbidden();
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $report->approvalRequest))->assertRedirect();

    expect($this->assetKelA->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status->value)->toBe('approved');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportControllerTest.php`
Expected: FAIL (`Route [asset-reports.store] not defined`).

- [ ] **Step 3: Policy, form request, controller, routes**

`app/Policies/AssetReportPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;

class AssetReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function view(User $user, AssetReport $report): bool
    {
        return $user->canAccessUnit($report->unit);
    }

    public function create(User $user, ?Asset $asset = null): bool
    {
        if (! $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) || $user->unit_id === null) {
            return false;
        }

        return $asset === null || $user->canAccessUnit($asset->unit);
    }
}
```

`app/Http/Requests/StoreAssetReportRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\AssetReportType;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Services\AssetReportService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [AssetReport::class, Asset::find($this->input('asset_id'))]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'jenis' => ['required', Rule::enum(AssetReportType::class)],
            'kondisi_baru' => ['nullable', Rule::in(['rusak_ringan', 'rusak_berat']), 'required_if:jenis,rusak'],
            'tanggal_kejadian' => ['required', 'date', 'before_or_equal:today'],
            'kronologi' => ['required', 'string', 'max:5000'],
            'photos' => ['nullable', 'array', 'max:'.AssetReportService::MAX_PHOTOS],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kronologi.required' => 'Kronologi wajib diisi.',
            'kondisi_baru.required_if' => 'Pilih kondisi baru untuk laporan rusak.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh di masa depan.',
            'photos.max' => 'Maksimal '.AssetReportService::MAX_PHOTOS.' foto per laporan.',
            'photos.*.image' => 'File harus berupa gambar.',
            'photos.*.mimes' => 'Foto harus JPG, PNG, atau WEBP.',
            'photos.*.max' => 'Ukuran foto maksimal 5 MB.',
        ];
    }
}
```

`app/Http/Controllers/AssetReportController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Http\Requests\StoreAssetReportRequest;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetReportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetReportController extends Controller
{
    public function __construct(
        private readonly AssetReportService $reports,
        private readonly ApprovalWorkflowService $workflow,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetReport::class);

        $user = $request->user();
        $unitIds = $user->accessibleUnitIds();

        $items = AssetReport::with(['asset', 'unit', 'creator', 'approvalRequest'])
            ->when($unitIds !== null, fn (Builder $q) => $q->whereIn('unit_id', $unitIds))
            ->when($request->status, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->jenis, fn (Builder $q, string $jenis) => $q->where('jenis', $jenis))
            ->when($request->search, fn (Builder $q, string $search) => $q->where(fn (Builder $q2) => $q2
                ->where('nomor_laporan', 'like', "%{$search}%")
                ->orWhereHas('asset', fn (Builder $q3) => $q3->where('nama_aset', 'like', "%{$search}%"))
            ))
            ->latest('tanggal_kejadian')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('AssetReports/Index', [
            'items' => $items,
            'filters' => $request->only('search', 'status', 'jenis'),
            'can' => ['create' => $user->can('create', AssetReport::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetReport::class);

        $unitIds = $request->user()->accessibleUnitIds() ?? [];

        $assets = Asset::query()
            ->whereIn('unit_id', $unitIds)
            ->where('kondisi', '!=', Kondisi::Hilang)
            ->whereDoesntHave('reports', fn (Builder $q) => $q->where('status', AssetReportStatus::Pending))
            ->with('currentHolder')
            ->orderBy('nama_aset')
            ->get()
            ->map(fn (Asset $a) => [
                'id' => $a->id,
                'kode_barang' => $a->kode_barang,
                'nama_aset' => $a->nama_aset,
                'merk_type' => $a->merk_type,
                'kondisi' => $a->kondisi->value,
                'holder' => $a->currentHolder?->nama,
            ])->values();

        return Inertia::render('AssetReports/Create', [
            'assets' => $assets,
            'kondisiOptions' => collect([Kondisi::RusakRingan, Kondisi::RusakBerat])
                ->map(fn (Kondisi $k) => ['value' => $k->value, 'label' => $k->label()])->values(),
        ]);
    }

    public function store(StoreAssetReportRequest $request): RedirectResponse
    {
        try {
            $report = $this->reports->create(
                $request->safe()->except('photos'),
                $request->file('photos', []),
                $request->user(),
            );
        } catch (InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('asset-reports.show', $report)
            ->with('success', "Laporan #{$report->nomor_laporan} berhasil diajukan.");
    }

    public function show(Request $request, AssetReport $assetReport): Response
    {
        Gate::authorize('view', $assetReport);

        $assetReport->load([
            'asset.category', 'unit', 'pegawai', 'creator', 'photos',
            'approvalRequest.definition', 'approvalRequest.steps', 'approvalRequest.actions.user',
        ]);

        $approvalRequest = $assetReport->approvalRequest;
        $user = $request->user();
        $canReassign = $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest);

        return Inertia::render('AssetReports/Show', [
            'report' => $assetReport,
            'can' => [
                'act' => $approvalRequest !== null && $this->workflow->canAct($user, $approvalRequest),
                'cancel' => $approvalRequest !== null && $this->workflow->canCancel($user, $approvalRequest),
                'reassign' => $canReassign,
            ],
            'reassignCandidates' => $canReassign ? $this->workflow->reassignCandidates() : [],
        ]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetReportController;` (alphabetical among the controller imports) and inside the `auth` group, after the `asset-mutations` resource line:

```php
    Route::resource('asset-reports', AssetReportController::class)->only(['index', 'create', 'store', 'show']);
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetReportControllerTest.php`
Expected: FAIL only on Inertia page-existence for the component names (`AssetReports/Index|Create|Show` files are created in Task 6). To keep every commit green, add three temporary one-line stub pages now and replace them in Task 6:

```bash
mkdir -p resources/js/Pages/AssetReports
printf "export default function Index() {\n    return null;\n}\n" > resources/js/Pages/AssetReports/Index.tsx
printf "export default function Create() {\n    return null;\n}\n" > resources/js/Pages/AssetReports/Create.tsx
printf "export default function Show() {\n    return null;\n}\n" > resources/js/Pages/AssetReports/Show.tsx
```

Run again: `php artisan test tests/Feature/AssetReportControllerTest.php`
Expected: PASS (6 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app routes tests resources/js/Pages/AssetReports
git commit -m "feat: add asset report policy, controller and routes"
```

---

## Task 5: Block lost assets in Mutasi

**Files:**
- Modify: `app/Services/AssetMutationService.php`, `app/Http/Controllers/AssetMutationController.php`
- Test: `tests/Feature/AssetReportMutationBlockTest.php`

**Interfaces:**
- Consumes: `Kondisi::Hilang`.
- Produces: `AssetMutationService::submit` throws `InvalidArgumentException` for an asset with `kondisi = hilang` (existing controller already flashes it); `AssetMutationController::create` no longer sends lost assets.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetReportMutationBlockTest.php`:

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetMutation;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'kasubag', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->lost = Asset::factory()->create(['unit_id' => $this->kec->id, 'kondisi' => Kondisi::Hilang]);
    $this->ok = Asset::factory()->create(['unit_id' => $this->kec->id]);
});

it('refuses a lost asset in a mutation even via a crafted POST', function () {
    $this->actingAs($this->adminKec)->from('/asset-mutations/create')->post(route('asset-mutations.store'), [
        'nomor_mutasi' => 'M/HILANG/1', 'jenis_mutasi' => 'kec_ke_kel',
        'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kel->id,
        'tanggal_mutasi' => '2026-10-01', 'items' => [['asset_id' => $this->lost->id]],
    ])->assertRedirect('/asset-mutations/create')->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0)
        ->and($this->lost->fresh()->status)->toBe(AssetStatus::Aktif);
});

it('does not offer lost assets on the mutation form', function () {
    $this->actingAs($this->adminKec)->get(route('asset-mutations.create'))
        ->assertInertia(fn (Assert $p) => $p->where('assets', fn ($a) => collect($a)->pluck('id')->all() === [$this->ok->id]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportMutationBlockTest.php`
Expected: FAIL (the mutation is created; the form still lists the lost asset).

- [ ] **Step 3: Implement**

In `app/Services/AssetMutationService.php` add `use App\Enums\Kondisi;` and, inside the `foreach ($assets as $asset)` validation loop (next to the ownership/status checks), add:

```php
                if ($asset->kondisi === Kondisi::Hilang) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" berkondisi hilang dan tidak dapat dimutasi.");
                }
```

In `app/Http/Controllers/AssetMutationController.php` add `use App\Enums\Kondisi;` and change the `$assets` query in `create()` to include `->where('kondisi', '!=', Kondisi::Hilang)` right after `->where('status', AssetStatus::Aktif)`.

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetReportMutationBlockTest.php`
Expected: PASS (2 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app tests
git commit -m "feat: block lost assets from mutations"
```

---

## Task 6: Frontend — types, navigation, Index, Create, Show

**Files:**
- Modify: `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts`
- Create: `resources/js/lib/assetReport.ts`
- Replace stubs: `resources/js/Pages/AssetReports/Index.tsx`, `Create.tsx`, `Show.tsx`

**Interfaces:**
- Consumes: page props from Task 4; `CancelRequestModal`, `ReassignApproverModal` (existing components); routes `asset-reports.*`, `approval-requests.{approve,reject}`.

- [ ] **Step 1: Types and shared labels**

Append to `resources/js/types/index.d.ts`:

```ts
export type AssetReportStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AssetReportType = 'rusak' | 'hilang';

export interface AssetReport {
    id: number;
    nomor_laporan: string;
    asset_id: number;
    unit_id: number;
    pegawai_id: number | null;
    jenis: AssetReportType;
    kondisi_baru: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    tanggal_kejadian: string;
    kronologi: string;
    status: AssetReportStatus;
    asset?: Asset;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    pegawai?: Pegawai | null;
    creator?: { id: number; name: string };
    photos?: AssetPhoto[];
    approval_request?: ApprovalRequestSummary | null;
}
```

`resources/js/lib/assetReport.ts`:

```ts
import { AssetReportStatus, AssetReportType } from '@/types';

export const REPORT_STATUS_LABEL: Record<AssetReportStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REPORT_STATUS_STYLE: Record<AssetReportStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

export const REPORT_TYPE_LABEL: Record<AssetReportType, string> = { rusak: 'Rusak', hilang: 'Hilang' };

export const KONDISI_LABEL: Record<string, string> = {
    baik: 'Baik',
    rusak_ringan: 'Rusak Ringan',
    rusak_berat: 'Rusak Berat',
    hilang: 'Hilang',
};
```

In `resources/js/config/navigation.ts` change the `Lapor Rusak/Hilang` item (currently `href: '#'`, `disabled: true`) to:

```ts
            {
                label: 'Lapor Rusak/Hilang',
                href: '/asset-reports',
                icon: 'alert-triangle',
            },
```

- [ ] **Step 2: Index page** (`resources/js/Pages/AssetReports/Index.tsx`, replacing the stub)

```tsx
import { ChevronRightIcon as ChevronRight, EyeIcon as Eye, PlusIcon as Plus, SearchIcon as Search } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { AssetReport, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetReport>;
    filters: { search?: string; status?: string; jenis?: string };
    can: { create: boolean };
}

const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Index({ items, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(items.current_page, items.last_page);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-reports.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Lapor Rusak/Hilang" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Lapor Rusak/Hilang</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Lapor Rusak/Hilang</h1>
                    </div>
                    {can.create && (
                        <Link href={route('asset-reports.create')} className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                            <Plus className="h-4 w-4" /> Buat Laporan
                        </Link>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    <form onSubmit={submitSearch} className="relative w-full max-w-sm">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nomor laporan atau nama aset..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </form>
                    <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua status</option>
                        {Object.entries(REPORT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={filters.jenis ?? ''} onChange={(e) => go({ jenis: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua jenis</option>
                        {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">No. Laporan</th>
                                <th className="px-4 py-3">Aset</th>
                                <th className="px-4 py-3">Jenis</th>
                                <th className="px-4 py-3">Kondisi Baru</th>
                                <th className="px-4 py-3">Unit</th>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                            {items.data.length === 0 ? (
                                <tr><td colSpan={8} className="py-14 text-center text-sm text-slate-400">Belum ada laporan.</td></tr>
                            ) : (
                                items.data.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-medium">{r.nomor_laporan}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">{r.asset?.nama_aset}</td>
                                        <td className="px-4 py-3">{REPORT_TYPE_LABEL[r.jenis]}</td>
                                        <td className="px-4 py-3">{KONDISI_LABEL[r.kondisi_baru]}</td>
                                        <td className="px-4 py-3">{r.unit?.name}</td>
                                        <td className="px-4 py-3">{new Date(r.tanggal_kejadian).toLocaleDateString('id-ID')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REPORT_STATUS_STYLE[r.status]}`}>{REPORT_STATUS_LABEL[r.status]}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link href={route('asset-reports.show', r.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800">{items.from ?? 0}-{items.to ?? 0}</span> dari <span className="font-semibold text-slate-800">{items.total}</span> laporan
                        </p>
                        {items.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => go({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === items.current_page ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {page}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Create page** (`resources/js/Pages/AssetReports/Create.tsx`, replacing the stub)

```tsx
import { ChevronRightIcon as ChevronRight, UploadIcon as Upload } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { AssetReportType, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface ReportableAsset {
    id: number;
    kode_barang: string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
    holder: string | null;
}

interface CreateProps extends PageProps {
    assets: ReportableAsset[];
    kondisiOptions: { value: string; label: string }[];
}

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Create({ assets, kondisiOptions }: CreateProps) {
    const form = useForm({
        asset_id: '',
        jenis: 'rusak' as AssetReportType,
        kondisi_baru: 'rusak_ringan',
        tanggal_kejadian: new Date().toISOString().slice(0, 10),
        kronologi: '',
        photos: [] as File[],
    });

    const asset = assets.find((a) => String(a.id) === form.data.asset_id);
    const photoError = Object.entries(form.errors).find(([key]) => key.startsWith('photos'))?.[1];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, kondisi_baru: data.jenis === 'rusak' ? data.kondisi_baru : '' }));
        form.post(route('asset-reports.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Laporan Rusak/Hilang" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('asset-reports.index')} className="hover:text-blue-700">Lapor Rusak/Hilang</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Buat Laporan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Buat Laporan Rusak/Hilang</h1>
                </div>

                <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Aset *</label>
                        <select value={form.data.asset_id} onChange={(e) => form.setData('asset_id', e.target.value)} className={FIELD}>
                            <option value="">Pilih aset...</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>{a.kode_barang} — {a.nama_aset}{a.merk_type ? ` (${a.merk_type})` : ''}</option>
                            ))}
                        </select>
                        {form.errors.asset_id && <p className="mt-1 text-xs text-red-600">{form.errors.asset_id}</p>}
                        {asset && (
                            <p className="mt-2 text-xs text-slate-500">
                                Kondisi sekarang: <span className="font-semibold text-slate-700">{KONDISI_LABEL[asset.kondisi]}</span>
                                {' · '}Pemegang: <span className="font-semibold text-slate-700">{asset.holder ?? 'Tidak ada (milik unit)'}</span>
                            </p>
                        )}
                        {assets.length === 0 && <p className="mt-2 text-xs text-amber-700">Tidak ada aset yang dapat dilaporkan di unit Anda.</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Jenis Laporan *</label>
                            <div className="flex gap-4 text-sm">
                                {(['rusak', 'hilang'] as AssetReportType[]).map((j) => (
                                    <label key={j} className="flex items-center gap-2">
                                        <input type="radio" name="jenis" checked={form.data.jenis === j} onChange={() => form.setData('jenis', j)} />
                                        {j === 'rusak' ? 'Rusak' : 'Hilang'}
                                    </label>
                                ))}
                            </div>
                            {form.errors.jenis && <p className="mt-1 text-xs text-red-600">{form.errors.jenis}</p>}
                        </div>
                        {form.data.jenis === 'rusak' && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Kondisi Baru *</label>
                                <select value={form.data.kondisi_baru} onChange={(e) => form.setData('kondisi_baru', e.target.value)} className={FIELD}>
                                    {kondisiOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                {form.errors.kondisi_baru && <p className="mt-1 text-xs text-red-600">{form.errors.kondisi_baru}</p>}
                            </div>
                        )}
                    </div>

                    <div className="max-w-xs">
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Tanggal Kejadian *</label>
                        <input type="date" value={form.data.tanggal_kejadian} max={new Date().toISOString().slice(0, 10)} onChange={(e) => form.setData('tanggal_kejadian', e.target.value)} className={FIELD} />
                        {form.errors.tanggal_kejadian && <p className="mt-1 text-xs text-red-600">{form.errors.tanggal_kejadian}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Kronologi *</label>
                        <textarea value={form.data.kronologi} onChange={(e) => form.setData('kronologi', e.target.value)} rows={4} className={FIELD} placeholder="Jelaskan kejadian, waktu, dan penyebabnya." />
                        {form.errors.kronologi && <p className="mt-1 text-xs text-red-600">{form.errors.kronologi}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">
                            Foto Pendukung {form.data.jenis === 'rusak' ? '* (minimal 1)' : '(opsional)'}
                        </label>
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
                            <Upload className="h-6 w-6 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah foto (JPG/PNG/WEBP)</span>
                            <span className="text-xs text-slate-500">Maks. 10 foto, 5MB per foto</span>
                            <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => form.setData('photos', Array.from(e.target.files ?? []))} />
                        </label>
                        {form.data.photos.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {form.data.photos.map((f, i) => <li key={i}>{f.name}</li>)}
                            </ul>
                        )}
                        {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link href={route('asset-reports.index')} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</Link>
                        <button type="submit" disabled={form.processing || !form.data.asset_id} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {form.processing ? 'Mengirim...' : 'Ajukan Laporan'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Show page** (`resources/js/Pages/AssetReports/Show.tsx`, replacing the stub)

```tsx
import CancelRequestModal from '@/Components/CancelRequestModal';
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetPhoto, AssetReport, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    report: AssetReport;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

type StepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled';

const STEP_CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-100',
    current: 'bg-amber-100',
    upcoming: 'bg-slate-100',
    rejected: 'bg-red-100',
    cancelled: 'bg-slate-200',
};

const STEP_TEXT: Record<StepState, string> = {
    done: 'Selesai',
    current: 'Menunggu',
    upcoming: 'Belum dimulai',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const ACTION_LABEL = { approve: 'Disetujui', reject: 'Ditolak', cancel: 'Dibatalkan', reassign: 'Approver Dialihkan' } as const;
const ACTION_DOT = { approve: 'bg-emerald-600', reject: 'bg-red-600', cancel: 'bg-slate-500', reassign: 'bg-blue-600' } as const;

export default function Show({ report, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [photo, setPhoto] = useState<AssetPhoto | null>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const req = report.approval_request;
    const steps = req?.steps ?? [];

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const reject = () => {
        if (!req || submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', req.id),
            { note: note.trim() },
            { preserveScroll: true, onSuccess: () => setShowReject(false), onFinish: () => setSubmitting(false) },
        );
    };

    const stepState = (order: number): StepState => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) {
            if (req.status === 'rejected') return 'rejected';
            if (req.status === 'cancelled') return 'cancelled';
            return 'current';
        }
        return 'upcoming';
    };

    const rows: [string, string][] = [
        ['Nomor Laporan', report.nomor_laporan],
        ['Jenis', REPORT_TYPE_LABEL[report.jenis]],
        ['Kondisi Baru', KONDISI_LABEL[report.kondisi_baru]],
        ['Kondisi Saat Ini', report.asset ? KONDISI_LABEL[report.asset.kondisi] : '—'],
        ['Tanggal Kejadian', new Date(report.tanggal_kejadian).toLocaleDateString('id-ID')],
        ['Unit', report.unit?.name ?? '—'],
        ['Pemegang', report.pegawai?.nama ?? 'Tidak ada (milik unit)'],
        ['Dilaporkan Oleh', report.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Laporan #${report.nomor_laporan}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('asset-reports.index')} className="hover:text-blue-700">Lapor Rusak/Hilang</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <div className="mt-1 flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laporan {REPORT_TYPE_LABEL[report.jenis]} #{report.nomor_laporan}</h1>
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REPORT_STATUS_STYLE[report.status]}`}>{REPORT_STATUS_LABEL[report.status]}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {can.cancel && (
                            <button onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batalkan Pengajuan</button>
                        )}
                        {can.reassign && (
                            <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Alihkan Approver</button>
                        )}
                        {can.act && (
                            <>
                                <button onClick={() => setShowReject(true)} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tolak</button>
                                <button onClick={approve} disabled={submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{submitting ? 'Memproses...' : 'Setujui'}</button>
                            </>
                        )}
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-sm font-semibold text-slate-900">Status Alur Persetujuan</p>
                        <div className="flex items-start">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                return (
                                    <div key={step.step_order} className="flex flex-1 flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${STEP_CIRCLE[state]}`}>
                                                {state === 'done' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">Step {step.step_order}: {step.label}</p>
                                            <p className="text-[11px] text-slate-500">{STEP_TEXT[state]}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Laporan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Kronologi</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{report.kronologi}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Aset</p>
                        {report.asset && (
                            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-900">{report.asset.nama_aset}</p>
                                <p className="text-xs text-slate-500">{report.asset.kode_barang} · {report.asset.merk_type ?? '—'}</p>
                                <Link href={route('assets.show', report.asset.id)} className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline">Lihat detail aset</Link>
                            </div>
                        )}
                        <p className="mb-2 text-sm font-semibold text-slate-900">Foto ({report.photos?.length ?? 0})</p>
                        {(report.photos?.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400">Tidak ada foto.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {report.photos?.map((p) => (
                                    <button key={p.id} type="button" onClick={() => setPhoto(p)} className="aspect-square overflow-hidden rounded-lg border border-slate-200">
                                        <img src={p.url} alt="Foto laporan" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Laporan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {report.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${ACTION_DOT[action.action]}`} />
                                    <p className="text-sm font-semibold text-slate-900">{ACTION_LABEL[action.action]} oleh {action.user?.name}</p>
                                    {action.note && <p className="text-xs text-slate-500">{action.note}</p>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Laporan dihentikan dan tidak lagi muncul di kotak persetujuan. Kondisi aset tidak berubah."
                />
            )}

            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    stepOrder={req.current_step}
                    stepLabel={steps.find((s) => s.step_order === req.current_step)?.label}
                    onClose={() => setShowReassign(false)}
                />
            )}

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReject(false)}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">Tolak Laporan</h3>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Alasan penolakan (wajib diisi)" className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={reject} disabled={!note.trim() || submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Ya, Tolak</button>
                        </div>
                    </div>
                </div>
            )}

            {photo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPhoto(null)}>
                    <img src={photo.url} alt="Foto laporan" className="max-h-[90vh] max-w-3xl rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors (adjust `Icons` imports to the names that exist in `@/Components/Icons`; `EyeIcon`, `PlusIcon`, `SearchIcon`, `UploadIcon`, `CheckCircleIcon`, `ChevronRightIcon` are used elsewhere in the project).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification (browser)**

1. `php artisan migrate` and `php artisan db:seed --class=WorkflowDefinitionSeeder` on the dev DB.
2. As `admin.kelurahan@simaset.test` (or `admin.kecamatan@simaset.test`): sidebar shows "Lapor Rusak/Hilang" (no longer "Segera hadir"); open Create, pick an asset (shows current condition and holder), choose Rusak → Rusak Berat, add a photo, submit → redirected to detail with tracker "Step 1: Persetujuan Atasan Unit — Menunggu".
3. Try Rusak without photo → flash error, nothing created. Try the same asset again → flash error (one pending per asset).
4. As the matching `lurah`/`camat` (Camat for a kecamatan asset): item in `/persetujuan`, open it, Setujui → status Disetujui; the asset detail page shows the new condition and a history entry.
5. Repeat with a Hilang report; verify the asset no longer appears on the Mutasi create form.
6. Reject and cancel paths: asset untouched. Clean up all test data afterwards.

- [ ] **Step 7: Commit**

```bash
git add resources
git commit -m "feat: add Lapor Rusak/Hilang pages and enable sidebar entry"
```

---

## Task 7: Docs and final regression

**Files:**
- Modify: `docs/DETAIL_RBAC_SISTEM.md`, `docs/superpowers/specs/2026-10-01-lapor-rusak-hilang-design.md`

- [ ] **Step 1: Update `docs/DETAIL_RBAC_SISTEM.md`**

In the §4 matrix, change the "Pelaporan Rusak / Hilang" row so its last column reads `✅ Selesai (`AssetReportPolicy`, workflow `lapor_rusak_hilang`)` and its cells to: Kasubag `Lihat semua (alihkan approver)`, Camat `Approve aset kecamatan`, Admin Kec. `Input laporan`, Admin Kel. `Input laporan`, Lurah `Approve aset kelurahan`. In §6 add `lapor_rusak_hilang` (Step 1: Atasan unit [Scope: Subject]) to the list of workflow definitions.

- [ ] **Step 2: Mark the spec implemented**

In the spec header change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-10-01-lapor-rusak-hilang.md).`

- [ ] **Step 3: Full regression**

Run: `php artisan test`
Expected: all green.

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add docs/DETAIL_RBAC_SISTEM.md docs/superpowers/specs/2026-10-01-lapor-rusak-hilang-design.md
git commit -m "docs: document Lapor Rusak/Hilang workflow and permissions"
```
