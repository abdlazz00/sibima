# Pengaturan Alur Persetujuan Dinamis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kasubag can configure from the UI which approval steps each workflow has and who approves each step (a role, a specific user, or the subject unit's superior), running requests keep the steps they started with, and Kasubag can reassign the current approver of a pending request.

**Architecture:** `workflow_steps` stays the editable template and gains `label`, `approver_type` (`role`/`user`/`atasan_unit`) and `approver_user_id`. `ApprovalWorkflowService::submit()` copies the template into a per-request snapshot table `approval_request_steps`; `canAct`, notification recipients and the inbox all read the snapshot through one `stepAllows()` rule. A `WorkflowSettingsService` + `WorkflowSettingsController` (Kasubag only) replace a workflow's steps atomically, validate them against per-workflow capabilities in `config/workflow.php`, and write `workflow_change_logs`.

**Tech Stack:** Laravel 13 (PHP ^8.3), MySQL (dev) / SQLite in-memory (tests), Pest 5, spatie/laravel-permission 8, Inertia 2 + React 18 + TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-09-30-pengaturan-alur-persetujuan-design.md`

## Global Constraints

- PHP ^8.3, Laravel 13, MySQL in dev/prod; tests run on SQLite `:memory:` — no MySQL-only SQL.
- Backend convention: Controller (orchestration only) → FormRequest (validation + `authorize()`) → Service (business logic) → Policy. Use `Gate::authorize()` in controllers where no FormRequest is in play.
- Approver types are exactly `role`, `user`, `atasan_unit` (`App\Enums\ApproverType`). `user` is **exclusive** to the named user (no role/unit check). `atasan_unit` means: `camat` if the subject unit `isKecamatan()`, otherwise `lurah`, and the user must `canAccessUnit()` the subject unit.
- Only `kasubag` may open/change the workflow settings and reassign an approver.
- A running request never changes when a template is edited (snapshot at submit). The only allowed change to a running request is reassigning its **current** step to a specific user.
- No conditional steps, no parallel approvers, no new workflow types from the UI, no account deactivation feature ("aktif user" means the user has at least one role).
- Reuse existing helpers/patterns: `userWithRole()`, `makeKecamatan()`, `makeKelurahan()` from `tests/Pest.php`; `User::canAccessUnit()`; `HasWorkflowUnits`; `HandlesApprovalOutcome`; existing Show pages' modal style (`CancelRequestModal`).
- UI copy in Bahasa Indonesia.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution) line.**
- Operational note (also documented in Task 8): after pulling this work run `php artisan migrate` then `php artisan db:seed --class=WorkflowDefinitionSeeder`. The seeder is **non-destructive** (it never overwrites steps an admin has edited).

## Review Focus

- **Editing a workflow must not shift a running request** (its steps, current step and approver stay as at submit). → pinned in Task 1 (snapshot test) and Task 6 (new submission follows new flow, old one does not).
- **A `user` step whose approver is gone (`approver_user_id` null) must let nobody act**, not fall through to "everyone". → pinned in Task 2.
- **After Kasubag reassigns a step, the previous approver holding a stale copy of the request must not be able to approve.** → pinned in Task 3 (re-check `canAct` on the locked row).
- **A save that fails validation must change nothing and write no audit log.** → pinned in Task 6.
- **A non-Kasubag must be refused over HTTP (403) for reassign and for every settings endpoint**, not merely have the button hidden. → pinned in Tasks 3 and 6.

## File Structure

| File | Responsibility |
|---|---|
| `app/Enums/ApproverType.php` (new) | `role` / `user` / `atasan_unit` |
| `app/Models/ApprovalRequestStep.php` (new) | per-request step snapshot row |
| `app/Models/WorkflowChangeLog.php` (new) | audit log row |
| `app/Models/WorkflowStep.php`, `ApprovalRequest.php`, `WorkflowDefinition.php` | new columns/relations; `ApprovalRequest::snapshotSteps()` |
| `app/Services/ApprovalWorkflowService.php` | snapshot at submit, `stepAllows()`, `reassign()`, locked re-check |
| `app/Support/WorkflowDefaults.php` (new) | default steps + labels per workflow code, `applyTo()` |
| `app/Services/WorkflowSettingsService.php` (new) | replace steps atomically, reset to default, audit log |
| `app/Http/Requests/UpdateWorkflowRequest.php`, `ReassignApprovalRequest.php` (new) | validation |
| `app/Http/Controllers/WorkflowSettingsController.php` (new) | index / edit / update / reset |
| `app/Policies/WorkflowDefinitionPolicy.php` (new) | Kasubag only |
| `config/workflow.php` | `capabilities` map |
| `resources/js/Pages/WorkflowSettings/{Index,Edit}.tsx` (new) | settings UI |
| `resources/js/Components/ReassignApproverModal.tsx` (new) | reassign modal |

---

## Task 1: Schema, models and per-request step snapshot

**Files:**
- Create: `app/Enums/ApproverType.php`
- Create: `database/migrations/2026_09_30_100000_add_approver_columns_to_workflow_steps_table.php`
- Create: `database/migrations/2026_09_30_100001_create_approval_request_steps_table.php`
- Create: `database/migrations/2026_09_30_100002_create_workflow_change_logs_table.php`
- Create: `database/migrations/2026_09_30_100003_backfill_workflow_step_labels_and_snapshots.php`
- Create: `app/Models/ApprovalRequestStep.php`, `app/Models/WorkflowChangeLog.php`
- Modify: `app/Models/WorkflowStep.php`, `app/Models/ApprovalRequest.php`, `app/Models/WorkflowDefinition.php`
- Modify: `app/Services/ApprovalWorkflowService.php` (snapshot in `submit()`, type hint in `approversFor()`)
- Modify (tests that build an `ApprovalRequest` by hand): `tests/Feature/WorkflowEngineModelsTest.php`, `tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php`
- Test: `tests/Feature/ApprovalRequestStepsTest.php`

**Interfaces:**
- Produces: `ApproverType` enum (`Role`, `User`, `AtasanUnit`); `ApprovalRequestStep` model (`step_order`, `label`, `approver_type: ApproverType`, `approver_role: ?string`, `unit_scope: UnitScope`, `approver_user_id: ?int`, `request()`, `approverUser()`); `ApprovalRequest::steps(): HasMany` (ordered), `ApprovalRequest::snapshotSteps(): void`; `currentStepDefinition(): ?ApprovalRequestStep` and `isLastStep()` now read the snapshot; `WorkflowChangeLog` model; `WorkflowDefinition::requests()` and `::changeLogs()`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/ApprovalRequestStepsTest.php`:

```php
<?php

use App\Enums\ApprovalStatus;
use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->service = app(ApprovalWorkflowService::class);

    $this->ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/S/001', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/S', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
});

it('copies the template steps into the request when it is submitted', function () {
    $request = $this->service->submit($this->ba, 'penerimaan_aset', $this->admin);

    $steps = $request->fresh()->steps;

    expect($steps)->toHaveCount(2)
        ->and($steps[0]->approver_type)->toBe(ApproverType::Role)
        ->and($steps[0]->approver_role)->toBe('kasubag')
        ->and($steps[0]->unit_scope)->toBe(UnitScope::None)
        ->and($steps[1]->approver_role)->toBe('camat')
        ->and($steps[1]->unit_scope)->toBe(UnitScope::Subject);
});

it('keeps a running request on its original steps when the template is edited afterwards', function () {
    $request = $this->service->submit($this->ba, 'penerimaan_aset', $this->admin);

    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $definition->steps()->where('step_order', 1)->update(['approver_role' => 'camat']);
    $definition->steps()->where('step_order', 2)->delete();

    $reloaded = ApprovalRequest::findOrFail($request->id);

    expect($reloaded->steps)->toHaveCount(2)
        ->and($reloaded->currentStepDefinition()->approver_role)->toBe('kasubag')
        ->and($reloaded->isLastStep())->toBeFalse()
        ->and($this->service->canAct($this->kasubag, $reloaded))->toBeTrue()
        ->and($this->service->canAct($this->camat, $reloaded))->toBeFalse();
});

it('backfills a snapshot for requests that have none, and is safe to run twice', function () {
    $request = ApprovalRequest::create([
        'workflow_definition_id' => WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail()->id,
        'approvable_type' => $this->ba->getMorphClass(),
        'approvable_id' => $this->ba->id,
        'current_step' => 1,
        'status' => ApprovalStatus::Pending,
        'created_by' => $this->admin->id,
    ]);
    expect($request->steps()->count())->toBe(0);

    $migration = require database_path('migrations/2026_09_30_100003_backfill_workflow_step_labels_and_snapshots.php');
    $migration->up();
    $migration->up();

    expect($request->steps()->count())->toBe(2)
        ->and($request->steps()->orderBy('step_order')->first()->approver_role)->toBe('kasubag');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ApprovalRequestStepsTest.php`
Expected: FAIL (`Call to undefined relationship [steps] on model [App\Models\ApprovalRequest]` / class `ApproverType` not found).

- [ ] **Step 3: Enum and migrations**

`app/Enums/ApproverType.php`:

```php
<?php

namespace App\Enums;

enum ApproverType: string
{
    case Role = 'role';
    case User = 'user';
    case AtasanUnit = 'atasan_unit';

    public function label(): string
    {
        return match ($this) {
            self::Role => 'Role',
            self::User => 'User tertentu',
            self::AtasanUnit => 'Atasan unit',
        };
    }
}
```

`database/migrations/2026_09_30_100000_add_approver_columns_to_workflow_steps_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->string('label')->default('');
            $table->string('approver_type')->default('role');
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->string('approver_role')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approver_user_id');
            $table->dropColumn(['label', 'approver_type']);
        });
    }
};
```

`database/migrations/2026_09_30_100001_create_approval_request_steps_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_request_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_request_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_order');
            $table->string('label');
            $table->string('approver_type')->default('role');
            $table->string('approver_role')->nullable();
            $table->string('unit_scope');
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['approval_request_id', 'step_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_request_steps');
    }
};
```

`database/migrations/2026_09_30_100002_create_workflow_change_logs_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_change_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_definition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->string('event');
            $table->json('steps_before');
            $table->json('steps_after');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_change_logs');
    }
};
```

`database/migrations/2026_09_30_100003_backfill_workflow_step_labels_and_snapshots.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLE_LABELS = [
        'kasubag' => 'Verifikasi Kasubag',
        'camat' => 'Persetujuan Camat',
        'lurah' => 'Persetujuan Lurah',
        'admin_kecamatan' => 'Konfirmasi Admin Kecamatan',
        'admin_kelurahan' => 'Konfirmasi Admin Kelurahan',
    ];

    public function up(): void
    {
        foreach (DB::table('workflow_steps')->where('label', '')->get() as $step) {
            DB::table('workflow_steps')->where('id', $step->id)->update([
                'label' => self::ROLE_LABELS[$step->approver_role] ?? ucfirst(str_replace('_', ' ', (string) $step->approver_role)),
            ]);
        }

        $requests = DB::table('approval_requests')
            ->whereNotIn('id', DB::table('approval_request_steps')->select('approval_request_id'))
            ->get(['id', 'workflow_definition_id']);

        foreach ($requests as $request) {
            $steps = DB::table('workflow_steps')
                ->where('workflow_definition_id', $request->workflow_definition_id)
                ->get();

            foreach ($steps as $step) {
                DB::table('approval_request_steps')->insert([
                    'approval_request_id' => $request->id,
                    'step_order' => $step->step_order,
                    'label' => $step->label,
                    'approver_type' => $step->approver_type,
                    'approver_role' => $step->approver_role,
                    'unit_scope' => $step->unit_scope,
                    'approver_user_id' => $step->approver_user_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void {}
};
```

- [ ] **Step 4: Models**

`app/Models/ApprovalRequestStep.php`:

```php
<?php

namespace App\Models;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalRequestStep extends Model
{
    protected $fillable = [
        'approval_request_id', 'step_order', 'label', 'approver_type',
        'approver_role', 'unit_scope', 'approver_user_id',
    ];

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'approver_type' => ApproverType::class,
            'unit_scope' => UnitScope::class,
            'approver_user_id' => 'integer',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
```

`app/Models/WorkflowChangeLog.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowChangeLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['workflow_definition_id', 'user_id', 'event', 'steps_before', 'steps_after'];

    protected function casts(): array
    {
        return ['steps_before' => 'array', 'steps_after' => 'array'];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

`app/Models/WorkflowStep.php` (replace the whole file):

```php
<?php

namespace App\Models;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStep extends Model
{
    protected $fillable = [
        'workflow_definition_id', 'step_order', 'label', 'approver_type',
        'approver_role', 'approver_user_id', 'unit_scope',
    ];

    protected function casts(): array
    {
        return [
            'unit_scope' => UnitScope::class,
            'approver_type' => ApproverType::class,
            'step_order' => 'integer',
            'approver_user_id' => 'integer',
        ];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
```

`app/Models/WorkflowDefinition.php` (replace the whole file):

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowDefinition extends Model
{
    protected $fillable = ['code', 'name'];

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class)->orderBy('step_order');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class);
    }

    public function changeLogs(): HasMany
    {
        return $this->hasMany(WorkflowChangeLog::class)->latest('id');
    }
}
```

`app/Models/ApprovalRequest.php`: replace `currentStepDefinition()` and `isLastStep()` and add the relation + snapshot method. Final relevant part of the class:

```php
    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalRequestStep::class)->orderBy('step_order');
    }

    public function snapshotSteps(): void
    {
        $this->steps()->delete();

        foreach ($this->definition->steps()->get() as $step) {
            $this->steps()->create([
                'step_order' => $step->step_order,
                'label' => $step->label,
                'approver_type' => $step->approver_type,
                'approver_role' => $step->approver_role,
                'unit_scope' => $step->unit_scope,
                'approver_user_id' => $step->approver_user_id,
            ]);
        }

        $this->unsetRelation('steps');
    }

    public function currentStepDefinition(): ?ApprovalRequestStep
    {
        return $this->steps->firstWhere('step_order', $this->current_step);
    }

    public function isLastStep(): bool
    {
        return $this->current_step >= $this->steps->max('step_order');
    }
```

- [ ] **Step 5: Service — snapshot at submit and type hint**

In `app/Services/ApprovalWorkflowService.php`:

1. In `submit()`, right after `ApprovalRequest::create([...])` and before `$request->setRelation('approvable', $approvable);` add:

```php
        $request->snapshotSteps();
```

2. Replace `use App\Models\WorkflowStep;` with `use App\Models\ApprovalRequestStep;` and change the signature `private function approversFor(WorkflowStep $step, Model $approvable): Collection` to `private function approversFor(ApprovalRequestStep $step, Model $approvable): Collection`.

- [ ] **Step 6: Update the existing tests that create an `ApprovalRequest` by hand**

`tests/Feature/WorkflowEngineModelsTest.php`, test "resolves the current step definition and detects the last step": immediately after the `$request = ApprovalRequest::create([...]);` statement add `$request->snapshotSteps();`.

`tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php`, test "resolves canAct correctly for Origin and Destination scopes": after the `$request = ApprovalRequest::create([...]);` statement add `$request->snapshotSteps();`.

- [ ] **Step 7: Run the new tests and the whole suite**

Run: `php artisan test tests/Feature/ApprovalRequestStepsTest.php`
Expected: PASS (3 tests).

Run: `php artisan test`
Expected: all green (no regressions; existing engine tests now run against snapshots).

- [ ] **Step 8: Commit**

```bash
git add app database tests
git commit -m "feat: snapshot workflow steps per approval request and add approver columns"
```

---

## Task 2: Approver types in the engine (`role` / `user` / `atasan_unit`)

**Files:**
- Modify: `app/Services/ApprovalWorkflowService.php` (`canAct`, `approversFor`, `pendingFor`, new private helpers)
- Test: `tests/Feature/ApproverTypesTest.php`

**Interfaces:**
- Consumes: `ApprovalRequestStep`, `ApproverType` (Task 1).
- Produces: `canAct()`, `approversFor()` (private) and `pendingFor()` honour `approver_type`; private `stepAllows(User, ApprovalRequestStep, Model): bool` is the single rule used by all three.

- [ ] **Step 1: Write the failing test**

`tests/Feature/ApproverTypesTest.php`:

```php
<?php

use App\Contracts\WorkflowEffect;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Model;
use Spatie\Permission\Models\Role;

class NoopWorkflowEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void {}
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'lurah', 'admin_kecamatan'] as $role) {
        Role::findOrCreate($role);
    }

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag1 = userWithRole('kasubag');
    $this->kasubag2 = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->lurahB = userWithRole('lurah', $this->kelB);
    $this->service = app(ApprovalWorkflowService::class);

    config(['workflow.effects.test_flow' => NoopWorkflowEffect::class]);
    $this->seq = 0;
});

function testFlow(array $steps): void
{
    $definition = WorkflowDefinition::create(['code' => 'test_flow', 'name' => 'Test Flow']);
    foreach ($steps as $i => $step) {
        $definition->steps()->create($step + ['step_order' => $i + 1, 'label' => 'Langkah '.($i + 1)]);
    }
}

function baFor(object $t, $unit)
{
    $t->seq++;

    return BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/T/'.$t->seq, 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/T', 'unit_id' => $unit->id,
        'created_by' => $t->admin->id, 'status' => 'submitted',
    ]);
}

it('lets only the named user act on a user step and notifies only them', function () {
    testFlow([['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => $this->kasubag1->id, 'unit_scope' => 'none']]);

    $request = $this->service->submit(baFor($this, $this->kec), 'test_flow', $this->admin);

    expect($this->service->canAct($this->kasubag1, $request))->toBeTrue()
        ->and($this->service->canAct($this->kasubag2, $request))->toBeFalse()
        ->and($this->service->canAct($this->camat, $request))->toBeFalse()
        ->and($this->kasubag1->fresh()->notifications)->toHaveCount(1)
        ->and($this->kasubag2->fresh()->notifications)->toHaveCount(0)
        ->and($this->service->pendingFor($this->kasubag1))->toHaveCount(1)
        ->and($this->service->pendingFor($this->kasubag2))->toHaveCount(0);
});

it('resolves atasan_unit to the camat for a kecamatan subject and the lurah for a kelurahan subject', function () {
    testFlow([['approver_type' => 'atasan_unit', 'approver_role' => null, 'approver_user_id' => null, 'unit_scope' => 'subject']]);

    $kecRequest = $this->service->submit(baFor($this, $this->kec), 'test_flow', $this->admin);
    $kelRequest = $this->service->submit(baFor($this, $this->kelA), 'test_flow', $this->admin);

    expect($this->service->canAct($this->camat, $kecRequest))->toBeTrue()
        ->and($this->service->canAct($this->lurahA, $kecRequest))->toBeFalse()
        ->and($this->service->canAct($this->lurahA, $kelRequest))->toBeTrue()
        ->and($this->service->canAct($this->lurahB, $kelRequest))->toBeFalse()
        ->and($this->service->canAct($this->camat, $kelRequest))->toBeFalse()
        ->and($this->camat->fresh()->notifications)->toHaveCount(1)
        ->and($this->lurahA->fresh()->notifications)->toHaveCount(1)
        ->and($this->lurahB->fresh()->notifications)->toHaveCount(0);
});

it('lets nobody act on a user step whose approver no longer exists', function () {
    testFlow([['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => $this->kasubag1->id, 'unit_scope' => 'none']]);
    $request = $this->service->submit(baFor($this, $this->kec), 'test_flow', $this->admin);

    $request->steps()->update(['approver_user_id' => null]);
    $request = $request->fresh();

    foreach (['kasubag1', 'kasubag2', 'camat', 'lurahA', 'admin'] as $who) {
        expect($this->service->canAct($this->$who, $request))->toBeFalse();
    }
    expect($this->service->pendingFor($this->kasubag1))->toHaveCount(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ApproverTypesTest.php`
Expected: FAIL — the user-step test fails because `canAct` calls `hasRole(null)`/ignores `approver_user_id`, and `atasan_unit` steps are not understood.

- [ ] **Step 3: Rewrite `canAct` and `approversFor`**

In `app/Services/ApprovalWorkflowService.php` add imports `use App\Enums\ApproverType;` and `use App\Models\Unit;`.

Replace the whole `canAct()` method with:

```php
    public function canAct(User $user, ApprovalRequest $request): bool
    {
        if ($request->status !== ApprovalStatus::Pending) {
            return false;
        }

        $step = $request->currentStepDefinition();

        return $step !== null && $this->stepAllows($user, $step, $request->approvable);
    }
```

Replace the whole `approversFor()` method with:

```php
    /** @return Collection<int, User> */
    private function approversFor(ApprovalRequestStep $step, Model $approvable): Collection
    {
        $candidates = match ($step->approver_type) {
            ApproverType::User => User::whereKey($step->approver_user_id)->get(),
            ApproverType::AtasanUnit => User::role($this->atasanRole($approvable))->get(),
            ApproverType::Role => User::role($step->approver_role)->get(),
        };

        return $candidates->filter(fn (User $u) => $this->stepAllows($u, $step, $approvable))->values();
    }

    private function stepAllows(User $user, ApprovalRequestStep $step, Model $approvable): bool
    {
        return match ($step->approver_type) {
            ApproverType::User => $step->approver_user_id !== null && $user->id === $step->approver_user_id,
            ApproverType::AtasanUnit => $this->allowsAtasanUnit($user, $approvable),
            ApproverType::Role => $step->approver_role !== null
                && $user->hasRole($step->approver_role)
                && $this->inUnitScope($user, $step->unit_scope, $approvable),
        };
    }

    private function allowsAtasanUnit(User $user, Model $approvable): bool
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit
            && $user->hasRole($unit->isKecamatan() ? 'camat' : 'lurah')
            && $user->canAccessUnit($unit);
    }

    private function atasanRole(Model $approvable): string
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit && $unit->isKecamatan() ? 'camat' : 'lurah';
    }

    private function inUnitScope(User $user, UnitScope $scope, Model $approvable): bool
    {
        return match ($scope) {
            UnitScope::None => true,
            UnitScope::Subject => $user->canAccessUnit($approvable->unit),
            UnitScope::Origin => $approvable instanceof HasWorkflowUnits
                && $user->canAccessUnit($approvable->getOriginUnit()),
            UnitScope::Destination => $approvable instanceof HasWorkflowUnits
                && $user->canAccessUnit($approvable->getDestinationUnit()),
        };
    }
```

In `pendingFor()` add `'steps',` to the `with([...])` array (next to `'definition'` and `'creator'`).

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/ApproverTypesTest.php`
Expected: PASS (3 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app tests
git commit -m "feat: support role, user and atasan_unit approver types in the approval engine"
```

---

## Task 3: Reassign the current approver (service, HTTP, page props)

**Files:**
- Modify: `app/Enums/ApprovalActionType.php` (add `Reassign`)
- Modify: `app/Services/ApprovalWorkflowService.php` (`reassign`, `canReassign`, `reassignCandidates`, locked re-check in `approve`/`reject`)
- Create: `app/Http/Requests/ReassignApprovalRequest.php`
- Modify: `app/Http/Controllers/ApprovalActionController.php`, `routes/web.php`
- Modify: `app/Http/Controllers/PenerimaanAsetController.php`, `app/Http/Controllers/AssetMutationController.php` (`show()` props)
- Test: `tests/Feature/ApprovalReassignTest.php`

**Interfaces:**
- Consumes: `ApprovalRequestStep`, `ApproverType`, `stepAllows` (Tasks 1-2).
- Produces: `ApprovalWorkflowService::reassign(ApprovalRequest $request, User $by, User $to, string $note): void` (throws `InvalidArgumentException`), `canReassign(User $user, ApprovalRequest $request): bool`, `reassignCandidates(): array` (list of `['id','name','role','unit']`); route `approval-requests.reassign` (`POST /approval-requests/{approvalRequest}/reassign`, body `user_id`, `note`); Show pages receive `can.reassign` (bool), `reassignCandidates` (array) and `beritaAcara.approval_request.steps` / `mutation.approval_request.steps`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/ApprovalReassignTest.php`:

```php
<?php

use App\Enums\ApprovalStatus;
use App\Enums\ApproverType;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequest;
use App\Models\AssetMutation;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubagA = userWithRole('kasubag');
    $this->kasubagB = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->service = app(ApprovalWorkflowService::class);

    $this->ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/R/001', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/R', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $this->request = $this->service->submit($this->ba, 'penerimaan_aset', $this->admin);
});

it('reassigns the current step to a specific user, logs it and notifies the new approver', function () {
    $this->service->reassign($this->request, $this->kasubagA, $this->kasubagB, 'Sedang cuti');

    $request = $this->request->fresh();
    $step = $request->currentStepDefinition();

    expect($step->approver_type)->toBe(ApproverType::User)
        ->and($step->approver_user_id)->toBe($this->kasubagB->id)
        ->and($this->service->canAct($this->kasubagB, $request))->toBeTrue()
        ->and($this->service->canAct($this->kasubagA, $request))->toBeFalse()
        ->and($request->actions()->where('action', 'reassign')->where('note', 'like', '%Sedang cuti%')->exists())->toBeTrue()
        // kasubagB was already notified at submit (role step), plus one for the reassignment
        ->and($this->kasubagB->fresh()->notifications)->toHaveCount(2)
        ->and($this->kasubagA->fresh()->notifications)->toHaveCount(1);

    $template = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail()->steps()->first();
    expect($template->approver_type)->toBe(ApproverType::Role);
});

it('only lets a kasubag reassign, only while pending, and only to a user that has a role', function () {
    expect(fn () => $this->service->reassign($this->request, $this->camat, $this->kasubagB, 'x'))->toThrow(InvalidArgumentException::class);

    $noRole = User::factory()->create();
    expect(fn () => $this->service->reassign($this->request, $this->kasubagA, $noRole, 'x'))->toThrow(InvalidArgumentException::class);

    $this->service->cancel($this->request, $this->admin, 'Batal');
    expect(fn () => $this->service->reassign($this->request->fresh(), $this->kasubagA, $this->kasubagB, 'x'))->toThrow(InvalidArgumentException::class);
});

it('refuses the previous approver holding a stale copy of the request', function () {
    $stale = ApprovalRequest::findOrFail($this->request->id);
    expect($this->service->canAct($this->kasubagA, $stale))->toBeTrue();

    $this->service->reassign($this->request, $this->kasubagA, $this->kasubagB, 'Cuti');

    expect(fn () => $this->service->approve($stale, $this->kasubagA))->toThrow(InvalidArgumentException::class);
    expect($this->request->fresh()->current_step)->toBe(1)
        ->and($this->request->fresh()->status)->toBe(ApprovalStatus::Pending);
});

it('reassigns over HTTP for a kasubag and refuses everyone else', function () {
    $url = route('approval-requests.reassign', $this->request);

    $this->actingAs($this->camat)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'x'])->assertForbidden();
    $this->actingAs($this->admin)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'x'])->assertForbidden();

    $this->actingAs($this->kasubagA)->from('/x')->post($url, ['user_id' => $this->kasubagB->id])->assertSessionHasErrors('note');
    $this->actingAs($this->kasubagA)->from('/x')->post($url, ['note' => 'x'])->assertSessionHasErrors('user_id');

    $this->actingAs($this->kasubagA)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'Cuti'])->assertRedirect();
    expect($this->request->fresh()->currentStepDefinition()->approver_user_id)->toBe($this->kasubagB->id);
});

it('exposes the steps, can.reassign and candidates on the penerimaan detail page only for a kasubag', function () {
    $this->actingAs($this->kasubagA)->get(route('penerimaan-aset.show', $this->ba))
        ->assertInertia(fn (Assert $p) => $p
            ->has('beritaAcara.approval_request.steps', 2)
            ->where('can.reassign', true)
            ->has('reassignCandidates')
            ->where('reassignCandidates', fn ($c) => collect($c)->pluck('id')->contains($this->camat->id)));

    foreach ([$this->camat, $this->admin] as $other) {
        $this->actingAs($other)->get(route('penerimaan-aset.show', $this->ba))
            ->assertInertia(fn (Assert $p) => $p->where('can.reassign', false)->where('reassignCandidates', []));
    }
});

it('exposes the steps, can.reassign and candidates on the mutation detail page', function () {
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/R/1', 'jenis_mutasi' => MutationType::Internal,
        'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kec->id,
        'tanggal_mutasi' => '2026-09-29', 'status' => MutationStatus::Pending, 'created_by' => $this->admin->id,
    ]);
    $this->service->submit($mutation, 'mutasi_internal_kec', $this->admin);

    $this->actingAs($this->kasubagA)->get(route('asset-mutations.show', $mutation))
        ->assertInertia(fn (Assert $p) => $p
            ->has('mutation.approval_request.steps', 1)
            ->where('can.reassign', true)
            ->has('reassignCandidates'));
    $this->actingAs($this->camat)->get(route('asset-mutations.show', $mutation))
        ->assertInertia(fn (Assert $p) => $p->where('can.reassign', false)->where('reassignCandidates', []));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ApprovalReassignTest.php`
Expected: FAIL (`Call to undefined method ...::reassign()` / route `approval-requests.reassign` not defined).

- [ ] **Step 3: Enum + service**

`app/Enums/ApprovalActionType.php` — add `case Reassign = 'reassign';` after `Cancel`.

In `app/Services/ApprovalWorkflowService.php` add `use App\Enums\ApproverType;` (if not already) and `use App\Enums\UnitScope;` (already imported). Add these public methods (place after `cancel()`):

```php
    public function canReassign(User $user, ApprovalRequest $request): bool
    {
        return $user->hasRole('kasubag') && $request->status === ApprovalStatus::Pending;
    }

    public function reassign(ApprovalRequest $request, User $by, User $to, string $note): void
    {
        if (! $this->canReassign($by, $request)) {
            throw new InvalidArgumentException('Hanya Kasubag yang dapat mengalihkan approver pengajuan yang masih pending.');
        }

        if ($to->getRoleNames()->isEmpty()) {
            throw new InvalidArgumentException('Approver tujuan harus memiliki akun dengan role yang valid.');
        }

        DB::transaction(function () use ($request, $by, $to, $note) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ApprovalStatus::Pending) {
                throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
            }

            $step = $locked->currentStepDefinition();

            if ($step === null) {
                throw new InvalidArgumentException('Langkah pengajuan tidak ditemukan.');
            }

            $step->update([
                'approver_type' => ApproverType::User,
                'approver_role' => null,
                'approver_user_id' => $to->id,
                'unit_scope' => UnitScope::None,
            ]);

            $locked->actions()->create([
                'step_order' => $locked->current_step,
                'user_id' => $by->id,
                'action' => ApprovalActionType::Reassign,
                'note' => "Dialihkan dari {$step->label} ke {$to->name}: {$note}",
            ]);
        });

        $request->unsetRelation('steps');
        $this->notifyApprovers($request->fresh());
    }

    /** @return list<array{id: int, name: string, role: ?string, unit: ?string}> */
    public function reassignCandidates(): array
    {
        return User::whereHas('roles')->with(['roles', 'unit'])->orderBy('name')->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->getRoleNames()->first(),
                'unit' => $u->unit?->name,
            ])->all();
    }
```

In **both** `approve()` and `reject()`, inside the transaction right after the existing `if ($locked->status !== ApprovalStatus::Pending || $locked->current_step !== $request->current_step) { throw ...; }` block, add a re-check against the fresh locked row (so an approver removed by a reassignment cannot act on a stale copy):

```php
            if (! $this->canAct($approver, $locked)) {
                throw new InvalidArgumentException('Anda tidak lagi berwenang pada langkah ini.');
            }
```

- [ ] **Step 4: FormRequest, controller action, route**

`app/Http/Requests/ReassignApprovalRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReassignApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only kasubag may reassign; the controller checks ApprovalWorkflowService::canReassign().
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'note' => ['required', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Pilih user tujuan pengalihan.',
            'note.required' => 'Alasan pengalihan wajib diisi.',
        ];
    }
}
```

In `app/Http/Controllers/ApprovalActionController.php` add imports `use App\Http\Requests\ReassignApprovalRequest;` and `use App\Models\User;`, then append this method before the closing brace:

```php
    public function reassign(ReassignApprovalRequest $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canReassign($request->user(), $approvalRequest), 403);

        try {
            $this->workflow->reassign(
                $approvalRequest,
                $request->user(),
                User::findOrFail($request->validated('user_id')),
                $request->validated('note'),
            );
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Approver berhasil dialihkan.');
    }
```

In `routes/web.php`, right after the `approval-requests.cancel` route add:

```php
    Route::post('/approval-requests/{approvalRequest}/reassign', [ApprovalActionController::class, 'reassign'])->name('approval-requests.reassign');
```

- [ ] **Step 5: Detail-page props**

`app/Http/Controllers/PenerimaanAsetController.php`, in `show()`:

- change the eager-load list `'approvalRequest.definition.steps', 'approvalRequest.actions.user',` to `'approvalRequest.definition.steps', 'approvalRequest.steps', 'approvalRequest.actions.user',` (keep `definition.steps` for now so the current tracker keeps working until Task 4 switches the frontend to the snapshot);
- in the `'can' => [...]` array add `'reassign' => $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest),`;
- add a sibling prop next to `'can'`: `'reassignCandidates' => $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest) ? $this->workflow->reassignCandidates() : [],`.

`app/Http/Controllers/AssetMutationController.php`, in `show()`:

- change `'approvalRequest.definition.steps',` to `'approvalRequest.definition.steps', 'approvalRequest.steps',` (same reason: `definition.steps` is removed in Task 4);
- replace the `Inertia::render('AssetMutations/Show', [...])` call with:

```php
        $workflow = app(ApprovalWorkflowService::class);
        $user = $request->user();
        $canReassign = $approvalRequest !== null && $workflow->canReassign($user, $approvalRequest);

        return Inertia::render('AssetMutations/Show', [
            'mutation' => $assetMutation,
            'can' => [
                'act' => $approvalRequest !== null && $workflow->canAct($user, $approvalRequest),
                'cancel' => $approvalRequest !== null && $workflow->canCancel($user, $approvalRequest),
                'reassign' => $canReassign,
            ],
            'reassignCandidates' => $canReassign ? $workflow->reassignCandidates() : [],
        ]);
```

- [ ] **Step 6: Run tests**

Run: `php artisan test tests/Feature/ApprovalReassignTest.php`
Expected: PASS (6 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app routes tests
git commit -m "feat: let kasubag reassign the current approver of a pending request"
```

---

## Task 4: Frontend — tracker labels from the snapshot and the reassign modal

**Files:**
- Create: `resources/js/Components/ReassignApproverModal.tsx`
- Modify: `resources/js/types/index.d.ts`
- Modify: `resources/js/Pages/Penerimaan/Show.tsx`, `resources/js/Pages/AssetMutations/Show.tsx`

**Interfaces:**
- Consumes: page props from Task 3 (`can.reassign`, `reassignCandidates`, `*.approval_request.steps` with `label`); route `approval-requests.reassign`.

- [ ] **Step 1: Types**

In `resources/js/types/index.d.ts`:

- replace the `ApprovalStep` interface with:

```ts
export interface ApprovalStep {
    step_order: number;
    label: string;
    approver_type: 'role' | 'user' | 'atasan_unit';
    approver_role: string | null;
    approver_user_id?: number | null;
    unit_scope?: string;
}

export interface ReassignCandidate {
    id: number;
    name: string;
    role: string | null;
    unit: string | null;
}
```

- in `ApprovalActionEntry` change `action: 'approve' | 'reject' | 'cancel';` to `action: 'approve' | 'reject' | 'cancel' | 'reassign';`
- in `ApprovalRequestSummary` replace `definition?: { name: string; steps?: ApprovalStep[] };` with `definition?: { name: string };\n    steps?: ApprovalStep[];`

- [ ] **Step 2: Modal component**

`resources/js/Components/ReassignApproverModal.tsx`:

```tsx
import { ReassignCandidate } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface ReassignApproverModalProps {
    approvalRequestId: number;
    candidates: ReassignCandidate[];
    onClose: () => void;
}

export default function ReassignApproverModal({ approvalRequestId, candidates, onClose }: ReassignApproverModalProps) {
    const [userId, setUserId] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        if (submitting || !userId || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reassign', approvalRequestId),
            { user_id: Number(userId), note: note.trim() },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !submitting && onClose()}>
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-2 text-base font-bold text-slate-900">Alihkan Approver</h3>
                <p className="mb-4 text-xs leading-relaxed text-slate-600">
                    Langkah yang sedang menunggu akan dialihkan ke satu user tertentu. Perubahan ini hanya berlaku untuk pengajuan ini dan tercatat di riwayat.
                </p>
                <label htmlFor="reassign-user" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Alihkan ke <span className="text-red-600">*</span>
                </label>
                <select
                    id="reassign-user"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="mb-4 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                >
                    <option value="">Pilih user...</option>
                    {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({c.role ?? '-'}{c.unit ? `, ${c.unit}` : ''})
                        </option>
                    ))}
                </select>
                <label htmlFor="reassign-note" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Alasan <span className="text-red-600">*</span>
                </label>
                <textarea
                    id="reassign-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Batal
                    </button>
                    <button type="button" onClick={submit} disabled={!userId || !note.trim() || submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {submitting ? 'Memproses...' : 'Alihkan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2b: Penerimaan Show**

In `resources/js/Pages/Penerimaan/Show.tsx`:

1. Add imports: `import ReassignApproverModal from '@/Components/ReassignApproverModal';` and change the types import to `import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';`.
2. `ShowProps`: change `can` to `can: { act: boolean; cancel: boolean; edit: boolean; delete: boolean; reassign: boolean };` and add `reassignCandidates: ReassignCandidate[];`.
3. Function signature: `export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {` and add state `const [showReassign, setShowReassign] = useState(false);` next to the other `useState` lines.
4. Delete the `stepLabel` helper function entirely, and change `{stepLabel(step.approver_role)}` in the tracker to `{step.label}` (the line becomes `Step {step.step_order}: {step.label}`).
5. `const steps = req?.definition?.steps ?? [];` → `const steps = req?.steps ?? [];`
6. `ACTION_LABEL` add `reassign: 'Dialihkan'`; `ACTION_DOT` add `reassign: 'bg-blue-600'`. In the timeline the text is `{ACTION_LABEL[action.action]} oleh {action.user?.name}` — leave as is.
7. In the header button group, right after the `can.cancel` button block, add:

```tsx
                        {can.reassign && (
                            <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Alihkan Approver
                            </button>
                        )}
```

8. Right after the `{showCancel && req && (...)}` modal block add:

```tsx
            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    onClose={() => setShowReassign(false)}
                />
            )}
```

- [ ] **Step 2c: Mutation Show**

In `resources/js/Pages/AssetMutations/Show.tsx`:

1. Add imports `import ReassignApproverModal from '@/Components/ReassignApproverModal';`, and add `ApprovalStep` and `ReassignCandidate` to the existing `@/types` import list.
2. `ShowProps`: `can: { act: boolean; cancel: boolean; reassign: boolean };` and add `reassignCandidates: ReassignCandidate[];`.
3. Delete the whole `getStepRoleTitle(...)` function and add in its place:

```tsx
function stepTitle(step: ApprovalStep, originName?: string, destName?: string): string {
    if (step.unit_scope === 'origin' && originName) return `${step.label} (${originName})`;
    if (step.unit_scope === 'destination' && destName) return `${step.label} (${destName})`;
    return step.label;
}
```

4. In the tracker replace the `{getStepRoleTitle(step.approver_role, step.unit_scope, mutation.origin_unit?.name, mutation.destination_unit?.name)}` call (multi-line in the file) with `{stepTitle(step, mutation.origin_unit?.name, mutation.destination_unit?.name)}`.
5. `const steps = req?.definition?.steps ?? [];` → `const steps = req?.steps ?? [];`
6. `export default function Show({ mutation, can }: ShowProps) {` → `export default function Show({ mutation, can, reassignCandidates }: ShowProps) {` and add `const [showReassign, setShowReassign] = useState(false);` next to `showCancel`.
7. After the "Batalkan Pengajuan" button block (the `can.cancel && mutation.status === 'pending'` one) add:

```tsx
                        {can.reassign && mutation.status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => setShowReassign(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                Alihkan Approver
                            </button>
                        )}
```

8. Right after the `{showCancel && req && (...)}` block add the same modal:

```tsx
            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    onClose={() => setShowReassign(false)}
                />
            )}
```

- [ ] **Step 2d: Drop the now-unused template eager load (backend cleanup)**

The frontend now reads the snapshot only. In `app/Http/Controllers/PenerimaanAsetController.php` (`show()`) and `app/Http/Controllers/AssetMutationController.php` (`show()`) change `'approvalRequest.definition.steps'` to `'approvalRequest.definition'` (keep `'approvalRequest.steps'`). Then run `php artisan test tests/Feature/ApprovalReassignTest.php tests/Feature/PenerimaanAsetControllerTest.php tests/Feature/AssetMutationEndToEndTest.php` — Expected: PASS.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Create a submitted Berita Acara as `admin.kecamatan@simaset.test` (draft → "Ajukan"). Log in as `kasubag@simaset.test`, open the BA: the tracker shows "Step 1: Verifikasi Kasubag" (label from the snapshot), the header has "Alihkan Approver". Alihkan ke `camat@simaset.test` with an alasan. Expected: flash success, the timeline shows "Dialihkan oleh Kasubag ..." with the note, kasubag no longer sees Setujui/Tolak, the camat sees the item in `/persetujuan` and a bell notification. Also open a Mutasi detail page as kasubag and confirm the tracker labels still render (with unit names for asal/tujuan steps). Clean up the test data afterwards.

- [ ] **Step 5: Commit**

```bash
git add resources
git commit -m "feat: show snapshot step labels and add reassign approver modal"
```

---

## Task 5: Default workflows, labels, and per-workflow capabilities

**Files:**
- Create: `app/Support/WorkflowDefaults.php`
- Modify: `database/seeders/WorkflowDefinitionSeeder.php`, `config/workflow.php`
- Test: `tests/Feature/WorkflowDefaultsTest.php`

**Interfaces:**
- Produces: `WorkflowDefaults::all(): array` (`code => ['name' => string, 'steps' => list<array{label, approver_type, approver_role, unit_scope}>]`), `WorkflowDefaults::steps(string $code): array`, `WorkflowDefaults::applyTo(WorkflowDefinition $definition): void` (replaces the definition's steps with the defaults); `config('workflow.capabilities')` mapping a code to `'subject'`, `'origin_destination'` or `'none'`. The seeder is **non-destructive**: it creates missing definitions with default steps and only fills empty labels on existing ones.

- [ ] **Step 1: Write the failing test**

`tests/Feature/WorkflowDefaultsTest.php`:

```php
<?php

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Database\Seeders\WorkflowDefinitionSeeder;

it('seeds every default workflow with labelled role steps', function () {
    (new WorkflowDefinitionSeeder)->run();

    expect(WorkflowDefinition::count())->toBe(count(WorkflowDefaults::all()));

    $penerimaan = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail()->steps;
    expect($penerimaan->pluck('label')->all())->toBe(['Verifikasi Kasubag', 'Persetujuan Camat'])
        ->and($penerimaan[0]->approver_type)->toBe(ApproverType::Role)
        ->and($penerimaan[1]->unit_scope)->toBe(UnitScope::Subject);

    foreach (WorkflowDefinition::with('steps')->get() as $definition) {
        expect($definition->steps->every(fn ($s) => $s->label !== ''))->toBeTrue();
    }
});

it('declares a capability for every default workflow', function () {
    expect(array_keys(config('workflow.capabilities')))
        ->toEqualCanonicalizing(array_keys(WorkflowDefaults::all()));
});

it('does not overwrite steps an admin has edited when the seeder runs again', function () {
    (new WorkflowDefinitionSeeder)->run();

    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $definition->steps()->where('step_order', 2)->delete();
    $definition->steps()->where('step_order', 1)->update(['label' => 'Nama Baru', 'approver_role' => 'camat']);

    (new WorkflowDefinitionSeeder)->run();

    $steps = $definition->fresh()->steps;
    expect($steps)->toHaveCount(1)
        ->and($steps[0]->label)->toBe('Nama Baru')
        ->and($steps[0]->approver_role)->toBe('camat');
});

it('applyTo replaces custom steps with the defaults', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'mutasi_antar_kel')->firstOrFail();
    $definition->steps()->delete();
    $definition->steps()->create(['step_order' => 1, 'label' => 'Kustom', 'approver_type' => 'role', 'approver_role' => 'kasubag', 'unit_scope' => 'none']);

    WorkflowDefaults::applyTo($definition);

    expect($definition->fresh()->steps->pluck('approver_role')->all())->toBe(['lurah', 'admin_kelurahan', 'lurah']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/WorkflowDefaultsTest.php`
Expected: FAIL (`Class "App\Support\WorkflowDefaults" not found`).

- [ ] **Step 3: Defaults class**

`app/Support/WorkflowDefaults.php`:

```php
<?php

namespace App\Support;

use App\Models\WorkflowDefinition;

class WorkflowDefaults
{
    /** @return array<string, array{name: string, steps: list<array<string, string>>}> */
    public static function all(): array
    {
        return [
            'penerimaan_aset' => [
                'name' => 'Penerimaan Aset',
                'steps' => [
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat', 'camat', 'subject'),
                ],
            ],
            'mutasi_kec_ke_kel' => [
                'name' => 'Mutasi Kecamatan ke Kelurahan',
                'steps' => [
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat (Pelepasan)', 'camat', 'origin'),
                    self::role('Konfirmasi Admin Kelurahan Tujuan', 'admin_kelurahan', 'destination'),
                    self::role('Persetujuan Lurah Tujuan', 'lurah', 'destination'),
                ],
            ],
            'mutasi_antar_kel' => [
                'name' => 'Mutasi Antar Kelurahan',
                'steps' => [
                    self::role('Persetujuan Lurah Asal', 'lurah', 'origin'),
                    self::role('Konfirmasi Admin Kelurahan Tujuan', 'admin_kelurahan', 'destination'),
                    self::role('Persetujuan Lurah Tujuan', 'lurah', 'destination'),
                ],
            ],
            'retur_kel_ke_kec' => [
                'name' => 'Retur Kelurahan ke Kecamatan',
                'steps' => [
                    self::role('Persetujuan Lurah Asal', 'lurah', 'origin'),
                    self::role('Konfirmasi Admin Kecamatan', 'admin_kecamatan', 'destination'),
                    self::role('Verifikasi Kasubag', 'kasubag', 'none'),
                    self::role('Persetujuan Camat', 'camat', 'destination'),
                ],
            ],
            'mutasi_internal_kec' => [
                'name' => 'Mutasi Internal Kecamatan',
                'steps' => [self::role('Persetujuan Camat', 'camat', 'origin')],
            ],
            'mutasi_internal_kel' => [
                'name' => 'Mutasi Internal Kelurahan',
                'steps' => [self::role('Persetujuan Lurah', 'lurah', 'origin')],
            ],
        ];
    }

    /** @return list<array<string, string>> */
    public static function steps(string $code): array
    {
        return self::all()[$code]['steps'] ?? [];
    }

    public static function applyTo(WorkflowDefinition $definition): void
    {
        $definition->steps()->delete();

        foreach (self::steps($definition->code) as $i => $step) {
            $definition->steps()->create($step + ['step_order' => $i + 1]);
        }

        $definition->unsetRelation('steps');
    }

    /** @return array<string, string> */
    private static function role(string $label, string $role, string $scope): array
    {
        return ['label' => $label, 'approver_type' => 'role', 'approver_role' => $role, 'unit_scope' => $scope];
    }
}
```

- [ ] **Step 4: Seeder and config**

`database/seeders/WorkflowDefinitionSeeder.php` (replace the whole file):

```php
<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    /**
     * Non-destructive: creates missing workflows with their default steps and only
     * fills empty step labels on existing ones. It never overwrites steps an admin
     * edited from the settings page (use the "Kembalikan ke default" button for that).
     */
    public function run(): void
    {
        foreach (WorkflowDefaults::all() as $code => $data) {
            $definition = WorkflowDefinition::where('code', $code)->first();

            if ($definition === null) {
                WorkflowDefaults::applyTo(WorkflowDefinition::create(['code' => $code, 'name' => $data['name']]));

                continue;
            }

            foreach ($definition->steps()->where('label', '')->get() as $step) {
                $default = $data['steps'][$step->step_order - 1] ?? null;

                if ($default !== null) {
                    $step->update(['label' => $default['label']]);
                }
            }
        }
    }
}
```

In `config/workflow.php` add this key after `'effects' => [...]`:

```php
    /*
     * What each workflow's subject offers, used to validate steps edited from the UI:
     *  - subject:            the approvable has a single unit (`->unit`); allows the
     *                        "subject" unit scope and the "atasan_unit" approver type.
     *  - origin_destination: the approvable implements HasWorkflowUnits; allows the
     *                        "origin"/"destination" unit scopes.
     *  - none:               only role steps without a unit scope.
     */
    'capabilities' => [
        'penerimaan_aset' => 'subject',
        'mutasi_kec_ke_kel' => 'origin_destination',
        'mutasi_antar_kel' => 'origin_destination',
        'retur_kel_ke_kec' => 'origin_destination',
        'mutasi_internal_kec' => 'origin_destination',
        'mutasi_internal_kel' => 'origin_destination',
    ],
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/WorkflowDefaultsTest.php`
Expected: PASS (4 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app database config tests
git commit -m "feat: add default workflow definitions with labels and per-workflow capabilities"
```

---

## Task 6: Workflow settings backend (update, reset, audit log, Kasubag only)

**Files:**
- Create: `app/Policies/WorkflowDefinitionPolicy.php`
- Create: `app/Services/WorkflowSettingsService.php`
- Create: `app/Http/Requests/UpdateWorkflowRequest.php`
- Create: `app/Http/Controllers/WorkflowSettingsController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/WorkflowSettingsTest.php`

**Interfaces:**
- Consumes: `WorkflowDefaults::applyTo`, `config('workflow.capabilities')` (Task 5), `WorkflowChangeLog`, `ApproverType`, `UnitScope`.
- Produces: routes `workflow-settings.index` (`GET /pengaturan/alur`), `workflow-settings.edit` (`GET /pengaturan/alur/{workflow}`), `workflow-settings.update` (`PUT`), `workflow-settings.reset` (`POST .../reset`); `WorkflowSettingsService::update(WorkflowDefinition $workflow, array $steps, User $by): void`, `::reset(WorkflowDefinition $workflow, User $by): void`. Update payload: `steps` = list of `['label','approver_type','approver_role','approver_user_id','unit_scope']`. Inertia components `WorkflowSettings/Index` and `WorkflowSettings/Edit`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/WorkflowSettingsTest.php`:

```php
<?php

use App\Models\BeritaAcaraPenerimaan;
use App\Models\WorkflowChangeLog;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['kasubag', 'camat', 'lurah', 'admin_kecamatan', 'admin_kelurahan'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->penerimaan = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $this->mutasi = WorkflowDefinition::where('code', 'mutasi_antar_kel')->firstOrFail();
    $this->service = app(ApprovalWorkflowService::class);
});

function stepPayload(array $override = []): array
{
    return array_merge([
        'label' => 'Persetujuan Camat', 'approver_type' => 'role', 'approver_role' => 'camat',
        'approver_user_id' => null, 'unit_scope' => 'subject',
    ], $override);
}

it('shows the workflow list and editor only to a kasubag', function () {
    $this->actingAs($this->kasubag)->get(route('workflow-settings.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('WorkflowSettings/Index')->has('workflows', 6));

    $this->actingAs($this->kasubag)->get(route('workflow-settings.edit', $this->penerimaan))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('WorkflowSettings/Edit')
            ->where('workflow.code', 'penerimaan_aset')
            ->has('workflow.steps', 2)
            ->has('options.roles')
            ->has('options.users')
            ->has('options.scopes')
            ->has('logs'));
});

it('refuses every non-kasubag role on every settings endpoint', function () {
    foreach (['camat', 'lurah', 'adminKec', 'adminKel'] as $who) {
        $user = $this->$who;
        $this->actingAs($user)->get(route('workflow-settings.index'))->assertForbidden();
        $this->actingAs($user)->get(route('workflow-settings.edit', $this->penerimaan))->assertForbidden();
        $this->actingAs($user)->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [stepPayload()]])->assertForbidden();
        $this->actingAs($user)->post(route('workflow-settings.reset', $this->penerimaan))->assertForbidden();
    }

    expect($this->penerimaan->fresh()->steps)->toHaveCount(2)
        ->and(WorkflowChangeLog::count())->toBe(0);
});

it('replaces the steps, normalises them per approver type and writes an audit log', function () {
    $payload = ['steps' => [
        stepPayload(['label' => 'Verifikasi Khusus', 'approver_type' => 'user', 'approver_role' => 'kasubag', 'approver_user_id' => $this->kasubag->id, 'unit_scope' => 'subject']),
        stepPayload(['label' => 'Atasan Unit', 'approver_type' => 'atasan_unit', 'approver_role' => 'camat', 'unit_scope' => 'none']),
    ]];

    $this->actingAs($this->kasubag)->put(route('workflow-settings.update', $this->penerimaan), $payload)->assertRedirect();

    $steps = $this->penerimaan->fresh()->steps;
    expect($steps)->toHaveCount(2)
        ->and($steps[0]->approver_type->value)->toBe('user')
        ->and($steps[0]->approver_user_id)->toBe($this->kasubag->id)
        ->and($steps[0]->approver_role)->toBeNull()
        ->and($steps[0]->unit_scope->value)->toBe('none')
        ->and($steps[1]->approver_type->value)->toBe('atasan_unit')
        ->and($steps[1]->approver_role)->toBeNull()
        ->and($steps[1]->unit_scope->value)->toBe('subject');

    $log = WorkflowChangeLog::firstOrFail();
    expect($log->user_id)->toBe($this->kasubag->id)
        ->and($log->event)->toBe('update')
        ->and($log->steps_before)->toHaveCount(2)
        ->and($log->steps_before[0]['approver_role'])->toBe('kasubag')
        ->and($log->steps_after)->toHaveCount(2)
        ->and($log->steps_after[0]['approver_type'])->toBe('user');
});

it('rejects invalid step configurations', function (string $case) {
    $unassigned = \App\Models\User::factory()->create();
    Role::findOrCreate('kasubag');

    $steps = match ($case) {
        'empty' => [],
        'blank label' => [stepPayload(['label' => ''])],
        'role missing' => [stepPayload(['approver_role' => null])],
        'unknown role' => [stepPayload(['approver_role' => 'presiden'])],
        'role without users' => (function () {
            Role::findOrCreate('lurah')->users()->detach();

            return [stepPayload(['approver_role' => 'lurah', 'unit_scope' => 'none'])];
        })(),
        'user missing' => [stepPayload(['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => null])],
        'user without role' => [stepPayload(['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => $unassigned->id])],
        'origin scope on penerimaan' => [stepPayload(['unit_scope' => 'origin'])],
    };

    $this->actingAs($this->kasubag)->from('/x')
        ->put(route('workflow-settings.update', $this->penerimaan), ['steps' => $steps])
        ->assertSessionHasErrors();

    expect($this->penerimaan->fresh()->steps)->toHaveCount(2)
        ->and(WorkflowChangeLog::count())->toBe(0);
})->with([
    'empty', 'blank label', 'role missing', 'unknown role', 'role without users',
    'user missing', 'user without role', 'origin scope on penerimaan',
]);

it('rejects scopes and approver types the workflow cannot support', function () {
    $this->actingAs($this->kasubag)->from('/x')
        ->put(route('workflow-settings.update', $this->mutasi), ['steps' => [stepPayload(['unit_scope' => 'subject'])]])
        ->assertSessionHasErrors('steps.0.unit_scope');

    $this->actingAs($this->kasubag)->from('/x')
        ->put(route('workflow-settings.update', $this->mutasi), ['steps' => [stepPayload(['approver_type' => 'atasan_unit', 'approver_role' => null, 'unit_scope' => 'subject'])]])
        ->assertSessionHasErrors('steps.0.approver_type');

    expect($this->mutasi->fresh()->steps)->toHaveCount(3);
});

it('saves atomically: a valid first step is not kept when a later step is invalid', function () {
    $this->actingAs($this->kasubag)->from('/x')
        ->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [
            stepPayload(['label' => 'Baru', 'approver_role' => 'kasubag', 'unit_scope' => 'none']),
            stepPayload(['label' => '']),
        ]])
        ->assertSessionHasErrors('steps.1.label');

    $steps = $this->penerimaan->fresh()->steps;
    expect($steps)->toHaveCount(2)
        ->and($steps[0]->label)->toBe('Verifikasi Kasubag')
        ->and(WorkflowChangeLog::count())->toBe(0);
});

it('applies an edited flow to new submissions while running requests keep their steps', function () {
    $ba = fn (string $no) => BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $no, 'tanggal_penerimaan' => '2025-09-01', 'no_kontrak_spk' => 'SPK',
        'unit_id' => $this->kec->id, 'created_by' => $this->adminKec->id, 'status' => 'submitted',
    ]);
    $running = $this->service->submit($ba('BA/W/1'), 'penerimaan_aset', $this->adminKec);

    $this->actingAs($this->kasubag)->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [
        stepPayload(['label' => 'Langsung Camat']),
    ]])->assertRedirect();

    $fresh = $this->service->submit($ba('BA/W/2'), 'penerimaan_aset', $this->adminKec);

    expect($this->service->canAct($this->kasubag, $running->fresh()))->toBeTrue()
        ->and($this->service->canAct($this->camat, $running->fresh()))->toBeFalse()
        ->and($this->service->canAct($this->kasubag, $fresh->fresh()))->toBeFalse()
        ->and($this->service->canAct($this->camat, $fresh->fresh()))->toBeTrue()
        ->and($fresh->fresh()->steps)->toHaveCount(1);
});

it('resets a workflow to its defaults and logs the reset', function () {
    $this->actingAs($this->kasubag)->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [stepPayload()]])->assertRedirect();
    expect($this->penerimaan->fresh()->steps)->toHaveCount(1);

    $this->actingAs($this->kasubag)->post(route('workflow-settings.reset', $this->penerimaan))->assertRedirect();

    $steps = $this->penerimaan->fresh()->steps;
    expect($steps->pluck('approver_role')->all())->toBe(['kasubag', 'camat'])
        ->and($steps->pluck('label')->all())->toBe(['Verifikasi Kasubag', 'Persetujuan Camat'])
        ->and(WorkflowChangeLog::orderBy('id')->pluck('event')->all())->toBe(['update', 'reset']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/WorkflowSettingsTest.php`
Expected: FAIL (`Route [workflow-settings.index] not defined`).

- [ ] **Step 3: Policy and service**

`app/Policies/WorkflowDefinitionPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkflowDefinition;

class WorkflowDefinitionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function update(User $user, WorkflowDefinition $workflow): bool
    {
        return $user->hasRole('kasubag');
    }
}
```

`app/Services/WorkflowSettingsService.php`:

```php
<?php

namespace App\Services;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\User;
use App\Models\WorkflowChangeLog;
use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Illuminate\Support\Facades\DB;

class WorkflowSettingsService
{
    public const ROLES = ['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'];

    /** @param  list<array<string, mixed>>  $steps */
    public function update(WorkflowDefinition $workflow, array $steps, User $by): void
    {
        DB::transaction(function () use ($workflow, $steps, $by) {
            $before = $this->snapshot($workflow);

            $workflow->steps()->delete();
            foreach (array_values($steps) as $i => $step) {
                $workflow->steps()->create($this->normalize($step, $i + 1));
            }

            $this->log($workflow, $by, 'update', $before);
        });
    }

    public function reset(WorkflowDefinition $workflow, User $by): void
    {
        DB::transaction(function () use ($workflow, $by) {
            $before = $this->snapshot($workflow);

            WorkflowDefaults::applyTo($workflow);

            $this->log($workflow, $by, 'reset', $before);
        });
    }

    /** @return list<array<string, mixed>> */
    public function snapshot(WorkflowDefinition $workflow): array
    {
        return $workflow->steps()->get()->map(fn ($s) => [
            'step_order' => $s->step_order,
            'label' => $s->label,
            'approver_type' => $s->approver_type->value,
            'approver_role' => $s->approver_role,
            'approver_user_id' => $s->approver_user_id,
            'unit_scope' => $s->unit_scope->value,
        ])->all();
    }

    /** @return array<string, mixed> */
    private function normalize(array $step, int $order): array
    {
        $type = ApproverType::from($step['approver_type']);

        return [
            'step_order' => $order,
            'label' => trim($step['label']),
            'approver_type' => $type,
            'approver_role' => $type === ApproverType::Role ? $step['approver_role'] : null,
            'approver_user_id' => $type === ApproverType::User ? (int) $step['approver_user_id'] : null,
            'unit_scope' => match ($type) {
                ApproverType::Role => UnitScope::from($step['unit_scope'] ?? 'none'),
                ApproverType::User => UnitScope::None,
                ApproverType::AtasanUnit => UnitScope::Subject,
            },
        ];
    }

    /** @param  list<array<string, mixed>>  $before */
    private function log(WorkflowDefinition $workflow, User $by, string $event, array $before): void
    {
        $workflow->unsetRelation('steps');

        WorkflowChangeLog::create([
            'workflow_definition_id' => $workflow->id,
            'user_id' => $by->id,
            'event' => $event,
            'steps_before' => $before,
            'steps_after' => $this->snapshot($workflow),
        ]);
    }
}
```

- [ ] **Step 4: FormRequest with capability validation**

`app/Http/Requests/UpdateWorkflowRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\User;
use App\Services\WorkflowSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('workflow'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'steps' => ['required', 'array', 'min:1'],
            'steps.*.label' => ['required', 'string', 'max:100'],
            'steps.*.approver_type' => ['required', Rule::enum(ApproverType::class)],
            'steps.*.approver_role' => ['nullable', 'string'],
            'steps.*.approver_user_id' => ['nullable', 'integer'],
            'steps.*.unit_scope' => ['nullable', Rule::enum(UnitScope::class)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'steps.required' => 'Alur harus punya minimal satu langkah.',
            'steps.min' => 'Alur harus punya minimal satu langkah.',
            'steps.*.label.required' => 'Nama langkah wajib diisi.',
        ];
    }

    /** @return array<int, \Closure> */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $capability = config('workflow.capabilities.'.$this->route('workflow')->code, 'none');

            foreach ($this->input('steps', []) as $i => $step) {
                $type = ApproverType::from($step['approver_type']);

                match ($type) {
                    ApproverType::Role => $this->checkRoleStep($validator, $i, $step, $capability),
                    ApproverType::User => $this->checkUserStep($validator, $i, $step),
                    ApproverType::AtasanUnit => $capability === 'subject'
                        ? null
                        : $validator->errors()->add("steps.$i.approver_type", 'Tipe "Atasan unit" hanya untuk alur yang punya unit subjek.'),
                };
            }
        }];
    }

    private function checkRoleStep(Validator $validator, int $i, array $step, string $capability): void
    {
        $role = $step['approver_role'] ?? null;

        if (! in_array($role, WorkflowSettingsService::ROLES, true)) {
            $validator->errors()->add("steps.$i.approver_role", 'Pilih role approver yang valid.');

            return;
        }

        if (! User::role($role)->exists()) {
            $validator->errors()->add("steps.$i.approver_role", "Belum ada user dengan role {$role}, pengajuan bisa macet.");
        }

        $scope = $step['unit_scope'] ?? 'none';
        $allowed = match ($capability) {
            'subject' => ['none', 'subject'],
            'origin_destination' => ['none', 'origin', 'destination'],
            default => ['none'],
        };

        if (! in_array($scope, $allowed, true)) {
            $validator->errors()->add("steps.$i.unit_scope", 'Cakupan unit ini tidak tersedia untuk alur tersebut.');
        }
    }

    private function checkUserStep(Validator $validator, int $i, array $step): void
    {
        $id = $step['approver_user_id'] ?? null;

        if ($id === null || ! User::whereKey($id)->has('roles')->exists()) {
            $validator->errors()->add("steps.$i.approver_user_id", 'Pilih user yang memiliki akun dengan role yang valid.');
        }
    }
}
```

- [ ] **Step 5: Controller and routes**

`app/Http/Controllers/WorkflowSettingsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\ApproverType;
use App\Http\Requests\UpdateWorkflowRequest;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\WorkflowSettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkflowSettingsController extends Controller
{
    private const ROLE_LABELS = [
        'kasubag' => 'Kasubag', 'camat' => 'Camat', 'admin_kecamatan' => 'Admin Kecamatan',
        'admin_kelurahan' => 'Admin Kelurahan', 'lurah' => 'Lurah',
    ];

    private const SCOPE_LABELS = [
        'none' => 'Tidak dibatasi unit', 'subject' => 'Unit pengaju',
        'origin' => 'Unit asal', 'destination' => 'Unit tujuan',
    ];

    public function __construct(private readonly WorkflowSettingsService $settings) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', WorkflowDefinition::class);

        $workflows = WorkflowDefinition::with('steps')
            ->withCount(['requests as pending_count' => fn ($q) => $q->where('status', 'pending')])
            ->withMax('changeLogs as last_changed_at', 'created_at')
            ->orderBy('name')
            ->get()
            ->map(fn (WorkflowDefinition $w) => [
                'id' => $w->id,
                'code' => $w->code,
                'name' => $w->name,
                'summary' => $w->steps->pluck('label')->implode(' → '),
                'step_count' => $w->steps->count(),
                'pending_count' => $w->pending_count,
                'last_changed_at' => $w->last_changed_at,
            ]);

        return Inertia::render('WorkflowSettings/Index', ['workflows' => $workflows]);
    }

    public function edit(WorkflowDefinition $workflow): Response
    {
        Gate::authorize('update', $workflow);

        $capability = config("workflow.capabilities.{$workflow->code}", 'none');
        $scopes = match ($capability) {
            'subject' => ['none', 'subject'],
            'origin_destination' => ['none', 'origin', 'destination'],
            default => ['none'],
        };

        return Inertia::render('WorkflowSettings/Edit', [
            'workflow' => [
                'id' => $workflow->id,
                'code' => $workflow->code,
                'name' => $workflow->name,
                'capability' => $capability,
                'steps' => $workflow->steps->map(fn ($s) => [
                    'label' => $s->label,
                    'approver_type' => $s->approver_type->value,
                    'approver_role' => $s->approver_role,
                    'approver_user_id' => $s->approver_user_id,
                    'unit_scope' => $s->unit_scope->value,
                ])->values(),
            ],
            'options' => [
                'roles' => collect(WorkflowSettingsService::ROLES)->map(fn ($r) => ['value' => $r, 'label' => self::ROLE_LABELS[$r]])->values(),
                'types' => collect(ApproverType::cases())
                    ->filter(fn ($t) => $t !== ApproverType::AtasanUnit || $capability === 'subject')
                    ->map(fn ($t) => ['value' => $t->value, 'label' => $t->label()])->values(),
                'scopes' => collect($scopes)->map(fn ($s) => ['value' => $s, 'label' => self::SCOPE_LABELS[$s]])->values(),
                'users' => User::whereHas('roles')->with(['roles', 'unit'])->orderBy('name')->get()->map(fn (User $u) => [
                    'id' => $u->id, 'name' => $u->name, 'role' => $u->getRoleNames()->first(), 'unit' => $u->unit?->name,
                ])->values(),
            ],
            'logs' => $workflow->changeLogs()->with('user')->limit(20)->get()->map(fn ($l) => [
                'id' => $l->id,
                'event' => $l->event,
                'user' => $l->user?->name,
                'created_at' => $l->created_at?->format('d M Y H:i'),
                'before' => collect($l->steps_before)->pluck('label')->implode(' → '),
                'after' => collect($l->steps_after)->pluck('label')->implode(' → '),
            ]),
        ]);
    }

    public function update(UpdateWorkflowRequest $request, WorkflowDefinition $workflow): RedirectResponse
    {
        $this->settings->update($workflow, $request->validated('steps'), $request->user());

        return back()->with('success', 'Alur persetujuan berhasil disimpan. Pengajuan yang sedang berjalan tidak terpengaruh.');
    }

    public function reset(Request $request, WorkflowDefinition $workflow): RedirectResponse
    {
        Gate::authorize('update', $workflow);

        $this->settings->reset($workflow, $request->user());

        return back()->with('success', 'Alur dikembalikan ke pengaturan default.');
    }
}
```

In `routes/web.php` add the import `use App\Http\Controllers\WorkflowSettingsController;` (keep imports alphabetical) and, inside the `Route::middleware('auth')->group(...)` block after the `persetujuan.index` route, add:

```php
    Route::get('/pengaturan/alur', [WorkflowSettingsController::class, 'index'])->name('workflow-settings.index');
    Route::get('/pengaturan/alur/{workflow}', [WorkflowSettingsController::class, 'edit'])->name('workflow-settings.edit');
    Route::put('/pengaturan/alur/{workflow}', [WorkflowSettingsController::class, 'update'])->name('workflow-settings.update');
    Route::post('/pengaturan/alur/{workflow}/reset', [WorkflowSettingsController::class, 'reset'])->name('workflow-settings.reset');
```

- [ ] **Step 6: Run tests**

Run: `php artisan test tests/Feature/WorkflowSettingsTest.php`
Expected: PASS (all tests, the dataset runs 8 cases).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app routes tests
git commit -m "feat: add kasubag-only workflow settings with validation, audit log and reset"
```

---

## Task 7: Frontend — Pengaturan Alur pages and navigation

**Files:**
- Create: `resources/js/Pages/WorkflowSettings/Index.tsx`, `resources/js/Pages/WorkflowSettings/Edit.tsx`
- Modify: `resources/js/config/navigation.ts`, `resources/js/Components/NavIcon.tsx`

**Interfaces:**
- Consumes: routes `workflow-settings.{index,edit,update,reset}` and the page props from Task 6.

- [ ] **Step 1: Sidebar item and icon**

In `resources/js/Components/NavIcon.tsx` add a case before `default:`:

```tsx
        case 'settings':
            return (
                <svg
                    className={className}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                    <circle cx="9" cy="6" r="2" fill="currentColor" />
                    <circle cx="15" cy="12" r="2" fill="currentColor" />
                    <circle cx="8" cy="18" r="2" fill="currentColor" />
                </svg>
            );

```

In `resources/js/config/navigation.ts`, inside `SIDEBAR_NAV_GROUPS`, add a group between `TRANSAKSI` and `ALAT BANTU`:

```ts
    {
        title: 'PENGATURAN',
        items: [
            {
                label: 'Pengaturan Alur',
                href: '/pengaturan/alur',
                icon: 'settings',
                roles: ['kasubag'],
            },
        ],
    },
```

(`navGroupsForRole` already drops groups that end up empty, so other roles never see the "PENGATURAN" header.)

- [ ] **Step 2: Index page**

`resources/js/Pages/WorkflowSettings/Index.tsx`:

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface WorkflowRow {
    id: number;
    code: string;
    name: string;
    summary: string;
    step_count: number;
    pending_count: number;
    last_changed_at: string | null;
}

interface IndexProps extends PageProps {
    workflows: WorkflowRow[];
}

export default function Index({ workflows }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Pengaturan Alur Persetujuan" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Pengaturan Alur</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Pengaturan Alur Persetujuan</h1>
                    <p className="mt-1 text-sm text-slate-500">Atur langkah dan approver tiap alur. Perubahan hanya berlaku untuk pengajuan baru.</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <ul className="divide-y divide-slate-100">
                        {workflows.map((w) => (
                            <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                                    <p className="truncate text-xs text-slate-500">{w.summary || 'Belum ada langkah'}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {w.step_count} langkah · {w.pending_count} pengajuan berjalan
                                        {w.last_changed_at ? ` · diubah ${new Date(w.last_changed_at).toLocaleDateString('id-ID')}` : ''}
                                    </p>
                                </div>
                                <Link href={route('workflow-settings.edit', w.id)} className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                    Atur
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Edit page**

`resources/js/Pages/WorkflowSettings/Edit.tsx`:

```tsx
import { ChevronRightIcon as ChevronRight, PlusIcon as Plus, TrashIcon as Trash } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';

type ApproverType = 'role' | 'user' | 'atasan_unit';

interface StepForm {
    label: string;
    approver_type: ApproverType;
    approver_role: string;
    approver_user_id: string;
    unit_scope: string;
}

interface Option {
    value: string;
    label: string;
}

interface UserOption {
    id: number;
    name: string;
    role: string | null;
    unit: string | null;
}

interface LogRow {
    id: number;
    event: string;
    user: string | null;
    created_at: string | null;
    before: string;
    after: string;
}

interface EditProps extends PageProps {
    workflow: {
        id: number;
        code: string;
        name: string;
        capability: string;
        steps: { label: string; approver_type: ApproverType; approver_role: string | null; approver_user_id: number | null; unit_scope: string }[];
    };
    options: { roles: Option[]; types: Option[]; scopes: Option[]; users: UserOption[] };
    logs: LogRow[];
}

const FIELD = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none';

export default function Edit({ workflow, options, logs }: EditProps) {
    const form = useForm({
        steps: workflow.steps.map<StepForm>((s) => ({
            label: s.label,
            approver_type: s.approver_type,
            approver_role: s.approver_role ?? '',
            approver_user_id: s.approver_user_id ? String(s.approver_user_id) : '',
            unit_scope: s.unit_scope,
        })),
    });

    const errors = form.errors as Record<string, string>;

    const setSteps = (steps: StepForm[]) => form.setData('steps', steps);

    const update = (index: number, changes: Partial<StepForm>) =>
        setSteps(form.data.steps.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= form.data.steps.length) return;
        const steps = [...form.data.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        setSteps(steps);
    };

    const add = () =>
        setSteps([...form.data.steps, { label: '', approver_type: 'role', approver_role: '', approver_user_id: '', unit_scope: 'none' }]);

    const remove = (index: number) => setSteps(form.data.steps.filter((_, i) => i !== index));

    const save = () => {
        form.transform((data) => ({
            steps: data.steps.map((s) => ({
                ...s,
                approver_role: s.approver_type === 'role' ? s.approver_role || null : null,
                approver_user_id: s.approver_type === 'user' ? Number(s.approver_user_id) || null : null,
                unit_scope: s.approver_type === 'role' ? s.unit_scope : 'none',
            })),
        }));
        form.put(route('workflow-settings.update', workflow.id), { preserveScroll: true });
    };

    const reset = () => {
        if (window.confirm('Kembalikan alur ini ke pengaturan default? Perubahan yang belum tersimpan hilang.')) {
            router.post(route('workflow-settings.reset', workflow.id), {}, { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Atur Alur: ${workflow.name}`} />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('workflow-settings.index')} className="hover:text-blue-700">Pengaturan Alur</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">{workflow.name}</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{workflow.name}</h1>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Pengajuan yang sedang berjalan tidak terpengaruh. Perubahan hanya berlaku untuk pengajuan baru.
                </div>

                {errors.steps && <p className="text-sm text-red-600">{errors.steps}</p>}

                <div className="space-y-4">
                    {form.data.steps.map((step, index) => (
                        <div key={index} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-blue-700">Langkah {index + 1}</p>
                                <div className="flex items-center gap-1 text-xs">
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Naik</button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === form.data.steps.length - 1} className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Turun</button>
                                    <button type="button" onClick={() => remove(index)} className="flex items-center gap-1 rounded px-2 py-1 font-medium text-slate-500 hover:text-red-600">
                                        <Trash className="h-3.5 w-3.5" /> Hapus
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">Nama Langkah *</label>
                                    <input type="text" value={step.label} onChange={(e) => update(index, { label: e.target.value })} className={FIELD} placeholder="mis. Verifikasi Kasubag" />
                                    {errors[`steps.${index}.label`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.label`]}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">Tipe Approver *</label>
                                    <select value={step.approver_type} onChange={(e) => update(index, { approver_type: e.target.value as ApproverType })} className={FIELD}>
                                        {options.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    {errors[`steps.${index}.approver_type`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_type`]}</p>}
                                </div>
                            </div>

                            {step.approver_type === 'role' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Role *</label>
                                        <select value={step.approver_role} onChange={(e) => update(index, { approver_role: e.target.value })} className={FIELD}>
                                            <option value="">Pilih role...</option>
                                            {options.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                        {errors[`steps.${index}.approver_role`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_role`]}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Cakupan Unit</label>
                                        <select value={step.unit_scope} onChange={(e) => update(index, { unit_scope: e.target.value })} className={FIELD}>
                                            {options.scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                        {errors[`steps.${index}.unit_scope`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.unit_scope`]}</p>}
                                    </div>
                                </div>
                            )}

                            {step.approver_type === 'user' && (
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">User *</label>
                                    <select value={step.approver_user_id} onChange={(e) => update(index, { approver_user_id: e.target.value })} className={FIELD}>
                                        <option value="">Pilih user...</option>
                                        {options.users.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.role ?? '-'}{u.unit ? `, ${u.unit}` : ''})</option>
                                        ))}
                                    </select>
                                    {errors[`steps.${index}.approver_user_id`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_user_id`]}</p>}
                                    <p className="mt-1 text-xs text-slate-500">Hanya user ini yang dapat menyetujui langkah ini.</p>
                                </div>
                            )}

                            {step.approver_type === 'atasan_unit' && (
                                <p className="text-xs text-slate-500">Otomatis: Camat bila unit pengajuan kecamatan, Lurah bila kelurahan.</p>
                            )}
                        </div>
                    ))}
                </div>

                <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                    <Plus className="h-3.5 w-3.5" /> Tambah Langkah
                </button>

                <div className="flex items-center justify-between">
                    <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Kembalikan ke Default
                    </button>
                    <button type="button" onClick={save} disabled={form.processing} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {form.processing ? 'Menyimpan...' : 'Simpan Alur'}
                    </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Perubahan</p>
                    {logs.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada perubahan.</p>
                    ) : (
                        <ul className="space-y-3 text-sm">
                            {logs.map((l) => (
                                <li key={l.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <p className="font-semibold text-slate-900">{l.event === 'reset' ? 'Dikembalikan ke default' : 'Diubah'} oleh {l.user}</p>
                                    <p className="text-xs text-slate-500">{l.created_at}</p>
                                    <p className="mt-1 text-xs text-slate-600">Sebelum: {l.before || '-'}</p>
                                    <p className="text-xs text-slate-600">Sesudah: {l.after || '-'}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification (browser)**

1. Log in as `kasubag@simaset.test`: sidebar shows "PENGATURAN → Pengaturan Alur". Log in as `camat@simaset.test`: the group is absent, and `/pengaturan/alur` returns 403.
2. `/pengaturan/alur` lists the 6 workflows with summaries like "Verifikasi Kasubag → Persetujuan Camat".
3. Open "Penerimaan Aset": change step 2 to type "Atasan unit" and save → success flash, "Riwayat Perubahan" gains an entry. Try saving with an empty step name → inline error, nothing changes.
4. As `admin.kecamatan@simaset.test` submit a new Berita Acara; approve step 1 as kasubag; confirm `camat` gets step 2 (atasan unit of a kecamatan = camat) and the tracker shows the new labels.
5. Back on the settings page press "Kembalikan ke Default" → steps return to Verifikasi Kasubag / Persetujuan Camat and the log shows "Dikembalikan ke default".
6. A request submitted before an edit keeps its old steps (edit the flow while one is pending and re-open it).
Clean up all test data afterwards.

- [ ] **Step 6: Commit**

```bash
git add resources
git commit -m "feat: add workflow settings pages and sidebar entry for kasubag"
```

---

## Task 8: Docs and final regression

**Files:**
- Modify: `docs/DETAIL_RBAC_SISTEM.md`, `docs/superpowers/specs/2026-09-30-pengaturan-alur-persetujuan-design.md`

- [ ] **Step 1: Update `docs/DETAIL_RBAC_SISTEM.md`**

1. In the §4 permission matrix add a row after "Batalkan Pengajuan":

```
| **Pengaturan Alur Persetujuan** | ✅ Penuh (ubah langkah, alihkan approver) | ❌ | ❌ | ❌ | ❌ | ✅ Selesai (`WorkflowDefinitionPolicy`, `WorkflowSettingsController`) |
```

2. Add a subsection at the end of §6:

```
### Tipe Approver & Snapshot Langkah

Setiap langkah (`workflow_steps`) kini punya `label` dan `approver_type`:
- `role`: role + cakupan unit (`none/subject/origin/destination`), seperti sebelumnya.
- `user`: eksklusif untuk satu user; Kasubag dapat mengalihkan approver langkah yang sedang pending ke user lain.
- `atasan_unit`: otomatis Camat (unit kecamatan) atau Lurah (unit kelurahan).

Langkah disalin ke `approval_request_steps` saat pengajuan dibuat, sehingga mengubah alur dari menu Pengaturan Alur hanya berlaku untuk pengajuan baru. Semua perubahan tercatat di `workflow_change_logs`.

Catatan operasional setelah pull: `php artisan migrate` lalu `php artisan db:seed --class=WorkflowDefinitionSeeder` (seeder tidak menimpa alur yang sudah diubah admin).
```

- [ ] **Step 2: Mark the spec implemented**

In the spec header change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-09-30-pengaturan-alur-persetujuan.md).`

- [ ] **Step 3: Full regression**

Run: `php artisan test`
Expected: all green.

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run: `php artisan migrate:fresh --seed --env=testing` is NOT required; instead confirm on the dev DB: `php artisan migrate` then `php artisan db:seed --class=WorkflowDefinitionSeeder`, and `php artisan tinker --execute="echo App\Models\WorkflowStep::where('label','')->count();"` prints `0`.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: document dynamic approval workflow settings and approver types"
```
