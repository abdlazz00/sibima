# Permohonan Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kecamatan/kelurahan can file an asset request (for a pegawai, or — kelurahan only — a stock request to the kecamatan); the right approver approves through the generic approval engine; the fulfiller then hands over an asset (pegawai request: sets the holder; unit request: creates and submits a Mutasi `kec_ke_kel`), or closes the request with a reason.

**Architecture:** New table `asset_requests` (+ `asset_request_assets` pivot) whose model implements `Approvable` + `HandlesApprovalOutcome`, submitted to workflows `permohonan_pegawai` (one `atasan_unit` step) or `permohonan_unit` (one `kasubag` step). Final approval only marks the request `approved`; `AssetRequestService` performs fulfillment under row locks. For unit requests the fulfillment goes through `AssetMutationService::submit`, and hooks on the mutation (final approval / reject / cancel) keep the linked request in sync.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-10-02-permohonan-aset-design.md`

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:` — no MySQL-only SQL.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Policy. Controllers catch `InvalidArgumentException` from services and flash `error` (pattern in `AssetReportController::store`).
- Requesters are only `admin_kecamatan` / `admin_kelurahan`; a `unit` request only by `admin_kelurahan`. `unit_id` of a request is **never** taken from client input: it is the pegawai's unit (pegawai request) or the acting admin's unit (unit request).
- `category_id` must reference a subkategori (`parent_id` not null). Pegawai request: `jumlah` is always 1.
- Eligible asset for fulfillment (re-checked inside the transaction under `lockForUpdate`): belongs to the source unit (pegawai request: the pegawai's unit; unit request: the requesting unit's parent kecamatan), `status = aktif`, `kondisi != hilang`, same subkategori as the request, and for a pegawai request `current_holder_id` is null.
- Approval goes through `ApprovalWorkflowService` only (codes `permohonan_pegawai`, `permohonan_unit`); no separate approve/reject endpoint. The submitter can never approve their own request (engine guard exists).
- Unit-request fulfillment must go through `AssetMutationService::submit` (do not move `assets.unit_id` directly).
- UI copy in Bahasa Indonesia.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution) line. Stage files by explicit path (never `git add docs` / `git add .`): the untracked `docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx` must stay out of commits.**

## Review Focus

- **The same asset must never be handed over twice** (two requests fulfilled at once, or a stale page). Eligibility is re-checked under lock. → Task 4.
- **A unit request must never create two Mutasi** (double click / stale page). Lock + `mutation_id` check. → Task 4.
- **When the linked Mutasi is rejected or cancelled the request must be fulfillable again without a duplicate `nomor_mutasi`.** → Task 4.
- **A crafted `pegawai_id` from another unit, an `admin_kecamatan` posting a `unit` request, or a non-admin role must be refused.** → Tasks 3 and 5.
- **Fulfill/close by the wrong actor (admin of another unit, the kecamatan admin for a pegawai request of a kelurahan) must be 403 over HTTP.** → Task 5.

## File Structure

| File | Responsibility |
|---|---|
| `app/Enums/AssetRequestType.php`, `AssetRequestStatus.php` (new) | `pegawai/unit`; `pending/approved/fulfilled/rejected/cancelled` |
| `app/Models/AssetRequest.php` (new), `database/migrations/2026_10_02_100000_create_asset_requests_tables.php`, `database/factories/AssetRequestFactory.php` (new) | model, schema, factory |
| `app/Support/WorkflowDefaults.php`, `config/workflow.php` | two new workflows, capabilities, effects |
| `app/Services/AssetRequestEffect.php`, `AssetRequestService.php` (new) | approve effect; create/fulfill/close |
| `app/Models/AssetMutation.php`, `app/Services/AssetMutationEffect.php` | hooks that keep the linked request in sync |
| `app/Policies/AssetRequestPolicy.php`, `app/Http/Requests/{StorePermohonanRequest,FulfillPermohonanRequest,ClosePermohonanRequest}.php`, `app/Http/Controllers/AssetRequestController.php` (new), `routes/web.php` | HTTP layer |
| `resources/js/Pages/AssetRequests/{Index,Create,Show}.tsx`, `resources/js/lib/assetRequest.ts` (new), `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts` | UI |

---

## Task 1: Schema, enums, model and factory

**Files:**
- Create: `app/Enums/AssetRequestType.php`, `app/Enums/AssetRequestStatus.php`
- Create: `database/migrations/2026_10_02_100000_create_asset_requests_tables.php`
- Create: `app/Models/AssetRequest.php`, `database/factories/AssetRequestFactory.php`
- Test: `tests/Feature/AssetRequestModelTest.php`

**Interfaces:**
- Produces: `AssetRequestType` (`Pegawai='pegawai'`, `Unit='unit'`, `label()`), `AssetRequestStatus` (`Pending`, `Approved`, `Fulfilled`, `Rejected`, `Cancelled`, `label()`), `AssetRequest` (fillable/casts; relations `pegawai()`, `unit()`, `category()`, `creator()`, `fulfiller()`, `mutation()`, `assets(): BelongsToMany`, `approvalRequest(): MorphOne`; `approvalTitle()`, `approvalShowUrl()`, `onApprovalRejected()`, `onApprovalCancelled()`), `AssetRequest::factory()` (default: pegawai request, pending; states `->unitRequest()`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRequestModelTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\Asset;
use App\Models\AssetRequest;

it('creates a pegawai request with casts and relations', function () {
    $request = AssetRequest::factory()->create();

    expect($request->jenis)->toBe(AssetRequestType::Pegawai)
        ->and($request->status)->toBe(AssetRequestStatus::Pending)
        ->and($request->pegawai)->not->toBeNull()
        ->and($request->unit_id)->toBe($request->pegawai->unit_id)
        ->and($request->jumlah)->toBe(1)
        ->and($request->category->parent_id)->not->toBeNull()
        ->and($request->approvalTitle())->toBe("Permohonan Aset #{$request->nomor_permohonan}");
});

it('creates a unit request and attaches fulfilled assets', function () {
    $request = AssetRequest::factory()->unitRequest()->create(['jumlah' => 2]);
    $asset = Asset::factory()->create(['unit_id' => $request->unit->parent_id]);

    $request->assets()->attach($asset->id);

    expect($request->jenis)->toBe(AssetRequestType::Unit)
        ->and($request->pegawai_id)->toBeNull()
        ->and($request->unit->isKelurahan())->toBeTrue()
        ->and($request->assets)->toHaveCount(1);
});

it('marks itself rejected or cancelled through the approval outcome hooks', function () {
    $request = AssetRequest::factory()->create();
    $request->onApprovalRejected();
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Rejected);

    $request->update(['status' => 'pending']);
    $request->onApprovalCancelled();
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestModelTest.php`
Expected: FAIL (`Class "App\Models\AssetRequest" not found`).

- [ ] **Step 3: Enums, migration, model, factory**

`app/Enums/AssetRequestType.php`:

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
            self::Pegawai => 'Permohonan Pegawai',
            self::Unit => 'Permohonan Unit',
        };
    }
}
```

`app/Enums/AssetRequestStatus.php`:

```php
<?php

namespace App\Enums;

enum AssetRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Fulfilled = 'fulfilled';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Menunggu Pemenuhan',
            self::Fulfilled => 'Dipenuhi',
            self::Rejected => 'Ditolak',
            self::Cancelled => 'Dibatalkan',
        };
    }
}
```

`database/migrations/2026_10_02_100000_create_asset_requests_tables.php`:

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
            $table->string('nomor_permohonan')->unique();
            $table->string('jenis');
            $table->foreignId('pegawai_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->foreignId('unit_id')->constrained('units');
            $table->foreignId('category_id')->constrained('asset_categories');
            $table->unsignedInteger('jumlah')->default(1);
            $table->text('keterangan');
            $table->string('status')->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('mutation_id')->nullable()->constrained('asset_mutations')->nullOnDelete();
            $table->foreignId('fulfilled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fulfilled_at')->nullable();
            $table->text('catatan_penutupan')->nullable();
            $table->timestamps();
            $table->index(['status', 'jenis']);
        });

        Schema::create('asset_request_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained();
            $table->unique(['asset_request_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_request_assets');
        Schema::dropIfExists('asset_requests');
    }
};
```

`app/Models/AssetRequest.php`:

```php
<?php

namespace App\Models;

use App\Contracts\Approvable;
use App\Contracts\HandlesApprovalOutcome;
use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetRequest extends Model implements Approvable, HandlesApprovalOutcome
{
    use HasFactory;

    protected $fillable = [
        'nomor_permohonan', 'jenis', 'pegawai_id', 'unit_id', 'category_id', 'jumlah', 'keterangan',
        'status', 'created_by', 'mutation_id', 'fulfilled_by', 'fulfilled_at', 'catatan_penutupan',
    ];

    protected function casts(): array
    {
        return [
            'jenis' => AssetRequestType::class,
            'status' => AssetRequestStatus::class,
            'jumlah' => 'integer',
            'pegawai_id' => 'integer',
            'unit_id' => 'integer',
            'category_id' => 'integer',
            'created_by' => 'integer',
            'mutation_id' => 'integer',
            'fulfilled_at' => 'datetime',
        ];
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function fulfiller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fulfilled_by');
    }

    public function mutation(): BelongsTo
    {
        return $this->belongsTo(AssetMutation::class, 'mutation_id');
    }

    public function assets(): BelongsToMany
    {
        return $this->belongsToMany(Asset::class, 'asset_request_assets');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function approvalTitle(): string
    {
        return "Permohonan Aset #{$this->nomor_permohonan}";
    }

    public function approvalShowUrl(): string
    {
        return route('asset-requests.show', $this);
    }

    public function onApprovalRejected(): void
    {
        $this->update(['status' => AssetRequestStatus::Rejected]);
    }

    public function onApprovalCancelled(): void
    {
        $this->update(['status' => AssetRequestStatus::Cancelled]);
    }
}
```

`database/factories/AssetRequestFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetRequest> */
class AssetRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nomor_permohonan' => 'PM/'.now()->year.'/'.str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'jenis' => 'pegawai',
            'pegawai_id' => fn () => Pegawai::factory()->create()->id,
            'unit_id' => fn (array $attrs) => Pegawai::find($attrs['pegawai_id'])->unit_id,
            'category_id' => fn () => AssetCategory::factory()->subcategory()->create()->id,
            'jumlah' => 1,
            'keterangan' => 'Butuh laptop untuk pekerjaan harian.',
            'status' => 'pending',
            'created_by' => fn () => User::factory()->create()->id,
        ];
    }

    public function unitRequest(): static
    {
        return $this->state(function () {
            $kecamatan = Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan']);
            $kelurahan = Unit::create(['name' => 'Kelurahan '.fake()->unique()->word(), 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);

            return ['jenis' => 'unit', 'pegawai_id' => null, 'unit_id' => $kelurahan->id, 'jumlah' => 2];
        });
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetRequestModelTest.php`
Expected: PASS (3 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app database tests
git commit -m "feat: add asset_requests tables, model and factory"
```

---

## Task 2: Workflows, approve effect and route skeleton

**Files:**
- Modify: `app/Support/WorkflowDefaults.php`, `config/workflow.php`, `routes/web.php`
- Create: `app/Services/AssetRequestEffect.php`, `app/Http/Controllers/AssetRequestController.php` (empty skeleton)
- Modify (existing test): `tests/Feature/WorkflowSettingsTest.php` (`has('workflows', 7)` → `9`)
- Test: `tests/Feature/AssetRequestWorkflowTest.php`

**Interfaces:**
- Consumes: `AssetRequest` (Task 1).
- Produces: workflows `permohonan_pegawai` (step "Persetujuan Atasan Unit", `atasan_unit`) and `permohonan_unit` (step "Persetujuan Kasubag", role `kasubag`), both capability `subject`; `AssetRequestEffect` (sets `approved`); route `asset-requests.show` (needed by notifications) via a resource route on an empty `AssetRequestController` — Task 5 fills it and adds the fulfill/close routes.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRequestWorkflowTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->engine = app(ApprovalWorkflowService::class);
});

function submitPegawaiRequest(object $t, $unit, $creator): AssetRequest
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $unit->id]);
    $request = AssetRequest::factory()->create(['pegawai_id' => $pegawai->id, 'unit_id' => $unit->id, 'created_by' => $creator->id]);
    $t->engine->submit($request, 'permohonan_pegawai', $creator);

    return $request->fresh();
}

it('seeds both workflows with one step each', function () {
    $pegawai = WorkflowDefinition::where('code', 'permohonan_pegawai')->firstOrFail();
    $unit = WorkflowDefinition::where('code', 'permohonan_unit')->firstOrFail();

    expect($pegawai->steps)->toHaveCount(1)
        ->and($pegawai->steps[0]->approver_type->value)->toBe('atasan_unit')
        ->and($pegawai->steps[0]->label)->toBe('Persetujuan Atasan Unit')
        ->and($unit->steps)->toHaveCount(1)
        ->and($unit->steps[0]->approver_role)->toBe('kasubag')
        ->and($unit->steps[0]->label)->toBe('Persetujuan Kasubag')
        ->and(config('workflow.capabilities.permohonan_pegawai'))->toBe('subject')
        ->and(config('workflow.capabilities.permohonan_unit'))->toBe('subject');
});

it('routes a pegawai request to the camat of a kecamatan unit or the lurah of a kelurahan unit', function () {
    $kecRequest = submitPegawaiRequest($this, $this->kec, $this->adminKec);
    $kelRequest = submitPegawaiRequest($this, $this->kel, $this->adminKel);

    expect($this->engine->canAct($this->camat, $kecRequest->approvalRequest))->toBeTrue()
        ->and($this->engine->canAct($this->lurah, $kecRequest->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->lurah, $kelRequest->approvalRequest))->toBeTrue()
        ->and($this->engine->canAct($this->camat, $kelRequest->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->adminKec, $kecRequest->approvalRequest))->toBeFalse();
});

it('routes a unit request to the kasubag only', function () {
    $request = AssetRequest::factory()->unitRequest()->create(['created_by' => $this->adminKel->id]);
    $this->engine->submit($request, 'permohonan_unit', $this->adminKel);
    $approval = $request->fresh()->approvalRequest;

    expect($this->engine->canAct($this->kasubag, $approval))->toBeTrue()
        ->and($this->engine->canAct($this->camat, $approval))->toBeFalse()
        ->and($this->engine->canAct($this->adminKel, $approval))->toBeFalse();
});

it('marks the request approved on final approval without touching any asset', function () {
    $request = submitPegawaiRequest($this, $this->kec, $this->adminKec);

    $this->engine->approve($request->approvalRequest, $this->camat);

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Approved);
});

it('marks the request rejected or cancelled', function () {
    $rejected = submitPegawaiRequest($this, $this->kec, $this->adminKec);
    $this->engine->reject($rejected->approvalRequest, $this->camat, 'Stok tidak ada');

    $cancelled = submitPegawaiRequest($this, $this->kec, $this->adminKec);
    $this->engine->cancel($cancelled->approvalRequest, $this->adminKec, 'Salah input');

    expect($rejected->fresh()->status)->toBe(AssetRequestStatus::Rejected)
        ->and($cancelled->fresh()->status)->toBe(AssetRequestStatus::Cancelled);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestWorkflowTest.php`
Expected: FAIL (`No query results for model [App\Models\WorkflowDefinition]`).

- [ ] **Step 3: Defaults, config, effect, route skeleton**

In `app/Support/WorkflowDefaults.php` add these entries to `all()` after `lapor_rusak_hilang`:

```php
            'permohonan_pegawai' => [
                'name' => 'Permohonan Aset Pegawai',
                'steps' => [self::atasanUnit('Persetujuan Atasan Unit')],
            ],
            'permohonan_unit' => [
                'name' => 'Permohonan Aset Unit',
                'steps' => [self::role('Persetujuan Kasubag', 'kasubag', 'none')],
            ],
```

In `config/workflow.php`: add `use App\Services\AssetRequestEffect;`, and add `'permohonan_pegawai' => AssetRequestEffect::class,` and `'permohonan_unit' => AssetRequestEffect::class,` inside `'effects'`, and `'permohonan_pegawai' => 'subject',` and `'permohonan_unit' => 'subject',` inside `'capabilities'`.

`app/Services/AssetRequestEffect.php`:

```php
<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetRequestStatus;
use App\Models\AssetRequest;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class AssetRequestEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetRequest) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetRequest.');
        }

        if ($approvable->status !== AssetRequestStatus::Pending) {
            throw new InvalidArgumentException('Permohonan ini sudah tidak menunggu persetujuan.');
        }

        $approvable->update(['status' => AssetRequestStatus::Approved]);
    }
}
```

`app/Http/Controllers/AssetRequestController.php`:

```php
<?php

namespace App\Http\Controllers;

class AssetRequestController extends Controller
{
    // Actions arrive in Task 5; the route exists earlier because notifications link to asset-requests.show.
}
```

In `routes/web.php` add `use App\Http\Controllers\AssetRequestController;` (alphabetical among the controller imports) and, inside the `auth` group after the `asset-reports` resource line:

```php
    Route::resource('asset-requests', AssetRequestController::class)->only(['index', 'create', 'store', 'show']);
```

In `tests/Feature/WorkflowSettingsTest.php` change `->has('workflows', 7)` to `->has('workflows', 9)`.

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetRequestWorkflowTest.php`
Expected: PASS (5 tests).

Run: `php artisan test`
Expected: all green (`WorkflowDefaultsTest` counts defaults dynamically).

- [ ] **Step 5: Commit**

```bash
git add app config routes tests
git commit -m "feat: register permohonan workflows and approve effect"
```

---

## Task 3: `AssetRequestService::create`

**Files:**
- Create: `app/Services/AssetRequestService.php`
- Test: `tests/Feature/AssetRequestServiceTest.php`

**Interfaces:**
- Consumes: `AssetRequest`, `ApprovalWorkflowService::submit`.
- Produces: `AssetRequestService::create(array $data, User $actor): AssetRequest` — `$data` keys `jenis`, `pegawai_id` (pegawai request), `jumlah` (unit request), `category_id`, `keterangan`; throws `InvalidArgumentException` with a user-facing message on any violation, creating nothing. Number format `PM/{year}/{4-digit sequence}`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRequestServiceTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->service = app(AssetRequestService::class);
});

function pegawaiData(object $t, array $override = []): array
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kel->id]);

    return array_merge(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop.'], $override);
}

it('creates a pegawai request with the unit of the pegawai, jumlah 1, an auto number and a submitted approval', function () {
    $request = $this->service->create(pegawaiData($this, ['jumlah' => 5]), $this->adminKel);

    expect($request->nomor_permohonan)->toBe('PM/'.now()->year.'/0001')
        ->and($request->unit_id)->toBe($this->kel->id)
        ->and($request->jumlah)->toBe(1)
        ->and($request->status)->toBe(AssetRequestStatus::Pending)
        ->and($request->approvalRequest->definition->code)->toBe('permohonan_pegawai')
        ->and($request->approvalRequest->steps)->toHaveCount(1);
});

it('creates a unit request for the acting kelurahan and numbers requests sequentially', function () {
    $first = $this->service->create(pegawaiData($this), $this->adminKel);
    $second = $this->service->create(['jenis' => 'unit', 'jumlah' => 3, 'category_id' => $this->category->id, 'keterangan' => 'Stok kursi', 'unit_id' => $this->kec->id], $this->adminKel);

    expect($second->unit_id)->toBe($this->kel->id)
        ->and($second->pegawai_id)->toBeNull()
        ->and($second->jumlah)->toBe(3)
        ->and($second->nomor_permohonan)->toBe('PM/'.now()->year.'/0002')
        ->and($second->approvalRequest->definition->code)->toBe('permohonan_unit')
        ->and($first->nomor_permohonan)->toBe('PM/'.now()->year.'/0001');
});

it('refuses invalid requests and creates nothing', function (string $case) {
    $data = pegawaiData($this);
    $actor = $this->adminKel;

    switch ($case) {
        case 'actor is not an admin':
            $actor = userWithRole('camat', $this->kec);
            break;
        case 'pegawai of another unit':
            $data['pegawai_id'] = Pegawai::factory()->create(['unit_id' => $this->kec->id])->id;
            break;
        case 'pegawai missing':
            $data['pegawai_id'] = null;
            break;
        case 'category is not a subcategory':
            $data['category_id'] = AssetCategory::factory()->create()->id;
            break;
        case 'unit request by admin kecamatan':
            $data = ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'x'];
            $actor = $this->adminKec;
            break;
        case 'unit request with zero jumlah':
            $data = ['jenis' => 'unit', 'jumlah' => 0, 'category_id' => $this->category->id, 'keterangan' => 'x'];
            break;
    }

    $before = AssetRequest::count();
    expect(fn () => $this->service->create($data, $actor))->toThrow(InvalidArgumentException::class);
    expect(AssetRequest::count())->toBe($before);
})->with([
    'actor is not an admin', 'pegawai of another unit', 'pegawai missing', 'category is not a subcategory',
    'unit request by admin kecamatan', 'unit request with zero jumlah',
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestServiceTest.php`
Expected: FAIL (`Target class [App\Services\AssetRequestService] does not exist`).

- [ ] **Step 3: Service (create only)**

`app/Services/AssetRequestService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetRequestService
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    /** @param  array<string, mixed>  $data */
    public function create(array $data, User $actor): AssetRequest
    {
        $type = AssetRequestType::from($data['jenis']);

        return DB::transaction(function () use ($data, $actor, $type) {
            if (! $actor->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) || $actor->unit_id === null) {
                throw new InvalidArgumentException('Hanya admin unit yang dapat membuat permohonan.');
            }

            $category = AssetCategory::find($data['category_id'] ?? null);

            if ($category === null || ! $category->isSubcategory()) {
                throw new InvalidArgumentException('Pilih subkategori aset yang diminta.');
            }

            if ($type === AssetRequestType::Pegawai) {
                $pegawai = Pegawai::find($data['pegawai_id'] ?? null);

                if ($pegawai === null) {
                    throw new InvalidArgumentException('Pilih pegawai yang mengajukan permohonan.');
                }

                if (! $actor->canAccessUnit($pegawai->unit)) {
                    throw new InvalidArgumentException('Pegawai ini bukan dari unit Anda.');
                }

                $pegawaiId = $pegawai->id;
                $unitId = $pegawai->unit_id;
                $jumlah = 1;
            } else {
                if (! $actor->hasRole('admin_kelurahan')) {
                    throw new InvalidArgumentException('Hanya admin kelurahan yang dapat mengajukan permohonan unit.');
                }

                $jumlah = (int) ($data['jumlah'] ?? 0);

                if ($jumlah < 1) {
                    throw new InvalidArgumentException('Jumlah barang minimal 1.');
                }

                $pegawaiId = null;
                $unitId = $actor->unit_id;
            }

            $request = AssetRequest::create([
                'nomor_permohonan' => $this->nextNumber(),
                'jenis' => $type,
                'pegawai_id' => $pegawaiId,
                'unit_id' => $unitId,
                'category_id' => $category->id,
                'jumlah' => $jumlah,
                'keterangan' => $data['keterangan'],
                'status' => AssetRequestStatus::Pending,
                'created_by' => $actor->id,
            ]);

            $this->workflow->submit(
                $request,
                $type === AssetRequestType::Pegawai ? 'permohonan_pegawai' : 'permohonan_unit',
                $actor,
            );

            return $request;
        });
    }

    private function nextNumber(): string
    {
        $prefix = 'PM/'.now()->year.'/';

        $last = AssetRequest::where('nomor_permohonan', 'like', $prefix.'%')
            ->orderByDesc('nomor_permohonan')
            ->lockForUpdate()
            ->value('nomor_permohonan');

        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetRequestServiceTest.php`
Expected: PASS (8 tests; the dataset runs 6 cases).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app tests
git commit -m "feat: add AssetRequestService create with validation and numbering"
```

---

## Task 4: Fulfill (pegawai / unit), close, and Mutasi hooks

**Files:**
- Modify: `app/Services/AssetRequestService.php`, `app/Models/AssetMutation.php`, `app/Services/AssetMutationEffect.php`
- Test: `tests/Feature/AssetRequestFulfillTest.php`

**Interfaces:**
- Consumes: `AssetRequestService::create` (Task 3), `AssetMutationService::submit(array $data, array $items, User $creator): AssetMutation`, `AssetMutation` outcome hooks.
- Produces: `AssetRequestService::canFulfill(User, AssetRequest): bool`, `eligibleAssets(AssetRequest): Collection` (Assets), `fulfillPegawai(AssetRequest, int $assetId, User): void`, `fulfillUnit(AssetRequest, array $assetIds, User): AssetMutation`, `close(AssetRequest, string $note, User): void`; all mutating methods throw `InvalidArgumentException` with a user-facing message. Hooks: the linked request becomes `fulfilled` when its Mutasi is approved, and is released (`mutation_id` null, pivot cleared) when the Mutasi is rejected/cancelled.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRequestFulfillTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kel2 = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->adminKel2 = userWithRole('admin_kelurahan', $this->kel2);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->otherCategory = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->service = app(AssetRequestService::class);
    $this->engine = app(ApprovalWorkflowService::class);
});

function reqAsset(object $t, $unit, array $o = []): Asset
{
    return Asset::factory()->create($o + ['unit_id' => $unit->id, 'category_id' => $t->category->id]);
}

function reqPegawaiApproved(object $t): AssetRequest
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kel->id]);
    $request = $t->service->create(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop'], $t->adminKel);
    $t->engine->approve($request->approvalRequest, $t->lurah);

    return $request->fresh();
}

function reqUnitApproved(object $t, int $jumlah = 2): AssetRequest
{
    $request = $t->service->create(['jenis' => 'unit', 'jumlah' => $jumlah, 'category_id' => $t->category->id, 'keterangan' => 'Stok'], $t->adminKel);
    $t->engine->approve($request->approvalRequest, $t->kasubag);

    return $request->fresh();
}

function reqApproveMutation(object $t, AssetMutation $mutation): void
{
    $t->engine->approve($mutation->approvalRequest, $t->kasubag);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->camat);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->adminKel);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->lurah);
}

it('hands an eligible asset to the pegawai atomically and logs the handover', function () {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    $this->service->fulfillPegawai($request, $asset->id, $this->adminKel);

    $history = $asset->fresh()->histories()->first();
    expect($asset->fresh()->current_holder_id)->toBe($request->pegawai_id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($request->fresh()->fulfilled_by)->toBe($this->adminKel->id)
        ->and($request->assets()->pluck('assets.id')->all())->toBe([$asset->id])
        ->and($history->event)->toBe('serah_terima');
});

it('refuses ineligible assets and changes nothing', function (string $case) {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    switch ($case) {
        case 'asset of another unit':
            $asset->update(['unit_id' => $this->kel2->id]);
            break;
        case 'other subcategory':
            $asset->update(['category_id' => $this->otherCategory->id]);
            break;
        case 'already has a holder':
            $asset->update(['current_holder_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id]);
            break;
        case 'dalam proses':
            $asset->update(['status' => AssetStatus::DalamProses]);
            break;
        case 'lost':
            $asset->update(['kondisi' => Kondisi::Hilang]);
            break;
    }

    expect(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(0);
})->with(['asset of another unit', 'other subcategory', 'already has a holder', 'dalam proses', 'lost']);

it('refuses to fulfill twice, before approval, or by the wrong actor', function () {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);
    $other = reqAsset($this, $this->kel);

    expect(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKel2))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKec))->toThrow(InvalidArgumentException::class);

    $this->service->fulfillPegawai($request, $asset->id, $this->adminKel);
    expect(fn () => $this->service->fulfillPegawai($request->fresh(), $other->id, $this->adminKel))->toThrow(InvalidArgumentException::class);

    $pending = $this->service->create(['jenis' => 'pegawai', 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id, 'category_id' => $this->category->id, 'keterangan' => 'x'], $this->adminKel);
    expect(fn () => $this->service->fulfillPegawai($pending, reqAsset($this, $this->kel)->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
});

it('rejects a stale second request for an asset that was handed over in the meantime', function () {
    $first = reqPegawaiApproved($this);
    $second = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    $this->service->fulfillPegawai($first, $asset->id, $this->adminKel);

    expect(fn () => $this->service->fulfillPegawai($second, $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
    expect($asset->fresh()->current_holder_id)->toBe($first->pegawai_id);
});

it('lists only eligible assets for the fulfiller', function () {
    $request = reqPegawaiApproved($this);
    $ok = reqAsset($this, $this->kel);
    reqAsset($this, $this->kel, ['current_holder_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id]);
    reqAsset($this, $this->kel, ['kondisi' => Kondisi::Hilang]);
    reqAsset($this, $this->kel2);
    reqAsset($this, $this->kel, ['category_id' => $this->otherCategory->id]);

    expect($this->service->eligibleAssets($request)->pluck('id')->all())->toBe([$ok->id]);
});

it('creates and submits a kec_ke_kel mutation with the requested number of assets for a unit request', function () {
    $request = reqUnitApproved($this, 2);
    $a = reqAsset($this, $this->kec);
    $b = reqAsset($this, $this->kec);

    $mutation = $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKec);

    expect($mutation->jenis_mutasi->value)->toBe('kec_ke_kel')
        ->and($mutation->origin_unit_id)->toBe($this->kec->id)
        ->and($mutation->destination_unit_id)->toBe($this->kel->id)
        ->and($mutation->items)->toHaveCount(2)
        ->and($mutation->approvalRequest)->not->toBeNull()
        ->and($a->fresh()->status)->toBe(AssetStatus::DalamProses)
        ->and($request->fresh()->mutation_id)->toBe($mutation->id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(2);
});

it('refuses a wrong count, duplicates, ineligible assets, a second mutation and the wrong actor for a unit request', function () {
    $request = reqUnitApproved($this, 2);
    $a = reqAsset($this, $this->kec);
    $b = reqAsset($this, $this->kec);
    $lost = reqAsset($this, $this->kec, ['kondisi' => Kondisi::Hilang]);

    expect(fn () => $this->service->fulfillUnit($request, [$a->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $a->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $lost->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKel))->toThrow(InvalidArgumentException::class)
        ->and(AssetMutation::count())->toBe(0);

    $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKec);
    $c = reqAsset($this, $this->kec);
    $d = reqAsset($this, $this->kec);
    expect(fn () => $this->service->fulfillUnit($request->fresh(), [$c->id, $d->id], $this->adminKec))->toThrow(InvalidArgumentException::class);
    expect(AssetMutation::count())->toBe(1);
});

it('marks the request fulfilled when its mutation is finally approved', function () {
    $request = reqUnitApproved($this, 1);
    $asset = reqAsset($this, $this->kec);
    $mutation = $this->service->fulfillUnit($request, [$asset->id], $this->adminKec);

    reqApproveMutation($this, $mutation);

    expect($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($request->fresh()->fulfilled_at)->not->toBeNull();
});

it('frees the request to be fulfilled again when its mutation is rejected or cancelled, with a fresh mutation number', function () {
    $request = reqUnitApproved($this, 1);
    $asset = reqAsset($this, $this->kec);
    $first = $this->service->fulfillUnit($request, [$asset->id], $this->adminKec);

    $this->engine->reject($first->approvalRequest, $this->kasubag, 'Belum siap');

    expect($request->fresh()->mutation_id)->toBeNull()
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);

    $second = $this->service->fulfillUnit($request->fresh(), [$asset->id], $this->adminKec);
    expect($second->nomor_mutasi)->not->toBe($first->nomor_mutasi);

    $this->engine->cancel($second->approvalRequest, $this->adminKec, 'Salah pilih');
    expect($request->fresh()->mutation_id)->toBeNull();
});

it('lets the fulfiller close an approved request with a reason and notifies the requester', function () {
    $request = reqPegawaiApproved($this);
    $adminKelNotifications = $this->adminKel->fresh()->notifications()->count();

    $this->service->close($request, 'Stok laptop habis', $this->adminKel);

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled)
        ->and($request->fresh()->catatan_penutupan)->toBe('Stok laptop habis')
        ->and($this->adminKel->fresh()->notifications()->count())->toBe($adminKelNotifications + 1);
});

it('refuses to close a request that is pending, fulfilled, has a running mutation, or by the wrong actor', function () {
    $approved = reqPegawaiApproved($this);
    expect(fn () => $this->service->close($approved, 'x', $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->close($approved, 'x', $this->adminKel2))->toThrow(InvalidArgumentException::class);

    $unit = reqUnitApproved($this, 1);
    $this->service->fulfillUnit($unit, [reqAsset($this, $this->kec)->id], $this->adminKec);
    expect(fn () => $this->service->close($unit->fresh(), 'x', $this->adminKec))->toThrow(InvalidArgumentException::class);

    $fulfilled = reqPegawaiApproved($this);
    $this->service->fulfillPegawai($fulfilled, reqAsset($this, $this->kel)->id, $this->adminKel);
    expect(fn () => $this->service->close($fulfilled->fresh(), 'x', $this->adminKel))->toThrow(InvalidArgumentException::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestFulfillTest.php`
Expected: FAIL (`Call to undefined method ...::fulfillPegawai()`).

- [ ] **Step 3: Service methods**

In `app/Services/AssetRequestService.php` add imports:

```php
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Notifications\ApprovalStepNotification;
use Illuminate\Database\Eloquent\Collection;
```

Change the constructor to `public function __construct(private readonly ApprovalWorkflowService $workflow, private readonly AssetMutationService $mutations) {}` and add these methods (before `nextNumber()`):

```php
    public function canFulfill(User $user, AssetRequest $request): bool
    {
        if (! $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan'])) {
            return false;
        }

        return match ($request->jenis) {
            AssetRequestType::Pegawai => $user->canAccessUnit($request->unit),
            AssetRequestType::Unit => $user->hasRole('admin_kecamatan') && $request->unit->parent_id === $user->unit_id,
        };
    }

    /** @return Collection<int, Asset> */
    public function eligibleAssets(AssetRequest $request): Collection
    {
        return Asset::query()
            ->where('unit_id', $this->sourceUnitId($request))
            ->where('category_id', $request->category_id)
            ->where('status', AssetStatus::Aktif)
            ->where('kondisi', '!=', Kondisi::Hilang)
            ->when($request->jenis === AssetRequestType::Pegawai, fn ($q) => $q->whereNull('current_holder_id'))
            ->orderBy('nama_aset')
            ->get();
    }

    public function fulfillPegawai(AssetRequest $request, int $assetId, User $actor): void
    {
        DB::transaction(function () use ($request, $assetId, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->assertFulfillable($locked, $actor, AssetRequestType::Pegawai);

            $asset = Asset::whereKey($assetId)->lockForUpdate()->first();
            $this->assertAssetEligible($asset, $locked);

            $asset->update(['current_holder_id' => $locked->pegawai_id]);

            $asset->histories()->create([
                'event' => 'serah_terima',
                'unit_id' => $asset->unit_id,
                'current_holder_id' => $locked->pegawai_id,
                'kondisi' => $asset->kondisi,
                'user_id' => $actor->id,
                'keterangan' => "Serah terima untuk permohonan {$locked->nomor_permohonan} kepada {$locked->pegawai->nama}",
            ]);

            $locked->assets()->attach($asset->id);
            $locked->update([
                'status' => AssetRequestStatus::Fulfilled,
                'fulfilled_by' => $actor->id,
                'fulfilled_at' => now(),
            ]);
        });
    }

    /** @param  list<int>  $assetIds */
    public function fulfillUnit(AssetRequest $request, array $assetIds, User $actor): AssetMutation
    {
        return DB::transaction(function () use ($request, $assetIds, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->assertFulfillable($locked, $actor, AssetRequestType::Unit);

            $ids = array_values(array_unique(array_map('intval', $assetIds)));

            if (count($ids) !== count($assetIds)) {
                throw new InvalidArgumentException('Satu aset tidak boleh dipilih lebih dari sekali.');
            }

            if (count($ids) !== $locked->jumlah) {
                throw new InvalidArgumentException("Pilih tepat {$locked->jumlah} aset untuk permohonan ini.");
            }

            $assets = Asset::whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

            foreach ($ids as $id) {
                $this->assertAssetEligible($assets->get($id), $locked);
            }

            $sequence = AssetMutation::where('nomor_mutasi', 'like', "MUT/{$locked->nomor_permohonan}%")->count() + 1;

            $mutation = $this->mutations->submit(
                [
                    'nomor_mutasi' => "MUT/{$locked->nomor_permohonan}/{$sequence}",
                    'jenis_mutasi' => MutationType::KecKeKel->value,
                    'origin_unit_id' => $locked->unit->parent_id,
                    'destination_unit_id' => $locked->unit_id,
                    'tanggal_mutasi' => now()->toDateString(),
                    'keterangan' => "Pemenuhan permohonan {$locked->nomor_permohonan}",
                ],
                array_map(fn (int $id) => ['asset_id' => $id], $ids),
                $actor,
            );

            $locked->assets()->sync($ids);
            $locked->update(['mutation_id' => $mutation->id]);

            return $mutation;
        });
    }

    public function close(AssetRequest $request, string $note, User $actor): void
    {
        $approval = DB::transaction(function () use ($request, $note, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== AssetRequestStatus::Approved || $locked->mutation_id !== null) {
                throw new InvalidArgumentException('Hanya permohonan yang sudah disetujui dan belum diproses yang dapat ditutup.');
            }

            if (! $this->canFulfill($actor, $locked)) {
                throw new InvalidArgumentException('Anda tidak berwenang menutup permohonan ini.');
            }

            $locked->update(['status' => AssetRequestStatus::Cancelled, 'catatan_penutupan' => $note]);

            return $locked->approvalRequest;
        });

        $request->creator->notify(new ApprovalStepNotification($approval, "Permohonan {$request->nomor_permohonan} ditutup: {$note}"));
    }

    private function sourceUnitId(AssetRequest $request): int
    {
        return $request->jenis === AssetRequestType::Pegawai ? $request->unit_id : $request->unit->parent_id;
    }

    private function assertFulfillable(AssetRequest $request, User $actor, AssetRequestType $expected): void
    {
        if ($request->jenis !== $expected) {
            throw new InvalidArgumentException('Jenis permohonan tidak sesuai dengan tindakan ini.');
        }

        if ($request->status !== AssetRequestStatus::Approved) {
            throw new InvalidArgumentException('Permohonan ini belum disetujui atau sudah selesai.');
        }

        if ($request->mutation_id !== null) {
            throw new InvalidArgumentException('Permohonan ini sudah dalam proses mutasi.');
        }

        if (! $this->canFulfill($actor, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang memenuhi permohonan ini.');
        }
    }

    private function assertAssetEligible(?Asset $asset, AssetRequest $request): void
    {
        if ($asset === null) {
            throw new InvalidArgumentException('Aset yang dipilih tidak ditemukan.');
        }

        $valid = $asset->unit_id === $this->sourceUnitId($request)
            && $asset->category_id === $request->category_id
            && $asset->status === AssetStatus::Aktif
            && $asset->kondisi !== Kondisi::Hilang
            && ($request->jenis !== AssetRequestType::Pegawai || $asset->current_holder_id === null);

        if (! $valid) {
            throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" tidak memenuhi syarat untuk permohonan ini.");
        }
    }
```

- [ ] **Step 4: Mutasi hooks**

In `app/Models/AssetMutation.php` replace `release()` with (add `use App\Models\AssetRequest` is not needed — same namespace):

```php
    private function release(MutationStatus $status): void
    {
        $this->update(['status' => $status]);
        Asset::whereIn('id', $this->items()->pluck('asset_id'))->update(['status' => AssetStatus::Aktif]);

        AssetRequest::where('mutation_id', $this->id)->get()->each(function (AssetRequest $request) {
            $request->assets()->detach();
            $request->update(['mutation_id' => null]);
        });
    }
```

In `app/Services/AssetMutationEffect.php` add `use App\Enums\AssetRequestStatus;` and `use App\Models\AssetRequest;`, and right after `$approvable->update(['status' => MutationStatus::Approved]);` add:

```php
            AssetRequest::where('mutation_id', $approvable->id)
                ->where('status', AssetRequestStatus::Approved)
                ->update([
                    'status' => AssetRequestStatus::Fulfilled,
                    'fulfilled_by' => auth()->id() ?? $approvable->created_by,
                    'fulfilled_at' => now(),
                ]);
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/AssetRequestFulfillTest.php`
Expected: PASS (all tests; the dataset runs 5 cases).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app tests
git commit -m "feat: fulfill and close asset requests, with mutation hooks"
```

---

## Task 5: Policy, form requests, controller and routes

**Files:**
- Create: `app/Policies/AssetRequestPolicy.php`, `app/Http/Requests/StorePermohonanRequest.php`, `app/Http/Requests/FulfillPermohonanRequest.php`, `app/Http/Requests/ClosePermohonanRequest.php`
- Modify: `app/Http/Controllers/AssetRequestController.php` (replace the skeleton), `routes/web.php`
- Test: `tests/Feature/AssetRequestControllerTest.php`

**Interfaces:**
- Consumes: `AssetRequestService` (Tasks 3-4), engine helpers.
- Produces: routes `asset-requests.{index,create,store,show}` (already registered), `asset-requests.fulfill` (`POST /asset-requests/{assetRequest}/fulfill`, body `asset_ids[]`), `asset-requests.close` (`POST .../close`, body `note`); Inertia components `AssetRequests/Index` (props `items` paginator with `pegawai`, `unit`, `category`, `creator`, `approval_request`; `filters` `{search,status,jenis,menunggu_pemenuhan}`; `can.create`), `AssetRequests/Create` (props `pegawais` `[{id,nama,unit}]`, `categories` `[{id,name}]`, `canUnit` bool), `AssetRequests/Show` (props `assetRequest` with `pegawai`, `unit`, `category`, `creator`, `fulfiller`, `mutation`, `assets`, `approval_request.{definition,steps,actions.user}`; `can.{act,cancel,reassign,fulfill,close}`; `reassignCandidates`; `eligibleAssets` `[{id,kode_barang,nama_aset,merk_type,kondisi}]`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRequestControllerTest.php`:

```php
<?php

use App\Enums\AssetRequestStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->engine = app(ApprovalWorkflowService::class);
});

function storePegawaiPayload(object $t, $unit, array $o = []): array
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $unit->id]);

    return $o + ['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop'];
}

it('lets an admin file a pegawai request and a kelurahan admin a unit request', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA))->assertRedirect();
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 3, 'category_id' => $this->category->id, 'keterangan' => 'Stok kursi'])->assertRedirect();

    expect(AssetRequest::count())->toBe(2)
        ->and(AssetRequest::where('jenis', 'unit')->first()->unit_id)->toBe($this->kelA->id);
});

it('refuses crafted or unauthorised submissions', function () {
    $foreign = storePegawaiPayload($this, $this->kelB);

    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), $foreign)->assertRedirect()->assertSessionHas('error');
    $this->actingAs($this->adminKec)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'x'])
        ->assertRedirect()->assertSessionHas('error');
    foreach (['camat', 'lurahA', 'kasubag'] as $who) {
        $this->actingAs($this->$who)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA))->assertForbidden();
        $this->actingAs($this->$who)->get(route('asset-requests.create'))->assertForbidden();
    }
    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA, ['keterangan' => '']))
        ->assertSessionHasErrors('keterangan');

    expect(AssetRequest::count())->toBe(0);
});

it('offers the create form only the own-unit pegawai and subcategories', function () {
    Pegawai::factory()->create(['unit_id' => $this->kelA->id]);
    Pegawai::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-requests.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('AssetRequests/Create')
            ->has('pegawais', 1)
            ->where('canUnit', true)
            ->where('categories', fn ($c) => collect($c)->pluck('id')->contains($this->category->id)));

    $this->actingAs($this->adminKec)->get(route('asset-requests.create'))
        ->assertInertia(fn (Assert $p) => $p->where('canUnit', false));
});

it('scopes the index and detail page, giving the parent kecamatan admin sight of unit requests from its kelurahan', function () {
    $mine = AssetRequest::factory()->unitRequest()->create();
    $mine->unit->update(['name' => 'Kelurahan A']);
    $unitRequestA = AssetRequest::factory()->create(['unit_id' => $this->kelA->id, 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelA->id])->id]);
    $unitRequestB = AssetRequest::factory()->create(['unit_id' => $this->kelB->id, 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelB->id])->id]);
    $kelAUnitReq = AssetRequest::factory()->unitRequest()->create(['unit_id' => $this->kelA->id]);
    $kelAUnitReq->update(['pegawai_id' => null]);

    $ids = fn ($user, $query = '') => collect($this->actingAs($user)->get('/asset-requests'.$query)->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();

    expect($ids($this->adminKelA))->toBe(collect([$unitRequestA->id, $kelAUnitReq->id])->sort()->values()->all())
        ->and($ids($this->adminKelB))->toBe([$unitRequestB->id])
        ->and($ids($this->adminKec))->toBe([$kelAUnitReq->id])
        ->and($ids($this->camat))->toBe(collect([$unitRequestA->id, $unitRequestB->id, $kelAUnitReq->id])->sort()->values()->all());

    $this->actingAs($this->adminKelB)->get(route('asset-requests.show', $unitRequestA))->assertForbidden();
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $kelAUnitReq))->assertOk();
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $unitRequestA))->assertForbidden();
});

it('filters the index by status, jenis and pending fulfilment', function () {
    $pending = AssetRequest::factory()->create(['unit_id' => $this->kelA->id, 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelA->id])->id]);
    $approved = AssetRequest::factory()->create(['status' => 'approved', 'unit_id' => $this->kelA->id, 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelA->id])->id]);

    $ids = fn ($query) => collect($this->actingAs($this->kasubag)->get('/asset-requests'.$query)->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();

    expect($ids('?status=pending'))->toBe([$pending->id])
        ->and($ids('?menunggu_pemenuhan=1'))->toBe([$approved->id])
        ->and($ids('?jenis=unit'))->toBe([]);
});

it('exposes action flags and eligible assets on the detail page and completes the pegawai flow over HTTP', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA));
    $request = AssetRequest::firstOrFail();
    $asset = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->has('assetRequest.approval_request.steps', 1)
            ->where('can.cancel', true)->where('can.act', false)->where('can.fulfill', false)->where('eligibleAssets', []));
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $request->approvalRequest))->assertRedirect();

    $this->actingAs($this->adminKelA)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->where('can.fulfill', true)->where('can.close', true)
            ->where('eligibleAssets', fn ($a) => collect($a)->pluck('id')->all() === [$asset->id]));
    $this->actingAs($this->adminKelB)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertForbidden();
    $this->actingAs($this->adminKec)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertForbidden();

    $this->actingAs($this->adminKelA)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertRedirect();

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($asset->fresh()->current_holder_id)->toBe($request->pegawai_id);
});

it('completes the unit flow over HTTP with a mutation and flashes clear errors', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'Stok']);
    $request = AssetRequest::firstOrFail();
    $this->actingAs($this->kasubag)->post(route('approval-requests.approve', $request->approvalRequest))->assertRedirect();
    $a = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->category->id]);
    $b = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->adminKelA)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id, $b->id]])->assertForbidden();
    $this->actingAs($this->adminKec)->from('/x')->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id]])
        ->assertRedirect('/x')->assertSessionHas('error');
    $this->actingAs($this->adminKec)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id, $b->id]])->assertRedirect();

    $request->refresh();
    expect($request->mutation_id)->not->toBeNull()
        ->and($request->mutation->items)->toHaveCount(2);
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->where('can.fulfill', false)->where('can.close', false)->has('assetRequest.mutation'));
});

it('closes an approved request over HTTP with a required reason', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA));
    $request = AssetRequest::firstOrFail();
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $request->approvalRequest));

    $url = route('asset-requests.close', $request);
    $this->actingAs($this->adminKelA)->from('/x')->post($url, [])->assertSessionHasErrors('note');
    $this->actingAs($this->adminKelB)->post($url, ['note' => 'x'])->assertForbidden();
    $this->actingAs($this->adminKelA)->post($url, ['note' => 'Stok habis'])->assertRedirect();

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRequestControllerTest.php`
Expected: FAIL (`Route [asset-requests.fulfill] not defined` / controller empty).

- [ ] **Step 3: Policy, form requests**

`app/Policies/AssetRequestPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use App\Models\User;
use App\Services\AssetRequestService;

class AssetRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function view(User $user, AssetRequest $request): bool
    {
        if ($user->canAccessUnit($request->unit)) {
            return true;
        }

        return $request->jenis === AssetRequestType::Unit
            && $user->hasRole('admin_kecamatan')
            && $request->unit->parent_id === $user->unit_id;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->unit_id !== null;
    }

    public function fulfill(User $user, AssetRequest $request): bool
    {
        return app(AssetRequestService::class)->canFulfill($user, $request);
    }
}
```

`app/Http/Requests/StorePermohonanRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', AssetRequest::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'jenis' => ['required', Rule::enum(AssetRequestType::class)],
            'pegawai_id' => ['nullable', 'integer', 'required_if:jenis,pegawai'],
            'jumlah' => ['nullable', 'integer', 'min:1', 'max:1000', 'required_if:jenis,unit'],
            'category_id' => ['required', 'integer', Rule::exists('asset_categories', 'id')->whereNotNull('parent_id')],
            'keterangan' => ['required', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'keterangan.required' => 'Keterangan wajib diisi.',
            'pegawai_id.required_if' => 'Pilih pegawai yang mengajukan permohonan.',
            'jumlah.required_if' => 'Jumlah barang wajib diisi.',
            'category_id.exists' => 'Pilih subkategori aset yang valid.',
        ];
    }
}
```

`app/Http/Requests/FulfillPermohonanRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FulfillPermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('fulfill', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['asset_ids.required' => 'Pilih aset yang akan diserahkan.'];
    }
}
```

`app/Http/Requests/ClosePermohonanRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ClosePermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('fulfill', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['note' => ['required', 'string', 'max:1000']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['note.required' => 'Alasan penutupan wajib diisi.'];
    }
}
```

- [ ] **Step 4: Controller and routes**

Replace `app/Http/Controllers/AssetRequestController.php` with:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Http\Requests\ClosePermohonanRequest;
use App\Http\Requests\FulfillPermohonanRequest;
use App\Http\Requests\StorePermohonanRequest;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetRequestController extends Controller
{
    public function __construct(
        private readonly AssetRequestService $requests,
        private readonly ApprovalWorkflowService $workflow,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetRequest::class);

        $user = $request->user();
        $unitIds = $user->accessibleUnitIds();
        $binaanIds = $user->hasRole('admin_kecamatan') ? Unit::where('parent_id', $user->unit_id)->pluck('id')->all() : [];

        $items = AssetRequest::with(['pegawai', 'unit', 'category', 'creator', 'approvalRequest'])
            ->when($unitIds !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereIn('unit_id', $unitIds)
                ->orWhere(fn (Builder $x) => $x->where('jenis', AssetRequestType::Unit)->whereIn('unit_id', $binaanIds))
            ))
            ->when($request->status, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->jenis, fn (Builder $q, string $jenis) => $q->where('jenis', $jenis))
            ->when($request->boolean('menunggu_pemenuhan'), fn (Builder $q) => $q->where('status', AssetRequestStatus::Approved)->whereNull('mutation_id'))
            ->when($request->search, fn (Builder $q, string $search) => $q->where(fn (Builder $q2) => $q2
                ->where('nomor_permohonan', 'like', "%{$search}%")
                ->orWhere('keterangan', 'like', "%{$search}%")
            ))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('AssetRequests/Index', [
            'items' => $items,
            'filters' => $request->only('search', 'status', 'jenis', 'menunggu_pemenuhan'),
            'can' => ['create' => $user->can('create', AssetRequest::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetRequest::class);

        $user = $request->user();

        return Inertia::render('AssetRequests/Create', [
            'pegawais' => Pegawai::whereIn('unit_id', $user->accessibleUnitIds() ?? [])
                ->orderBy('nama')->get(['id', 'nama', 'jabatan']),
            'categories' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'canUnit' => $user->hasRole('admin_kelurahan'),
        ]);
    }

    public function store(StorePermohonanRequest $request): RedirectResponse
    {
        try {
            $assetRequest = $this->requests->create($request->validated(), $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('asset-requests.show', $assetRequest)
            ->with('success', "Permohonan #{$assetRequest->nomor_permohonan} berhasil diajukan.");
    }

    public function show(Request $request, AssetRequest $assetRequest): Response
    {
        Gate::authorize('view', $assetRequest);

        $assetRequest->load([
            'pegawai', 'unit', 'category', 'creator', 'fulfiller', 'mutation', 'assets',
            'approvalRequest.definition', 'approvalRequest.steps', 'approvalRequest.actions.user',
        ]);

        $approval = $assetRequest->approvalRequest;
        $user = $request->user();
        $canReassign = $approval !== null && $this->workflow->canReassign($user, $approval);
        $canFulfill = $assetRequest->status === AssetRequestStatus::Approved
            && $assetRequest->mutation_id === null
            && $this->requests->canFulfill($user, $assetRequest);

        return Inertia::render('AssetRequests/Show', [
            'assetRequest' => $assetRequest,
            'can' => [
                'act' => $approval !== null && $this->workflow->canAct($user, $approval),
                'cancel' => $approval !== null && $this->workflow->canCancel($user, $approval),
                'reassign' => $canReassign,
                'fulfill' => $canFulfill,
                'close' => $canFulfill,
            ],
            'reassignCandidates' => $canReassign ? $this->workflow->reassignCandidates() : [],
            'eligibleAssets' => $canFulfill
                ? $this->requests->eligibleAssets($assetRequest)->map(fn ($a) => [
                    'id' => $a->id, 'kode_barang' => $a->kode_barang, 'nama_aset' => $a->nama_aset,
                    'merk_type' => $a->merk_type, 'kondisi' => $a->kondisi->value,
                ])->values()
                : [],
        ]);
    }

    public function fulfill(FulfillPermohonanRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        $ids = array_map('intval', $request->validated('asset_ids'));

        try {
            if ($assetRequest->jenis === AssetRequestType::Pegawai) {
                if (count($ids) !== 1) {
                    throw new InvalidArgumentException('Pilih tepat satu aset untuk permohonan pegawai.');
                }

                $this->requests->fulfillPegawai($assetRequest, $ids[0], $request->user());
                $message = 'Aset berhasil diserahkan kepada pegawai.';
            } else {
                $mutation = $this->requests->fulfillUnit($assetRequest, $ids, $request->user());
                $message = "Mutasi #{$mutation->nomor_mutasi} diajukan untuk memenuhi permohonan.";
            }
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $message);
    }

    public function close(ClosePermohonanRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        try {
            $this->requests->close($assetRequest, $request->validated('note'), $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Permohonan ditutup.');
    }
}
```

In `routes/web.php`, right after the `asset-requests` resource line add:

```php
    Route::post('/asset-requests/{assetRequest}/fulfill', [AssetRequestController::class, 'fulfill'])->name('asset-requests.fulfill');
    Route::post('/asset-requests/{assetRequest}/close', [AssetRequestController::class, 'close'])->name('asset-requests.close');
```

- [ ] **Step 5: Stub pages so Inertia component checks pass**

```bash
mkdir -p resources/js/Pages/AssetRequests
printf "export default function Index() {\n    return null;\n}\n" > resources/js/Pages/AssetRequests/Index.tsx
printf "export default function Create() {\n    return null;\n}\n" > resources/js/Pages/AssetRequests/Create.tsx
printf "export default function Show() {\n    return null;\n}\n" > resources/js/Pages/AssetRequests/Show.tsx
```

(Task 6 replaces them with the real pages.)

- [ ] **Step 6: Run tests**

Run: `php artisan test tests/Feature/AssetRequestControllerTest.php`
Expected: PASS (8 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app routes tests resources/js/Pages/AssetRequests
git commit -m "feat: add asset request policy, controller and routes"
```

---

## Task 6: Frontend — types, navigation, Index, Create, Show

**Files:**
- Modify: `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts`
- Create: `resources/js/lib/assetRequest.ts`
- Replace stubs: `resources/js/Pages/AssetRequests/Index.tsx`, `Create.tsx`, `Show.tsx`

**Interfaces:**
- Consumes: page props from Task 5; `CancelRequestModal`, `ReassignApproverModal`; routes `asset-requests.*`, `approval-requests.{approve,reject}`, `asset-mutations.show`.

- [ ] **Step 1: Types, labels, navigation**

Append to `resources/js/types/index.d.ts`:

```ts
export type AssetRequestStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
export type AssetRequestType = 'pegawai' | 'unit';

export interface AssetRequest {
    id: number;
    nomor_permohonan: string;
    jenis: AssetRequestType;
    pegawai_id: number | null;
    unit_id: number;
    category_id: number;
    jumlah: number;
    keterangan: string;
    status: AssetRequestStatus;
    mutation_id: number | null;
    fulfilled_at: string | null;
    catatan_penutupan: string | null;
    pegawai?: Pegawai | null;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    category?: { id: number; name: string };
    creator?: { id: number; name: string };
    fulfiller?: { id: number; name: string } | null;
    mutation?: { id: number; nomor_mutasi: string; status: string } | null;
    assets?: Asset[];
    approval_request?: ApprovalRequestSummary | null;
}
```

`resources/js/lib/assetRequest.ts`:

```ts
import { AssetRequestStatus, AssetRequestType } from '@/types';

export const REQUEST_STATUS_LABEL: Record<AssetRequestStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Menunggu Pemenuhan',
    fulfilled: 'Dipenuhi',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REQUEST_STATUS_STYLE: Record<AssetRequestStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-blue-50 text-blue-700',
    fulfilled: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

export const REQUEST_TYPE_LABEL: Record<AssetRequestType, string> = {
    pegawai: 'Pegawai',
    unit: 'Unit',
};
```

In `resources/js/config/navigation.ts` change the `Permohonan Aset` item (currently `href: '#'`, `disabled: true`) to:

```ts
            {
                label: 'Permohonan Aset',
                href: '/asset-requests',
                icon: 'file-text',
            },
```

- [ ] **Step 2: Index page** (`resources/js/Pages/AssetRequests/Index.tsx`, replacing the stub)

```tsx
import { ChevronRightIcon as ChevronRight, EyeIcon as Eye, PlusIcon as Plus, SearchIcon as Search } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { AssetRequest, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetRequest>;
    filters: { search?: string; status?: string; jenis?: string; menunggu_pemenuhan?: string };
    can: { create: boolean };
}

const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Index({ items, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(items.current_page, items.last_page);
    const waiting = filters.menunggu_pemenuhan === '1';

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-requests.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Permohonan Aset" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Permohonan Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Permohonan Aset</h1>
                    </div>
                    {can.create && (
                        <Link href={route('asset-requests.create')} className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                            <Plus className="h-4 w-4" /> Buat Permohonan
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
                            placeholder="Cari nomor permohonan atau keterangan..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </form>
                    <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua status</option>
                        {Object.entries(REQUEST_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={filters.jenis ?? ''} onChange={(e) => go({ jenis: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua jenis</option>
                        {Object.entries(REQUEST_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={() => go({ menunggu_pemenuhan: waiting ? undefined : '1', page: undefined })}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${waiting ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                        Menunggu Pemenuhan
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">No. Permohonan</th>
                                <th className="px-4 py-3">Jenis</th>
                                <th className="px-4 py-3">Pemohon</th>
                                <th className="px-4 py-3">Subkategori</th>
                                <th className="px-4 py-3 text-right">Jumlah</th>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                            {items.data.length === 0 ? (
                                <tr><td colSpan={8} className="py-14 text-center text-sm text-slate-400">Belum ada permohonan.</td></tr>
                            ) : (
                                items.data.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-medium">{r.nomor_permohonan}</td>
                                        <td className="px-4 py-3">{REQUEST_TYPE_LABEL[r.jenis]}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">{r.jenis === 'pegawai' ? r.pegawai?.nama : r.unit?.name}</td>
                                        <td className="px-4 py-3">{r.category?.name}</td>
                                        <td className="px-4 py-3 text-right">{r.jumlah}</td>
                                        <td className="px-4 py-3">{new Date(r.created_at as string).toLocaleDateString('id-ID')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REQUEST_STATUS_STYLE[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link href={route('asset-requests.show', r.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700">
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
                            Menampilkan <span className="font-semibold text-slate-800">{items.from ?? 0}-{items.to ?? 0}</span> dari <span className="font-semibold text-slate-800">{items.total}</span> permohonan
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

The `AssetRequest` type has no `created_at`; add `created_at?: string;` to the `AssetRequest` interface from Step 1 and use `r.created_at ?? ''` guard if `tsc` complains.

- [ ] **Step 3: Create page** (`resources/js/Pages/AssetRequests/Create.tsx`, replacing the stub)

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetRequestType, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    pegawais: { id: number; nama: string; jabatan: string | null }[];
    categories: { id: number; name: string }[];
    canUnit: boolean;
}

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Create({ pegawais, categories, canUnit }: CreateProps) {
    const form = useForm({
        jenis: 'pegawai' as AssetRequestType,
        pegawai_id: '',
        jumlah: '1',
        category_id: '',
        keterangan: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) =>
            data.jenis === 'pegawai'
                ? { ...data, jumlah: '' }
                : { ...data, pegawai_id: '' },
        );
        form.post(route('asset-requests.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Permohonan Aset" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('asset-requests.index')} className="hover:text-blue-700">Permohonan Aset</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Buat Permohonan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Buat Permohonan Aset</h1>
                </div>

                <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Jenis Permohonan *</label>
                        <div className="flex flex-col gap-2 text-sm">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="jenis" checked={form.data.jenis === 'pegawai'} onChange={() => form.setData('jenis', 'pegawai')} />
                                Untuk pegawai (aset diserahkan ke pegawai dari stok unit)
                            </label>
                            {canUnit && (
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="jenis" checked={form.data.jenis === 'unit'} onChange={() => form.setData('jenis', 'unit')} />
                                    Untuk unit (minta stok dari kecamatan)
                                </label>
                            )}
                        </div>
                        {form.errors.jenis && <p className="mt-1 text-xs text-red-600">{form.errors.jenis}</p>}
                    </div>

                    {form.data.jenis === 'pegawai' ? (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Pegawai *</label>
                            <select value={form.data.pegawai_id} onChange={(e) => form.setData('pegawai_id', e.target.value)} className={FIELD}>
                                <option value="">Pilih pegawai...</option>
                                {pegawais.map((p) => <option key={p.id} value={p.id}>{p.nama}{p.jabatan ? ` — ${p.jabatan}` : ''}</option>)}
                            </select>
                            {form.errors.pegawai_id && <p className="mt-1 text-xs text-red-600">{form.errors.pegawai_id}</p>}
                        </div>
                    ) : (
                        <div className="max-w-xs">
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Jumlah Barang *</label>
                            <input type="number" min={1} value={form.data.jumlah} onChange={(e) => form.setData('jumlah', e.target.value)} className={FIELD} />
                            {form.errors.jumlah && <p className="mt-1 text-xs text-red-600">{form.errors.jumlah}</p>}
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Subkategori Aset yang Diminta *</label>
                        <select value={form.data.category_id} onChange={(e) => form.setData('category_id', e.target.value)} className={FIELD}>
                            <option value="">Pilih subkategori...</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {form.errors.category_id && <p className="mt-1 text-xs text-red-600">{form.errors.category_id}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Keterangan / Alasan *</label>
                        <textarea value={form.data.keterangan} onChange={(e) => form.setData('keterangan', e.target.value)} rows={4} className={FIELD} placeholder="Jelaskan kebutuhan dan alasan permohonan." />
                        {form.errors.keterangan && <p className="mt-1 text-xs text-red-600">{form.errors.keterangan}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link href={route('asset-requests.index')} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</Link>
                        <button type="submit" disabled={form.processing} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {form.processing ? 'Mengirim...' : 'Ajukan Permohonan'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Show page** (`resources/js/Pages/AssetRequests/Show.tsx`, replacing the stub)

```tsx
import CancelRequestModal from '@/Components/CancelRequestModal';
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface EligibleAsset {
    id: number;
    kode_barang: string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
}

interface ShowProps extends PageProps {
    assetRequest: AssetRequest;
    can: { act: boolean; cancel: boolean; reassign: boolean; fulfill: boolean; close: boolean };
    reassignCandidates: ReassignCandidate[];
    eligibleAssets: EligibleAsset[];
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

export default function Show({ assetRequest: r, can, reassignCandidates, eligibleAssets }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [note, setNote] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const req = r.approval_request;
    const steps = req?.steps ?? [];
    const single = r.jenis === 'pegawai';

    const toggle = (id: number) =>
        setSelected((cur) => (single ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

    const post = (name: string, params: object, data: object, onSuccess?: () => void) => {
        if (submitting) return;
        setSubmitting(true);
        router.post(route(name, params), data, { preserveScroll: true, onSuccess, onFinish: () => setSubmitting(false) });
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
        ['Nomor Permohonan', r.nomor_permohonan],
        ['Jenis', REQUEST_TYPE_LABEL[r.jenis]],
        ['Pemohon', r.jenis === 'pegawai' ? (r.pegawai?.nama ?? '—') : (r.unit?.name ?? '—')],
        ['Unit', r.unit?.name ?? '—'],
        ['Subkategori', r.category?.name ?? '—'],
        ['Jumlah', String(r.jumlah)],
        ['Diajukan Oleh', r.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Permohonan #${r.nomor_permohonan}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('asset-requests.index')} className="hover:text-blue-700">Permohonan Aset</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <div className="mt-1 flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Permohonan #{r.nomor_permohonan}</h1>
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REQUEST_STATUS_STYLE[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {can.cancel && <button onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batalkan Pengajuan</button>}
                        {can.reassign && <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Alihkan Approver</button>}
                        {can.close && <button onClick={() => setShowClose(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tutup Permohonan</button>}
                        {can.act && (
                            <>
                                <button onClick={() => setShowReject(true)} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tolak</button>
                                <button onClick={() => req && post('approval-requests.approve', req.id, {})} disabled={submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{submitting ? 'Memproses...' : 'Setujui'}</button>
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
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Permohonan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Keterangan</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{r.keterangan}</p>
                        {r.catatan_penutupan && (
                            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Ditutup: {r.catatan_penutupan}</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Pemenuhan</p>

                        {r.mutation && (
                            <p className="mb-3 text-sm text-slate-700">
                                Mutasi:{' '}
                                <Link href={route('asset-mutations.show', r.mutation.id)} className="font-semibold text-blue-700 hover:underline">{r.mutation.nomor_mutasi}</Link>
                            </p>
                        )}

                        {(r.assets?.length ?? 0) > 0 && (
                            <ul className="mb-3 space-y-1.5 text-sm">
                                {r.assets?.map((a) => (
                                    <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <Link href={route('assets.show', a.id)} className="font-semibold text-slate-900 hover:text-blue-700">{a.nama_aset}</Link>
                                        <span className="ml-2 text-xs text-slate-500">{a.kode_barang}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {can.fulfill ? (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-600">
                                    Pilih {single ? '1 aset' : `tepat ${r.jumlah} aset`} yang memenuhi syarat ({selected.length} dipilih).
                                </p>
                                {eligibleAssets.length === 0 ? (
                                    <p className="text-sm text-amber-700">Belum ada aset yang memenuhi syarat. Anda dapat menutup permohonan ini.</p>
                                ) : (
                                    <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
                                        {eligibleAssets.map((a) => (
                                            <li key={a.id}>
                                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                                                    <input type={single ? 'radio' : 'checkbox'} name="asset" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                                                    <span className="font-medium text-slate-900">{a.nama_aset}</span>
                                                    <span className="text-xs text-slate-500">{a.kode_barang}{a.merk_type ? ` · ${a.merk_type}` : ''}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    type="button"
                                    onClick={() => post('asset-requests.fulfill', r.id, { asset_ids: selected }, () => setSelected([]))}
                                    disabled={submitting || selected.length === 0 || (!single && selected.length !== r.jumlah)}
                                    className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                                >
                                    {single ? 'Serahkan ke Pegawai' : 'Ajukan Mutasi Pemenuhan'}
                                </button>
                            </div>
                        ) : (
                            r.status === 'approved' && !r.mutation && <p className="text-sm text-slate-500">Menunggu pemenuhan oleh admin unit terkait.</p>
                        )}
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Permohonan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {r.creator?.name}</p>
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
                    description="Permohonan dihentikan dan tidak lagi muncul di kotak persetujuan."
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

            {(showReject || showClose) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowReject(false); setShowClose(false); }}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">{showClose ? 'Tutup Permohonan' : 'Tolak Permohonan'}</h3>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Alasan (wajib diisi)" className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setShowReject(false); setShowClose(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button
                                disabled={!note.trim() || submitting}
                                onClick={() => {
                                    const done = () => { setShowReject(false); setShowClose(false); setNote(''); };
                                    if (showClose) post('asset-requests.close', r.id, { note: note.trim() }, done);
                                    else if (req) post('approval-requests.reject', req.id, { note: note.trim() }, done);
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {showClose ? 'Ya, Tutup' : 'Ya, Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors (add `created_at?: string;` to the `AssetRequest` interface if flagged; the `Icons` names used here already exist elsewhere in the project).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification (browser)**

1. `php artisan migrate` and `php artisan db:seed --class=WorkflowDefinitionSeeder` on the dev DB.
2. As `admin.kelurahan@simaset.test` (or the seeded admin of a kelurahan): sidebar shows "Permohonan Aset" (no longer "Segera hadir"); Create a **pegawai** request → detail shows tracker "Persetujuan Atasan Unit — Menunggu". As the matching `lurah`: item in `/persetujuan`, Setujui → status "Menunggu Pemenuhan". Back as the admin: the "Pemenuhan" panel lists eligible assets (unit's assets without holder, same subkategori); pick one → "Serahkan ke Pegawai" → status Dipenuhi; the asset detail shows the new holder and a history entry.
3. Create a **unit** request (jumlah 2) as admin kelurahan → as `kasubag` Setujui → as `admin.kecamatan` open it (visible), pick 2 assets → "Ajukan Mutasi Pemenuhan" → a Mutasi appears with a link; approve the Mutasi chain (kasubag, camat, admin kelurahan, lurah) → the request becomes Dipenuhi and the assets are in the kelurahan. Also reject a Mutasi once → the request can be fulfilled again.
4. "Tutup Permohonan" with a reason on an approved request → Dibatalkan. Clean up all test data afterwards.

- [ ] **Step 7: Commit**

```bash
git add resources
git commit -m "feat: add Permohonan Aset pages and enable sidebar entry"
```

---

## Task 7: Docs and final regression

**Files:**
- Modify: `docs/DETAIL_RBAC_SISTEM.md`, `docs/superpowers/specs/2026-10-02-permohonan-aset-design.md`

- [ ] **Step 1: Update `docs/DETAIL_RBAC_SISTEM.md`**

In the §4 matrix change the "Permohonan Kebutuhan Aset" row so its cells read: Kasubag `Approve permohonan unit`, Camat `Approve pegawai kecamatan`, Admin Kec. `Input + penuhi`, Admin Kel. `Input + penuhi`, Lurah `Approve pegawai kelurahan`, and its last column `✅ Selesai (`AssetRequestPolicy`, workflow `permohonan_pegawai`/`permohonan_unit`)`. In §6 add to the list of workflow definitions: `8. Permohonan Aset Pegawai (permohonan_pegawai): Step 1: Atasan Unit [Scope: Subject]` and `9. Permohonan Aset Unit (permohonan_unit): Step 1: Kasubag [Scope: None]`.

- [ ] **Step 2: Mark the spec implemented**

In the spec header change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-10-02-permohonan-aset.md).`

- [ ] **Step 3: Full regression**

Run: `php artisan test`
Expected: all green.

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add docs/DETAIL_RBAC_SISTEM.md docs/superpowers/specs/2026-10-02-permohonan-aset-design.md
git commit -m "docs: document Permohonan Aset workflows and permissions"
```
