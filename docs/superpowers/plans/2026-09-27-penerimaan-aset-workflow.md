# Penerimaan Aset Workflow Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first flow (Penerimaan Aset) of the generic approval workflow engine end-to-end: admin kecamatan submits a multi-item Berita Acara, kasubag verifies, camat approves, and the system auto-creates the resulting `Asset` records with BMD-compliant `kode_barang`.

**Architecture:** A generic, reusable `workflow_definitions`/`workflow_steps`/`approval_requests`/`approval_actions` schema plus one `ApprovalWorkflowService` drives step progression, authorization, and notification for any future workflow. A separate `BeritaAcaraPenerimaan`/`BeritaAcaraItem` pair holds this specific flow's submission data, and a `PenerimaanAsetEffect` class (registered by workflow code) turns an approved submission into real `Asset` rows. Everything else (4 mutation flows planned for later) plugs into the same engine by registering a new workflow definition + effect class.

**Tech Stack:** Laravel 13, Pest, Inertia.js + React 18 + TypeScript, Tailwind CSS, Spatie laravel-permission, Laravel's built-in database notifications.

**Spec:** `docs/superpowers/specs/2026-09-27-penerimaan-aset-workflow-design.md`

## Global Constraints

- Follow existing layering: Controller → FormRequest → Service/Policy → Repository/Model. No business logic in controllers.
- Every backend task is TDD: write the failing Pest test first, watch it fail, then implement.
- Reuse existing helpers: `userWithRole()`, `makeKecamatan()`, `makeKelurahan()` from `tests/Pest.php`; `User::canAccessUnit()`; `AssetRepositoryInterface`; the existing `AssetPhoto` polymorphic table (do not create a new documents table).
- `approval_requests.status` has exactly 3 values: `pending`, `approved`, `rejected` (the spec's original 4-value wording is intentionally simplified — UI derives the 4 display labels from `status` + `current_step`).
- Frontend pages follow the established patterns in `resources/js/Pages/Assets/*` and `resources/js/Pages/Pegawai/*` (Tailwind utility classes already in use, `bg-[#1E40AF]` for primary buttons, `border-slate-200` borders, breadcrumb+h1 header block). No new component library.
- No JS test runner exists in this repo — frontend correctness is verified via Pest's `assertInertia` (component name + prop shape) plus a manual/browser check; do not attempt to add Vitest/Jest.
- Cetak Berita Acara PDF and real-time (push/websocket) notifications are explicitly out of scope for this plan.

## Review Focus

- **Rejecting mid-flow must not touch `assets`.** A reject at step 1 or step 2 must leave the `assets` table completely untouched — no partial asset creation, no orphaned rows. (Covered in Task 3 and Task 5.)
- **A category with no BMD code must fail loudly, not silently skip or crash with a generic SQL error.** Both at submit time and again at final-approval time (race condition: code could be cleared between submit and approve). (Covered in Task 5.)
- **An actor outside the current step's role/unit must be refused, not just hidden in the UI.** The HTTP layer (`ApprovalActionController`) must independently re-check `canAct()` — a hidden button is not a security boundary. (Covered in Task 3 and Task 8.)
- **A `draft` Berita Acara must be invisible to every approver**, including kasubag (who otherwise sees everything). No `approval_requests` row exists until explicit submission. (Covered in Task 7 and Task 9.)
- **Multiple units of the same line item must get distinct, sequential `kode_barang` values that continue from whatever already exists for that category code** — not reset to `.001` if assets already exist under that prefix. (Covered in Task 5.)

---

## Task 1: Seed official BMD codes onto existing asset categories

**Files:**
- Modify: `database/seeders/AssetCategorySeeder.php`
- Test: `tests/Feature/AssetCategorySeederTest.php`

**Interfaces:**
- Produces: `AssetCategory::code` populated for the 15 existing subkategori rows, so Task 5's `kode_barang` generation has real prefixes to use.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/AssetCategorySeederTest.php`:

```php
<?php

use App\Models\AssetCategory;
use Database\Seeders\AssetCategorySeeder;

it('seeds official BMD codes for every known subkategori', function () {
    (new AssetCategorySeeder)->run();

    $expected = [
        'KENDARAAN BERMOTOR ANGKUTAN BARANG' => '1.3.2.02.01.03',
        'KENDARAAN BERMOTOR BERODA DUA' => '1.3.2.02.01.04',
        'KENDARAAN DINAS BERMOTOR PERORANGAN' => '1.3.2.02.01.01',
        'ALAT KANTOR LAINNYA' => '1.3.2.05.01.05',
        'ALAT PENYIMPAN PERLENGKAPAN KANTOR' => '1.3.2.05.01.04',
        'ALAT DAPUR' => '1.3.2.05.02.05',
        'ALAT PENDINGIN' => '1.3.2.05.02.04',
        'ALAT RUMAH TANGGA LAINNYA (HOME USE)' => '1.3.2.05.02.06',
        'MEUBELAIR' => '1.3.2.05.02.01',
        'PERALATAN STUDIO VIDEO DAN FILM' => '1.3.2.06.01.02',
        'PERSONAL KOMPUTER' => '1.3.2.10.01.02',
        'KURSI KERJA PEJABAT' => '1.3.2.05.03.03',
        'LEMARI DAN ARSIP PEJABAT' => '1.3.2.05.03.07',
        'MEJA KERJA PEJABAT' => '1.3.2.05.03.01',
        'PERALATAN PERSONAL KOMPUTER' => '1.3.2.10.02.03',
    ];

    foreach ($expected as $name => $code) {
        expect(AssetCategory::where('name', $name)->first()?->code)->toBe($code);
    }
});

it('is idempotent and backfills the code onto an already-seeded category', function () {
    $parent = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA', 'parent_id' => null]);
    AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $parent->id]);

    (new AssetCategorySeeder)->run();

    expect(AssetCategory::where('name', 'ALAT PENDINGIN')->first()->code)->toBe('1.3.2.05.02.04')
        ->and(AssetCategory::where('name', 'ALAT PENDINGIN')->count())->toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetCategorySeederTest.php`
Expected: FAIL — `code` is null for every category (the seeder doesn't set it yet).

- [ ] **Step 3: Rewrite the seeder with codes, using `updateOrCreate` so it backfills existing rows**

Replace the full contents of `database/seeders/AssetCategorySeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    /**
     * Kategori => [Subkategori => kode BMD resmi].
     * Kode diambil dari docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx (sheet MASTER_ASET, 341 baris data real).
     */
    private const CATEGORIES = [
        'ALAT ANGKUTAN DARAT BERMOTOR' => [
            'KENDARAAN BERMOTOR ANGKUTAN BARANG' => '1.3.2.02.01.03',
            'KENDARAAN BERMOTOR BERODA DUA' => '1.3.2.02.01.04',
            'KENDARAAN DINAS BERMOTOR PERORANGAN' => '1.3.2.02.01.01',
        ],
        'ALAT KANTOR' => [
            'ALAT KANTOR LAINNYA' => '1.3.2.05.01.05',
            'ALAT PENYIMPAN PERLENGKAPAN KANTOR' => '1.3.2.05.01.04',
        ],
        'ALAT RUMAH TANGGA' => [
            'ALAT DAPUR' => '1.3.2.05.02.05',
            'ALAT PENDINGIN' => '1.3.2.05.02.04',
            'ALAT RUMAH TANGGA LAINNYA (HOME USE)' => '1.3.2.05.02.06',
            'MEUBELAIR' => '1.3.2.05.02.01',
        ],
        'ALAT STUDIO' => [
            'PERALATAN STUDIO VIDEO DAN FILM' => '1.3.2.06.01.02',
        ],
        'KOMPUTER UNIT' => [
            'PERSONAL KOMPUTER' => '1.3.2.10.01.02',
        ],
        'MEJA DAN KURSI KERJA/RAPAT PEJABAT' => [
            'KURSI KERJA PEJABAT' => '1.3.2.05.03.03',
            'LEMARI DAN ARSIP PEJABAT' => '1.3.2.05.03.07',
            'MEJA KERJA PEJABAT' => '1.3.2.05.03.01',
        ],
        'PERALATAN KOMPUTER' => [
            'PERALATAN PERSONAL KOMPUTER' => '1.3.2.10.02.03',
        ],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $kategori => $subkategori) {
            $parent = AssetCategory::updateOrCreate(
                ['name' => $kategori, 'parent_id' => null],
                []
            );

            foreach ($subkategori as $name => $code) {
                AssetCategory::updateOrCreate(
                    ['name' => $name, 'parent_id' => $parent->id],
                    ['code' => $code]
                );
            }
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/AssetCategorySeederTest.php`
Expected: PASS

- [ ] **Step 5: Re-seed the local dev database so existing categories get their codes**

Run: `php artisan db:seed --class=AssetCategorySeeder`

- [ ] **Step 6: Run the full suite to confirm nothing else broke**

Run: `php artisan test`
Expected: all green (this only adds a nullable-column value, no existing behavior changes)

- [ ] **Step 7: Commit**

```bash
git add database/seeders/AssetCategorySeeder.php tests/Feature/AssetCategorySeederTest.php
git commit -m "feat: seed official BMD codes onto existing asset categories"
```

---

## Task 2: Generic workflow engine schema, models, and the Penerimaan Aset definition

**Files:**
- Create: `database/migrations/2026_09_27_100000_create_workflow_definitions_table.php`
- Create: `database/migrations/2026_09_27_100001_create_workflow_steps_table.php`
- Create: `database/migrations/2026_09_27_100002_create_approval_requests_table.php`
- Create: `database/migrations/2026_09_27_100003_create_approval_actions_table.php`
- Create: `app/Enums/ApprovalStatus.php`
- Create: `app/Enums/ApprovalActionType.php`
- Create: `app/Enums/UnitScope.php`
- Create: `app/Models/WorkflowDefinition.php`
- Create: `app/Models/WorkflowStep.php`
- Create: `app/Models/ApprovalRequest.php`
- Create: `app/Models/ApprovalAction.php`
- Create: `database/seeders/WorkflowDefinitionSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`
- Test: `tests/Feature/WorkflowEngineModelsTest.php`

**Interfaces:**
- Produces: `WorkflowDefinition::steps()` (ordered `HasMany<WorkflowStep>`), `ApprovalRequest::currentStepDefinition(): ?WorkflowStep`, `ApprovalRequest::isLastStep(): bool`, `ApprovalRequest::approvable()` (`MorphTo`), `ApprovalRequest::actions()` (`HasMany<ApprovalAction>`), `ApprovalRequest::creator()` (`BelongsTo<User>`). A seeded `workflow_definitions` row with `code = 'penerimaan_aset'` and 2 steps (`kasubag`/`none`, `camat`/`subject`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/WorkflowEngineModelsTest.php`:

```php
<?php

use App\Enums\ApprovalActionType;
use App\Enums\ApprovalStatus;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowDefinition;
use Database\Seeders\WorkflowDefinitionSeeder;

it('seeds the penerimaan_aset definition with kasubag then camat steps', function () {
    (new WorkflowDefinitionSeeder)->run();

    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();

    expect($definition->steps)->toHaveCount(2)
        ->and($definition->steps[0]->approver_role)->toBe('kasubag')
        ->and($definition->steps[0]->unit_scope)->toBe(UnitScope::None)
        ->and($definition->steps[1]->approver_role)->toBe('camat')
        ->and($definition->steps[1]->unit_scope)->toBe(UnitScope::Subject);
});

it('resolves the current step definition and detects the last step', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $user = User::factory()->create();

    $request = ApprovalRequest::create([
        'workflow_definition_id' => $definition->id,
        'approvable_type' => User::class,
        'approvable_id' => $user->id,
        'current_step' => 1,
        'status' => ApprovalStatus::Pending,
        'created_by' => $user->id,
    ]);

    expect($request->currentStepDefinition()->approver_role)->toBe('kasubag')
        ->and($request->isLastStep())->toBeFalse();

    $request->current_step = 2;
    expect($request->isLastStep())->toBeTrue();
});

it('logs an approval action tied to a request', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $user = User::factory()->create();
    $request = ApprovalRequest::create([
        'workflow_definition_id' => $definition->id,
        'approvable_type' => User::class,
        'approvable_id' => $user->id,
        'current_step' => 1,
        'status' => ApprovalStatus::Pending,
        'created_by' => $user->id,
    ]);

    $action = $request->actions()->create([
        'step_order' => 1,
        'user_id' => $user->id,
        'action' => 'reject',
        'note' => 'Dokumen tidak lengkap',
    ]);

    expect($action->action)->toBe(ApprovalActionType::Reject)
        ->and($request->actions)->toHaveCount(1)
        ->and($request->creator->id)->toBe($user->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/WorkflowEngineModelsTest.php`
Expected: FAIL — none of the classes/tables exist yet.

- [ ] **Step 3: Create the migrations**

`database/migrations/2026_09_27_100000_create_workflow_definitions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_definitions');
    }
};
```

`database/migrations/2026_09_27_100001_create_workflow_steps_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_definition_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_order');
            $table->string('approver_role');
            $table->string('unit_scope');
            $table->timestamps();
            $table->unique(['workflow_definition_id', 'step_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_steps');
    }
};
```

`database/migrations/2026_09_27_100002_create_approval_requests_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_definition_id')->constrained();
            $table->morphs('approvable');
            $table->unsignedTinyInteger('current_step');
            $table->string('status')->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_requests');
    }
};
```

`database/migrations/2026_09_27_100003_create_approval_actions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_request_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_order');
            $table->foreignId('user_id')->constrained();
            $table->string('action');
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_actions');
    }
};
```

- [ ] **Step 4: Create the enums**

`app/Enums/ApprovalStatus.php`:

```php
<?php

namespace App\Enums;

enum ApprovalStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
```

`app/Enums/ApprovalActionType.php`:

```php
<?php

namespace App\Enums;

enum ApprovalActionType: string
{
    case Approve = 'approve';
    case Reject = 'reject';
}
```

`app/Enums/UnitScope.php`:

```php
<?php

namespace App\Enums;

enum UnitScope: string
{
    case None = 'none';
    case Subject = 'subject';
    case Origin = 'origin';
    case Destination = 'destination';
}
```

- [ ] **Step 5: Create the models**

`app/Models/WorkflowDefinition.php`:

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
}
```

`app/Models/WorkflowStep.php`:

```php
<?php

namespace App\Models;

use App\Enums\UnitScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStep extends Model
{
    protected $fillable = ['workflow_definition_id', 'step_order', 'approver_role', 'unit_scope'];

    protected function casts(): array
    {
        return ['unit_scope' => UnitScope::class, 'step_order' => 'integer'];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }
}
```

`app/Models/ApprovalRequest.php`:

```php
<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ApprovalRequest extends Model
{
    protected $fillable = [
        'workflow_definition_id', 'approvable_type', 'approvable_id',
        'current_step', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return ['status' => ApprovalStatus::class, 'current_step' => 'integer'];
    }

    public function approvable(): MorphTo
    {
        return $this->morphTo();
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(ApprovalAction::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function currentStepDefinition(): ?WorkflowStep
    {
        return $this->definition->steps->firstWhere('step_order', $this->current_step);
    }

    public function isLastStep(): bool
    {
        return $this->current_step >= $this->definition->steps->max('step_order');
    }
}
```

`app/Models/ApprovalAction.php`:

```php
<?php

namespace App\Models;

use App\Enums\ApprovalActionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalAction extends Model
{
    protected $fillable = ['approval_request_id', 'step_order', 'user_id', 'action', 'note'];

    protected function casts(): array
    {
        return ['action' => ApprovalActionType::class, 'step_order' => 'integer'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 6: Create the workflow definition seeder**

`database/seeders/WorkflowDefinitionSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        $definition = WorkflowDefinition::updateOrCreate(
            ['code' => 'penerimaan_aset'],
            ['name' => 'Penerimaan Aset']
        );

        $steps = [
            ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
            ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
        ];

        foreach ($steps as $step) {
            $definition->steps()->updateOrCreate(
                ['step_order' => $step['step_order']],
                $step
            );
        }
    }
}
```

Register it in `database/seeders/DatabaseSeeder.php` — add `WorkflowDefinitionSeeder::class` to the main `$this->call([...])` array so it runs in every environment:

```php
$this->call([
    RoleSeeder::class,
    UnitSeeder::class,
    AssetCategorySeeder::class,
    WorkflowDefinitionSeeder::class,
]);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `php artisan test tests/Feature/WorkflowEngineModelsTest.php`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 9: Commit**

```bash
git add database/migrations/2026_09_27_100000_create_workflow_definitions_table.php \
        database/migrations/2026_09_27_100001_create_workflow_steps_table.php \
        database/migrations/2026_09_27_100002_create_approval_requests_table.php \
        database/migrations/2026_09_27_100003_create_approval_actions_table.php \
        app/Enums/ApprovalStatus.php app/Enums/ApprovalActionType.php app/Enums/UnitScope.php \
        app/Models/WorkflowDefinition.php app/Models/WorkflowStep.php app/Models/ApprovalRequest.php app/Models/ApprovalAction.php \
        database/seeders/WorkflowDefinitionSeeder.php database/seeders/DatabaseSeeder.php \
        tests/Feature/WorkflowEngineModelsTest.php
git commit -m "feat: add generic approval workflow engine schema and models"
```

---

## Task 3: `ApprovalWorkflowService` — submit, approve, reject, and notifications

**Files:**
- Create: `database/migrations/2026_09_27_100004_create_notifications_table.php`
- Create: `config/workflow.php`
- Create: `app/Contracts/WorkflowEffect.php`
- Create: `app/Notifications/ApprovalStepNotification.php`
- Create: `app/Services/ApprovalWorkflowService.php`
- Test: `tests/Feature/ApprovalWorkflowServiceTest.php`

**Interfaces:**
- Consumes: `WorkflowDefinition`, `WorkflowStep`, `ApprovalRequest`, `ApprovalAction` from Task 2; `User::canAccessUnit()`, `User::hasRole()` (existing); `User::role()` scope from Spatie (existing dependency).
- Produces: `ApprovalWorkflowService::submit(Model $approvable, string $workflowCode, User $submitter): ApprovalRequest`, `::canAct(User $user, ApprovalRequest $request): bool`, `::approve(ApprovalRequest $request, User $approver, ?string $note = null): void`, `::reject(ApprovalRequest $request, User $approver, string $note): void`. `WorkflowEffect` interface with `apply(Model $approvable): void`, resolved from `config('workflow.effects.<code>')`. `ApprovalStepNotification` for the `database` channel.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/ApprovalWorkflowServiceTest.php`:

```php
<?php

use App\Contracts\WorkflowEffect;
use App\Enums\ApprovalStatus;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Model;
use Spatie\Permission\Models\Role;

class TestWorkflowEffect implements WorkflowEffect
{
    public static ?int $applied = null;

    public function apply(Model $approvable): void
    {
        self::$applied = $approvable->getKey();
    }
}

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');

    $this->kec = makeKecamatan();
    $this->submitter = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);

    $definition = WorkflowDefinition::create(['code' => 'test_workflow', 'name' => 'Test Workflow']);
    $definition->steps()->createMany([
        ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
        ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
    ]);

    config(['workflow.effects.test_workflow' => TestWorkflowEffect::class]);
    TestWorkflowEffect::$applied = null;

    $this->service = app(ApprovalWorkflowService::class);
});

it('submits at step 1 and notifies the first step approver', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    expect($request->current_step)->toBe(1)
        ->and($request->status)->toBe(ApprovalStatus::Pending)
        ->and($this->kasubag->notifications)->toHaveCount(1);
});

it('advances to the next step on approve and notifies its approver', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    $this->service->approve($request, $this->kasubag);

    expect($request->fresh()->current_step)->toBe(2)
        ->and($this->camat->fresh()->notifications)->toHaveCount(1);
});

it('triggers the registered effect and notifies the submitter on final approve', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);
    $this->service->approve($request, $this->kasubag);

    $this->service->approve($request, $this->camat);

    expect($request->fresh()->status)->toBe(ApprovalStatus::Approved)
        ->and(TestWorkflowEffect::$applied)->toBe($this->submitter->id)
        ->and($this->submitter->fresh()->notifications)->toHaveCount(1);
});

it('rejects with a required note, skips the effect, and notifies the submitter', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    $this->service->reject($request, $this->kasubag, 'Dokumen tidak lengkap');

    expect($request->fresh()->status)->toBe(ApprovalStatus::Rejected)
        ->and(TestWorkflowEffect::$applied)->toBeNull()
        ->and($this->submitter->fresh()->notifications)->toHaveCount(1);
});

it('forbids an actor without the required role or unit scope from approving', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    expect(fn () => $this->service->approve($request, $this->submitter))
        ->toThrow(InvalidArgumentException::class);

    $this->service->approve($request, $this->kasubag);
    $outsideCamat = userWithRole('camat', makeKecamatan('Kecamatan Lain'));

    expect(fn () => $this->service->approve($request, $outsideCamat))
        ->toThrow(InvalidArgumentException::class);
});

it('refuses to act twice on an already-decided request', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);
    $this->service->reject($request, $this->kasubag, 'Tidak lengkap');

    expect(fn () => $this->service->approve($request, $this->kasubag))
        ->toThrow(InvalidArgumentException::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ApprovalWorkflowServiceTest.php`
Expected: FAIL — `ApprovalWorkflowService` doesn't exist yet, and calling `->notify()` would fail without a `notifications` table.

- [ ] **Step 3: Create the notifications table migration**

`database/migrations/2026_09_27_100004_create_notifications_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
```

- [ ] **Step 4: Create the workflow config file**

`config/workflow.php`:

```php
<?php

return [
    /*
     * Maps a workflow_definitions.code to the WorkflowEffect implementation
     * that runs when a request under that code reaches its final approval.
     */
    'effects' => [],
];
```

- [ ] **Step 5: Create the effect contract**

`app/Contracts/WorkflowEffect.php`:

```php
<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;

interface WorkflowEffect
{
    public function apply(Model $approvable): void;
}
```

- [ ] **Step 6: Create the notification class**

`app/Notifications/ApprovalStepNotification.php`:

```php
<?php

namespace App\Notifications;

use App\Models\ApprovalRequest;
use Illuminate\Notifications\Notification;

class ApprovalStepNotification extends Notification
{
    public function __construct(
        private readonly ApprovalRequest $request,
        private readonly string $message,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'approval_request_id' => $this->request->id,
            'workflow_code' => $this->request->definition->code,
            'message' => $this->message,
        ];
    }
}
```

- [ ] **Step 7: Create `ApprovalWorkflowService`**

`app/Services/ApprovalWorkflowService.php`:

```php
<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\ApprovalStatus;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Models\WorkflowStep;
use App\Notifications\ApprovalStepNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ApprovalWorkflowService
{
    public function submit(Model $approvable, string $workflowCode, User $submitter): ApprovalRequest
    {
        $definition = WorkflowDefinition::where('code', $workflowCode)->firstOrFail();

        $request = ApprovalRequest::create([
            'workflow_definition_id' => $definition->id,
            'approvable_type' => $approvable->getMorphClass(),
            'approvable_id' => $approvable->getKey(),
            'current_step' => 1,
            'status' => ApprovalStatus::Pending,
            'created_by' => $submitter->id,
        ]);

        $request->setRelation('approvable', $approvable);
        $this->notifyApprovers($request);

        return $request;
    }

    public function canAct(User $user, ApprovalRequest $request): bool
    {
        $step = $request->currentStepDefinition();

        if ($step === null || ! $user->hasRole($step->approver_role)) {
            return false;
        }

        return match ($step->unit_scope) {
            UnitScope::None => true,
            UnitScope::Subject => $user->canAccessUnit($request->approvable->unit),
            UnitScope::Origin, UnitScope::Destination => false,
        };
    }

    public function approve(ApprovalRequest $request, User $approver, ?string $note = null): void
    {
        if ($request->status !== ApprovalStatus::Pending) {
            throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
        }

        if (! $this->canAct($approver, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang menyetujui step ini.');
        }

        DB::transaction(function () use ($request, $approver, $note) {
            $request->actions()->create([
                'step_order' => $request->current_step,
                'user_id' => $approver->id,
                'action' => ApprovalActionType::Approve,
                'note' => $note,
            ]);

            if ($request->isLastStep()) {
                $request->update(['status' => ApprovalStatus::Approved]);
                $this->runEffect($request);
            } else {
                $request->update(['current_step' => $request->current_step + 1]);
            }
        });

        if ($request->fresh()->status === ApprovalStatus::Approved) {
            $this->notifySubmitter($request, 'Pengajuan Anda telah disetujui.');
        } else {
            $this->notifyApprovers($request->fresh());
        }
    }

    public function reject(ApprovalRequest $request, User $approver, string $note): void
    {
        if ($request->status !== ApprovalStatus::Pending) {
            throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
        }

        if (! $this->canAct($approver, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang menolak step ini.');
        }

        DB::transaction(function () use ($request, $approver, $note) {
            $request->actions()->create([
                'step_order' => $request->current_step,
                'user_id' => $approver->id,
                'action' => ApprovalActionType::Reject,
                'note' => $note,
            ]);

            $request->update(['status' => ApprovalStatus::Rejected]);
        });

        $this->notifySubmitter($request, "Pengajuan Anda ditolak: {$note}");
    }

    private function runEffect(ApprovalRequest $request): void
    {
        $effectClass = config("workflow.effects.{$request->definition->code}");

        if ($effectClass === null) {
            throw new InvalidArgumentException("Tidak ada effect terdaftar untuk alur \"{$request->definition->code}\".");
        }

        app($effectClass)->apply($request->approvable);
    }

    private function notifyApprovers(ApprovalRequest $request): void
    {
        $step = $request->currentStepDefinition();

        if ($step === null) {
            return;
        }

        $this->approversFor($step, $request->approvable)->each(
            fn (User $user) => $user->notify(new ApprovalStepNotification(
                $request,
                "Menunggu persetujuan Anda: {$request->definition->name}",
            ))
        );
    }

    private function notifySubmitter(ApprovalRequest $request, string $message): void
    {
        $request->creator->notify(new ApprovalStepNotification($request, $message));
    }

    /** @return Collection<int, User> */
    private function approversFor(WorkflowStep $step, Model $approvable): Collection
    {
        $users = User::role($step->approver_role)->get();

        if ($step->unit_scope === UnitScope::Subject) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->unit))->values();
        }

        return $users;
    }
}
```

Note: `submit()` calls `$request->setRelation('approvable', $approvable)` so the just-created request doesn't need a fresh DB round-trip to resolve its own polymorphic relation before notifying — the caller already has the model in hand.

- [ ] **Step 8: Run test to verify it passes**

Run: `php artisan test tests/Feature/ApprovalWorkflowServiceTest.php`
Expected: PASS

- [ ] **Step 9: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 10: Commit**

```bash
git add database/migrations/2026_09_27_100004_create_notifications_table.php \
        config/workflow.php app/Contracts/WorkflowEffect.php app/Notifications/ApprovalStepNotification.php \
        app/Services/ApprovalWorkflowService.php tests/Feature/ApprovalWorkflowServiceTest.php
git commit -m "feat: add ApprovalWorkflowService with step progression and notifications"
```

---

## Task 4: `BeritaAcaraPenerimaan` and `BeritaAcaraItem` data model

**Files:**
- Create: `database/migrations/2026_09_27_100005_create_berita_acara_penerimaans_table.php`
- Create: `database/migrations/2026_09_27_100006_create_berita_acara_items_table.php`
- Create: `app/Enums/BeritaAcaraStatus.php`
- Create: `app/Models/BeritaAcaraPenerimaan.php`
- Create: `app/Models/BeritaAcaraItem.php`
- Test: `tests/Feature/BeritaAcaraModelsTest.php`

**Interfaces:**
- Consumes: existing `AssetPhoto` model + its polymorphic `photoable` morph (reused as-is for supporting documents — despite the name, it's already a generic `{path, photoable_type, photoable_id}` table with no image-specific logic).
- Produces: `BeritaAcaraPenerimaan::items()` (`HasMany<BeritaAcaraItem>`), `::unit()`, `::creator()`, `::photos()` (`MorphMany<AssetPhoto>`), `::approvalRequest()` (`MorphOne<ApprovalRequest>`). `BeritaAcaraItem::category()` (`BelongsTo<AssetCategory>`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/BeritaAcaraModelsTest.php`:

```php
<?php

use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);
});

it('creates a draft berita acara with items and casts fields correctly', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/001/IX/2025',
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/001/IX/2025',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'draft',
    ]);

    $item = $ba->items()->create([
        'nama_aset' => 'AC Split Daikin 1.5PK',
        'merk_type' => 'FTXM35 Inverter',
        'category_id' => $this->category->id,
        'jumlah_unit' => 3,
        'nilai_per_unit' => 5500000,
        'kondisi_awal' => 'baik',
    ]);

    expect($ba->status)->toBe(BeritaAcaraStatus::Draft)
        ->and($ba->items)->toHaveCount(1)
        ->and($item->kondisi_awal)->toBe(Kondisi::Baik)
        ->and($item->category->id)->toBe($this->category->id)
        ->and($ba->unit->id)->toBe($this->kec->id)
        ->and($ba->creator->id)->toBe($this->admin->id);
});

it('attaches supporting documents via the existing polymorphic photo table', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/002/IX/2025',
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/002/IX/2025',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'draft',
    ]);

    $ba->photos()->create(['path' => 'berita-acara/1/dokumen.pdf']);

    expect($ba->photos)->toHaveCount(1)
        ->and($ba->photos->first()->url)->toContain('berita-acara/1/dokumen.pdf');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/BeritaAcaraModelsTest.php`
Expected: FAIL — tables/models don't exist yet.

- [ ] **Step 3: Create the migrations**

`database/migrations/2026_09_27_100005_create_berita_acara_penerimaans_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('berita_acara_penerimaans', function (Blueprint $table) {
            $table->id();
            $table->string('no_berita_acara')->unique();
            $table->date('tanggal_penerimaan');
            $table->string('sumber_perolehan')->nullable();
            $table->string('no_kontrak_spk');
            $table->string('vendor')->nullable();
            $table->text('catatan')->nullable();
            $table->foreignId('unit_id')->constrained();
            $table->foreignId('created_by')->constrained('users');
            $table->string('status')->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('berita_acara_penerimaans');
    }
};
```

`database/migrations/2026_09_27_100006_create_berita_acara_items_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('berita_acara_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('berita_acara_penerimaan_id')->constrained()->cascadeOnDelete();
            $table->string('nama_aset');
            $table->string('merk_type')->nullable();
            $table->foreignId('category_id')->constrained('asset_categories');
            $table->unsignedInteger('jumlah_unit');
            $table->decimal('nilai_per_unit', 15, 2);
            $table->string('kondisi_awal')->default('baik');
            $table->json('asset_ids')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('berita_acara_items');
    }
};
```

- [ ] **Step 4: Create the enum**

`app/Enums/BeritaAcaraStatus.php`:

```php
<?php

namespace App\Enums;

enum BeritaAcaraStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
}
```

- [ ] **Step 5: Create the models**

`app/Models/BeritaAcaraPenerimaan.php`:

```php
<?php

namespace App\Models;

use App\Enums\BeritaAcaraStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class BeritaAcaraPenerimaan extends Model
{
    use HasFactory;

    protected $fillable = [
        'no_berita_acara', 'tanggal_penerimaan', 'sumber_perolehan',
        'no_kontrak_spk', 'vendor', 'catatan', 'unit_id', 'created_by', 'status',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_penerimaan' => 'date:Y-m-d',
            'status' => BeritaAcaraStatus::class,
            'unit_id' => 'integer',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(BeritaAcaraItem::class);
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
        return "Penerimaan Aset #{$this->no_berita_acara}";
    }

    public function approvalShowUrl(): string
    {
        return route('penerimaan-aset.show', $this);
    }
}
```

`app/Models/BeritaAcaraItem.php`:

```php
<?php

namespace App\Models;

use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BeritaAcaraItem extends Model
{
    protected $fillable = [
        'berita_acara_penerimaan_id', 'nama_aset', 'merk_type', 'category_id',
        'jumlah_unit', 'nilai_per_unit', 'kondisi_awal', 'asset_ids',
    ];

    protected function casts(): array
    {
        return [
            'jumlah_unit' => 'integer',
            'nilai_per_unit' => 'decimal:2',
            'kondisi_awal' => Kondisi::class,
            'asset_ids' => 'array',
        ];
    }

    public function beritaAcara(): BelongsTo
    {
        return $this->belongsTo(BeritaAcaraPenerimaan::class, 'berita_acara_penerimaan_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test tests/Feature/BeritaAcaraModelsTest.php`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add database/migrations/2026_09_27_100005_create_berita_acara_penerimaans_table.php \
        database/migrations/2026_09_27_100006_create_berita_acara_items_table.php \
        app/Enums/BeritaAcaraStatus.php app/Models/BeritaAcaraPenerimaan.php app/Models/BeritaAcaraItem.php \
        tests/Feature/BeritaAcaraModelsTest.php
git commit -m "feat: add BeritaAcaraPenerimaan and BeritaAcaraItem models"
```

---

## Task 5: `PenerimaanAsetEffect` — turning an approved Berita Acara into real Assets

**Files:**
- Modify: `app/Repositories/Contracts/AssetRepositoryInterface.php`
- Modify: `app/Repositories/EloquentAssetRepository.php`
- Create: `app/Services/PenerimaanAsetEffect.php`
- Modify: `config/workflow.php`
- Test: `tests/Feature/PenerimaanAsetEffectTest.php`

**Interfaces:**
- Consumes: `ApprovalWorkflowService` (Task 3), `BeritaAcaraPenerimaan`/`BeritaAcaraItem` (Task 4), `AssetRepositoryInterface::create()` and `::maxRegisterNumber()` (existing).
- Produces: `AssetRepositoryInterface::maxKodeBarangSuffix(string $prefix): int`. `PenerimaanAsetEffect implements WorkflowEffect`, registered for `workflow.effects.penerimaan_aset`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PenerimaanAsetEffectTest.php`:

```php
<?php

use App\Enums\ApprovalStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);

    $this->service = app(ApprovalWorkflowService::class);
});

function makeBeritaAcaraForEffectTest(object $test, int $jumlahUnit = 3): BeritaAcaraPenerimaan
{
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/042/VIII/2025',
        'tanggal_penerimaan' => '2025-08-05',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/042/VIII/2025',
        'vendor' => 'PT. Daikin Indonesia',
        'unit_id' => $test->kec->id,
        'created_by' => $test->admin->id,
        'status' => 'submitted',
    ]);

    $ba->items()->create([
        'nama_aset' => 'AC Split Daikin 1.5PK',
        'merk_type' => 'FTXM35 Inverter',
        'category_id' => $test->category->id,
        'jumlah_unit' => $jumlahUnit,
        'nilai_per_unit' => 5500000,
        'kondisi_awal' => 'baik',
    ]);

    return $ba;
}

it('creates one Asset per unit with sequential kode_barang on final approval', function () {
    $ba = makeBeritaAcaraForEffectTest($this);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $codes = Asset::where('category_id', $this->category->id)->orderBy('kode_barang')->pluck('kode_barang');

    expect($codes->all())->toBe([
        '1.3.2.05.02.04.001',
        '1.3.2.05.02.04.002',
        '1.3.2.05.02.04.003',
    ]);

    $asset = Asset::where('kode_barang', '1.3.2.05.02.04.001')->firstOrFail();
    expect($asset->nama_aset)->toBe('AC Split Daikin 1.5PK')
        ->and($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->no_dokumen)->toBe('BA/042/VIII/2025')
        ->and($asset->histories()->where('event', 'diterima')->exists())->toBeTrue();

    expect($ba->items->first()->fresh()->asset_ids)->toHaveCount(3);
});

it('continues the sequence from existing assets under the same category code', function () {
    Asset::factory()->create(['category_id' => $this->category->id, 'kode_barang' => '1.3.2.05.02.04.005']);

    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 1);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    expect(Asset::where('kode_barang', '1.3.2.05.02.04.006')->exists())->toBeTrue();
});

it('fails the final approval clearly when the category has no BMD code', function () {
    $this->category->update(['code' => null]);
    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 1);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);

    expect(fn () => $this->service->approve($request, $this->camat))
        ->toThrow(InvalidArgumentException::class);

    expect(Asset::where('category_id', $this->category->id)->count())->toBe(0);
});

it('does not create any asset when rejected before the final step', function () {
    $ba = makeBeritaAcaraForEffectTest($this);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->reject($request, $this->kasubag, 'Dokumen tidak lengkap');

    expect(Asset::where('category_id', $this->category->id)->count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PenerimaanAsetEffectTest.php`
Expected: FAIL — `PenerimaanAsetEffect` doesn't exist and no effect is registered for `penerimaan_aset`, so the final approve throws "Tidak ada effect terdaftar".

- [ ] **Step 3: Add `maxKodeBarangSuffix` to the asset repository**

In `app/Repositories/Contracts/AssetRepositoryInterface.php`, add this method to the interface (alongside the existing `maxRegisterNumber`):

```php
    public function maxKodeBarangSuffix(string $prefix): int;
```

In `app/Repositories/EloquentAssetRepository.php`, add the implementation right after `maxRegisterNumber`:

```php
    public function maxKodeBarangSuffix(string $prefix): int
    {
        return Asset::query()
            ->where('kode_barang', 'like', $prefix.'.%')
            ->lockForUpdate()
            ->get(['kode_barang'])
            ->map(fn (Asset $a) => (int) substr($a->kode_barang, strlen($prefix) + 1))
            ->max() ?? 0;
    }
```

- [ ] **Step 4: Create `PenerimaanAsetEffect`**

`app/Services/PenerimaanAsetEffect.php`:

```php
<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetStatus;
use App\Models\BeritaAcaraPenerimaan;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PenerimaanAsetEffect implements WorkflowEffect
{
    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof BeritaAcaraPenerimaan) {
            throw new InvalidArgumentException('PenerimaanAsetEffect hanya berlaku untuk BeritaAcaraPenerimaan.');
        }

        DB::transaction(function () use ($approvable) {
            foreach ($approvable->items as $item) {
                $category = $item->category;

                if (blank($category->code)) {
                    throw new InvalidArgumentException(
                        "Kategori \"{$category->name}\" belum punya kode BMD. Isi dulu lewat halaman Kategori Aset."
                    );
                }

                $assetIds = [];

                for ($i = 0; $i < $item->jumlah_unit; $i++) {
                    $suffix = $this->assets->maxKodeBarangSuffix($category->code) + 1;
                    $kodeBarang = $category->code.'.'.str_pad((string) $suffix, 3, '0', STR_PAD_LEFT);

                    $asset = $this->assets->create([
                        'kode_barang' => $kodeBarang,
                        'nomor_register' => $this->assets->maxRegisterNumber($kodeBarang) + 1,
                        'nama_aset' => $item->nama_aset,
                        'merk_type' => $item->merk_type,
                        'category_id' => $item->category_id,
                        'unit_id' => $approvable->unit_id,
                        'kondisi' => $item->kondisi_awal,
                        'status' => AssetStatus::Aktif,
                        'tanggal_perolehan' => $approvable->tanggal_penerimaan,
                        'sumber_perolehan' => $approvable->sumber_perolehan,
                        'nilai_perolehan' => $item->nilai_per_unit,
                        'nilai_buku' => $item->nilai_per_unit,
                        'no_dokumen' => $approvable->no_berita_acara,
                    ]);

                    $asset->histories()->create([
                        'event' => 'diterima',
                        'unit_id' => $asset->unit_id,
                        'current_holder_id' => null,
                        'kondisi' => $asset->kondisi,
                        'user_id' => $approvable->created_by,
                    ]);

                    $assetIds[] = $asset->id;
                }

                $item->update(['asset_ids' => $assetIds]);
            }
        });
    }
}
```

- [ ] **Step 5: Register the effect**

Replace the contents of `config/workflow.php`:

```php
<?php

use App\Services\PenerimaanAsetEffect;

return [
    /*
     * Maps a workflow_definitions.code to the WorkflowEffect implementation
     * that runs when a request under that code reaches its final approval.
     */
    'effects' => [
        'penerimaan_aset' => PenerimaanAsetEffect::class,
    ],
];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test tests/Feature/PenerimaanAsetEffectTest.php`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add app/Repositories/Contracts/AssetRepositoryInterface.php app/Repositories/EloquentAssetRepository.php \
        app/Services/PenerimaanAsetEffect.php config/workflow.php tests/Feature/PenerimaanAsetEffectTest.php
git commit -m "feat: create Assets from an approved Berita Acara with sequential kode_barang"
```

---

## Task 6: Real notification bell data — shared prop and mark-as-read

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Create: `app/Http/Controllers/NotificationController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/NotificationSharedPropTest.php`

**Interfaces:**
- Produces: Inertia shared prop `notifications: { unread_count: number, items: { id: string, message: string, created_at: string }[] }` on every page. `POST /notifications/{notification}/read` named `notifications.read`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/NotificationSharedPropTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function submitSampleBeritaAcara(string $noBa): array
{
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $admin = userWithRole('admin_kecamatan', $kec);
    $kasubag = userWithRole('kasubag');
    $category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $noBa,
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/'.$noBa,
        'unit_id' => $kec->id,
        'created_by' => $admin->id,
        'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);

    app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $admin);

    return compact('kasubag', 'admin', 'ba');
}

it('shares unread notification count and latest items on every page', function () {
    ['kasubag' => $kasubag] = submitSampleBeritaAcara('BA/001/IX/2025');

    $this->actingAs($kasubag)->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unread_count', 1)
            ->where('notifications.items.0.message', fn (string $m) => str_contains($m, 'Penerimaan Aset'))
        );
});

it('marks a notification as read', function () {
    ['kasubag' => $kasubag] = submitSampleBeritaAcara('BA/002/IX/2025');
    $notification = $kasubag->unreadNotifications()->firstOrFail();

    $this->actingAs($kasubag)->post("/notifications/{$notification->id}/read")->assertRedirect();

    expect($kasubag->unreadNotifications()->count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/NotificationSharedPropTest.php`
Expected: FAIL — no `notifications` shared prop, no `/notifications/{id}/read` route.

- [ ] **Step 3: Add the shared prop**

In `app/Http/Middleware/HandleInertiaRequests.php`, add a `notifications` key to the array returned by `share()`, right after `'flash'`:

```php
            'notifications' => $request->user() ? [
                'unread_count' => $request->user()->unreadNotifications()->count(),
                'items' => $request->user()->unreadNotifications()->latest()->take(5)->get()->map(fn ($n) => [
                    'id' => $n->id,
                    'message' => $n->data['message'],
                    'created_at' => $n->created_at->diffForHumans(),
                ]),
            ] : ['unread_count' => 0, 'items' => []],
```

- [ ] **Step 4: Create `NotificationController`**

`app/Http/Controllers/NotificationController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $request->user()->unreadNotifications()->where('id', $notification)->first()?->markAsRead();

        return back();
    }
}
```

- [ ] **Step 5: Add the route**

In `routes/web.php`, add inside the `Route::middleware('auth')->group(...)` block (near the profile routes):

```php
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
```

Add the import at the top of the file: `use App\Http\Controllers\NotificationController;`

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test tests/Feature/NotificationSharedPropTest.php`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php app/Http/Controllers/NotificationController.php \
        routes/web.php tests/Feature/NotificationSharedPropTest.php
git commit -m "feat: share real unread notifications and add mark-as-read endpoint"
```

---

## Task 7: `PenerimaanAsetController` — index, create, store, show

**Files:**
- Create: `app/Policies/BeritaAcaraPenerimaanPolicy.php`
- Create: `app/Http/Requests/StoreBeritaAcaraRequest.php`
- Create: `app/Http/Controllers/PenerimaanAsetController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/PenerimaanAsetControllerTest.php`

**Interfaces:**
- Consumes: `ApprovalWorkflowService::submit()` (Task 3), `BeritaAcaraPenerimaan`/`BeritaAcaraItem` (Task 4), `AssetCategory`, `Kondisi::options()` (existing), `User::accessibleUnitIds()` (existing).
- Produces: routes `penerimaan-aset.index`, `.create`, `.store`, `.show`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PenerimaanAsetControllerTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('lurah');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);
});

it('lets admin kecamatan draft and submit a berita acara with multiple items', function () {
    $payload = [
        'no_berita_acara' => 'BA/010/IX/2025',
        'tanggal_penerimaan' => '2025-09-10',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/010',
        'vendor' => 'PT Contoh',
        'status' => 'submitted',
        'items' => [
            [
                'nama_aset' => 'AC Split', 'merk_type' => 'Daikin', 'category_id' => $this->category->id,
                'jumlah_unit' => 2, 'nilai_per_unit' => 5000000, 'kondisi_awal' => 'baik',
            ],
        ],
    ];

    $response = $this->actingAs($this->admin)->post('/penerimaan-aset', $payload);

    $ba = BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/010/IX/2025')->firstOrFail();
    $response->assertRedirect(route('penerimaan-aset.show', $ba));
    expect($ba->status->value)->toBe('submitted')
        ->and($ba->approvalRequest)->not->toBeNull()
        ->and($ba->approvalRequest->current_step)->toBe(1);
});

it('does not create an approval request for a draft', function () {
    $payload = [
        'no_berita_acara' => 'BA/011/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/011', 'status' => 'draft',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $this->category->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->post('/penerimaan-aset', $payload);

    $ba = BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/011/IX/2025')->firstOrFail();
    expect($ba->approvalRequest)->toBeNull();
});

it('forbids a non admin_kecamatan role from creating a berita acara', function () {
    $lurah = userWithRole('lurah', makeKelurahan($this->kec, 'Kelurahan A'));

    $this->actingAs($lurah)->get('/penerimaan-aset/create')->assertForbidden();
});

it('fails fast at submit time when an item uses a category with no BMD code', function () {
    $noCode = AssetCategory::factory()->create(['code' => null]);

    $payload = [
        'no_berita_acara' => 'BA/012/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/012', 'status' => 'submitted',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $noCode->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->from('/penerimaan-aset/create')
        ->post('/penerimaan-aset', $payload)
        ->assertSessionHasErrors('items.0.category_id');

    expect(BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/012/IX/2025')->exists())->toBeFalse();
});

it('allows saving a draft with a category that has no BMD code yet', function () {
    $noCode = AssetCategory::factory()->create(['code' => null]);

    $payload = [
        'no_berita_acara' => 'BA/013/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/013', 'status' => 'draft',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $noCode->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->post('/penerimaan-aset', $payload)->assertSessionHasNoErrors();

    expect(BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/013/IX/2025')->exists())->toBeTrue();
});

it('shows kasubag every berita acara regardless of unit, and scopes admin_kecamatan to their own', function () {
    $otherKec = makeKecamatan('Kecamatan Lain');
    $otherAdmin = userWithRole('admin_kecamatan', $otherKec);

    $mine = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/020/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/020', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'draft',
    ]);
    $theirs = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/021/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/021', 'unit_id' => $otherKec->id,
        'created_by' => $otherAdmin->id, 'status' => 'draft',
    ]);

    $this->actingAs($this->admin)->get('/penerimaan-aset')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.data', fn ($data) => collect($data)->pluck('id')->all() === [$mine->id])
        );

    $this->actingAs($this->kasubag)->get('/penerimaan-aset')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.data', fn ($data) => collect($data)->pluck('id')->sort()->values()->all() === collect([$mine->id, $theirs->id])->sort()->values()->all())
        );
});

it('shows the approve/reject actions only to the eligible current-step approver', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/030/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/030', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $this->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    app(\App\Services\ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $this->admin);

    $this->actingAs($this->kasubag)->get("/penerimaan-aset/{$ba->id}")
        ->assertInertia(fn (Assert $page) => $page->where('can.act', true));

    $camat = userWithRole('camat', $this->kec);
    $this->actingAs($camat)->get("/penerimaan-aset/{$ba->id}")
        ->assertInertia(fn (Assert $page) => $page->where('can.act', false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PenerimaanAsetControllerTest.php`
Expected: FAIL — routes/controller/policy/request don't exist yet.

- [ ] **Step 3: Create the policy**

`app/Policies/BeritaAcaraPenerimaanPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;

class BeritaAcaraPenerimaanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['admin_kecamatan', 'kasubag', 'camat']);
    }

    public function view(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $user->hasRole('kasubag') || $user->canAccessUnit($beritaAcara->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasRole('admin_kecamatan') && $user->unit_id !== null;
    }
}
```

- [ ] **Step 4: Create the store request**

`app/Http/Requests/StoreBeritaAcaraRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBeritaAcaraRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', BeritaAcaraPenerimaan::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'no_berita_acara' => ['required', 'string', 'max:100', Rule::unique('berita_acara_penerimaans', 'no_berita_acara')],
            'tanggal_penerimaan' => ['required', 'date'],
            'sumber_perolehan' => ['nullable', 'string', 'max:255'],
            'no_kontrak_spk' => ['required', 'string', 'max:100'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'catatan' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['draft', 'submitted'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.nama_aset' => ['required', 'string', 'max:255'],
            'items.*.merk_type' => ['nullable', 'string', 'max:255'],
            'items.*.category_id' => [
                'required', 'integer',
                Rule::exists('asset_categories', 'id')->whereNotNull('parent_id'),
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Fail fast at submit time — Task 5's PenerimaanAsetEffect re-checks this
                    // again at final approval as a race-condition guard (the code could be
                    // cleared between submit and approve).
                    if ($this->input('status') !== 'submitted') {
                        return;
                    }

                    $category = AssetCategory::find($value);

                    if ($category && blank($category->code)) {
                        $fail("Kategori \"{$category->name}\" belum punya kode BMD. Isi dulu lewat halaman Kategori Aset.");
                    }
                },
            ],
            'items.*.jumlah_unit' => ['required', 'integer', 'min:1'],
            'items.*.nilai_per_unit' => ['required', 'numeric', 'min:0'],
            'items.*.kondisi_awal' => ['required', Rule::in(array_column(Kondisi::cases(), 'value'))],
            'dokumen' => ['nullable', 'array'],
            'dokumen.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'no_berita_acara.unique' => 'Nomor Berita Acara ini sudah dipakai.',
            'items.required' => 'Tambahkan minimal satu barang yang diterima.',
        ];
    }
}
```

- [ ] **Step 5: Create the controller**

`app/Http/Controllers/PenerimaanAsetController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Http\Requests\StoreBeritaAcaraRequest;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PenerimaanAsetController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', BeritaAcaraPenerimaan::class);

        $user = $request->user();

        $query = BeritaAcaraPenerimaan::with(['unit', 'creator', 'items', 'approvalRequest'])
            ->when(! $user->hasRole('kasubag'), fn (Builder $q) => $q->whereIn('unit_id', $user->accessibleUnitIds() ?? []))
            ->when($request->search, fn (Builder $q, $search) => $q->where(fn (Builder $q2) => $q2
                ->where('no_berita_acara', 'like', "%{$search}%")
                ->orWhereHas('items', fn (Builder $q3) => $q3->where('nama_aset', 'like', "%{$search}%"))
            ))
            ->latest('tanggal_penerimaan');

        return Inertia::render('Penerimaan/Index', [
            'items' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
            'can' => ['create' => $user->can('create', BeritaAcaraPenerimaan::class)],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', BeritaAcaraPenerimaan::class);

        return Inertia::render('Penerimaan/Create', [
            'categories' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ]);
    }

    public function store(StoreBeritaAcaraRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $ba = DB::transaction(function () use ($data, $user) {
            $ba = BeritaAcaraPenerimaan::create([
                'no_berita_acara' => $data['no_berita_acara'],
                'tanggal_penerimaan' => $data['tanggal_penerimaan'],
                'sumber_perolehan' => $data['sumber_perolehan'] ?? null,
                'no_kontrak_spk' => $data['no_kontrak_spk'],
                'vendor' => $data['vendor'] ?? null,
                'catatan' => $data['catatan'] ?? null,
                'status' => $data['status'],
                'unit_id' => $user->unit_id,
                'created_by' => $user->id,
            ]);

            foreach ($data['items'] as $item) {
                $ba->items()->create($item);
            }

            foreach ($request->file('dokumen', []) as $file) {
                $ba->photos()->create(['path' => $file->store("berita-acara/{$ba->id}", 'public')]);
            }

            return $ba;
        });

        if ($ba->status === BeritaAcaraStatus::Submitted) {
            $this->workflow->submit($ba, 'penerimaan_aset', $user);
        }

        return redirect()->route('penerimaan-aset.show', $ba)
            ->with('success', $ba->status === BeritaAcaraStatus::Submitted
                ? 'Penerimaan aset berhasil diajukan.'
                : 'Draft berhasil disimpan.');
    }

    public function show(Request $request, BeritaAcaraPenerimaan $beritaAcara): Response
    {
        Gate::authorize('view', $beritaAcara);

        $beritaAcara->load([
            'unit', 'creator', 'items.category',
            'approvalRequest.definition.steps', 'approvalRequest.actions.user',
        ]);

        $approvalRequest = $beritaAcara->approvalRequest;

        return Inertia::render('Penerimaan/Show', [
            'beritaAcara' => $beritaAcara,
            'can' => [
                'act' => $approvalRequest !== null && $this->workflow->canAct($request->user(), $approvalRequest),
            ],
        ]);
    }
}
```

- [ ] **Step 6: Add the routes**

In `routes/web.php`, add inside the `Route::middleware('auth')->group(...)` block:

```php
    Route::get('/penerimaan-aset', [PenerimaanAsetController::class, 'index'])->name('penerimaan-aset.index');
    Route::get('/penerimaan-aset/create', [PenerimaanAsetController::class, 'create'])->name('penerimaan-aset.create');
    Route::post('/penerimaan-aset', [PenerimaanAsetController::class, 'store'])->name('penerimaan-aset.store');
    Route::get('/penerimaan-aset/{beritaAcara}', [PenerimaanAsetController::class, 'show'])->name('penerimaan-aset.show');
```

Add the import at the top of the file: `use App\Http\Controllers\PenerimaanAsetController;`

- [ ] **Step 7: Run test to verify it passes**

Run: `php artisan test tests/Feature/PenerimaanAsetControllerTest.php`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 9: Commit**

```bash
git add app/Policies/BeritaAcaraPenerimaanPolicy.php app/Http/Requests/StoreBeritaAcaraRequest.php \
        app/Http/Controllers/PenerimaanAsetController.php routes/web.php \
        tests/Feature/PenerimaanAsetControllerTest.php
git commit -m "feat: add Penerimaan Aset index/create/store/show endpoints"
```

---

## Task 8: `ApprovalActionController` — approve/reject over HTTP

**Files:**
- Create: `app/Http/Requests/RejectApprovalRequest.php`
- Create: `app/Http/Controllers/ApprovalActionController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/ApprovalActionControllerTest.php`

**Interfaces:**
- Consumes: `ApprovalWorkflowService::canAct()`, `::approve()`, `::reject()` (Task 3).
- Produces: routes `approval-requests.approve`, `approval-requests.reject` — generic, works for any future workflow type since they operate on `ApprovalRequest` directly.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/ApprovalActionControllerTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);

    $this->ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/050/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/050', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $this->ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $this->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    $this->request = app(ApprovalWorkflowService::class)->submit($this->ba, 'penerimaan_aset', $this->admin);
});

it('lets the eligible kasubag approve step 1 via HTTP', function () {
    $this->actingAs($this->kasubag)
        ->post("/approval-requests/{$this->request->id}/approve")
        ->assertRedirect();

    expect($this->request->fresh()->current_step)->toBe(2);
});

it('forbids camat from approving before kasubag has verified', function () {
    $this->actingAs($this->camat)
        ->post("/approval-requests/{$this->request->id}/approve")
        ->assertForbidden();
});

it('requires a note to reject', function () {
    $this->actingAs($this->kasubag)
        ->from("/penerimaan-aset/{$this->ba->id}")
        ->post("/approval-requests/{$this->request->id}/reject", [])
        ->assertSessionHasErrors('note');
});

it('rejects with a note via HTTP', function () {
    $this->actingAs($this->kasubag)
        ->post("/approval-requests/{$this->request->id}/reject", ['note' => 'Dokumen tidak lengkap'])
        ->assertRedirect();

    expect($this->request->fresh()->status->value)->toBe('rejected');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ApprovalActionControllerTest.php`
Expected: FAIL — routes/controller don't exist yet.

- [ ] **Step 3: Create the reject request**

`app/Http/Requests/RejectApprovalRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RejectApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Eligibility depends on the specific request's current step, so the
        // controller checks ApprovalWorkflowService::canAct() explicitly.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['note' => ['required', 'string', 'max:1000']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['note.required' => 'Alasan penolakan wajib diisi.'];
    }
}
```

- [ ] **Step 4: Create the controller**

`app/Http/Controllers/ApprovalActionController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\RejectApprovalRequest;
use App\Models\ApprovalRequest;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ApprovalActionController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function approve(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canAct($request->user(), $approvalRequest), 403);

        $this->workflow->approve($approvalRequest, $request->user());

        return back()->with('success', 'Persetujuan berhasil dicatat.');
    }

    public function reject(RejectApprovalRequest $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canAct($request->user(), $approvalRequest), 403);

        $this->workflow->reject($approvalRequest, $request->user(), $request->validated('note'));

        return back()->with('success', 'Pengajuan ditolak.');
    }
}
```

- [ ] **Step 5: Add the routes**

In `routes/web.php`, add inside the `Route::middleware('auth')->group(...)` block:

```php
    Route::post('/approval-requests/{approvalRequest}/approve', [ApprovalActionController::class, 'approve'])->name('approval-requests.approve');
    Route::post('/approval-requests/{approvalRequest}/reject', [ApprovalActionController::class, 'reject'])->name('approval-requests.reject');
```

Add the import at the top of the file: `use App\Http\Controllers\ApprovalActionController;`

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test tests/Feature/ApprovalActionControllerTest.php`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add app/Http/Requests/RejectApprovalRequest.php app/Http/Controllers/ApprovalActionController.php \
        routes/web.php tests/Feature/ApprovalActionControllerTest.php
git commit -m "feat: add generic approve/reject HTTP endpoints for approval requests"
```

---

## Task 9: `PersetujuanController` — generic "Kotak Persetujuan" inbox

**Files:**
- Create: `app/Http/Controllers/PersetujuanController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/PersetujuanControllerTest.php`

**Interfaces:**
- Consumes: `ApprovalWorkflowService::canAct()` (Task 3), `BeritaAcaraPenerimaan::approvalTitle()`/`::approvalShowUrl()` (Task 4) — any future approvable model plugs in by implementing the same two methods.
- Produces: route `persetujuan.index`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/PersetujuanControllerTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

it('lists only requests the current user can act on right now', function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $admin = userWithRole('admin_kecamatan', $kec);
    $kasubag = userWithRole('kasubag');
    $camat = userWithRole('camat', $kec);
    $category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/060/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/060', 'unit_id' => $kec->id,
        'created_by' => $admin->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $admin);

    $this->actingAs($kasubag)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page
            ->has('items', 1)
            ->where('items.0.title', 'Penerimaan Aset #BA/060/IX/2025')
        );

    $this->actingAs($camat)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page->has('items', 0));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/PersetujuanControllerTest.php`
Expected: FAIL — route/controller don't exist yet.

- [ ] **Step 3: Create the controller**

`app/Http/Controllers/PersetujuanController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PersetujuanController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $pending = ApprovalRequest::query()
            ->with(['definition', 'approvable', 'creator'])
            ->where('status', ApprovalStatus::Pending)
            ->get()
            ->filter(fn (ApprovalRequest $r) => $this->workflow->canAct($user, $r))
            ->values();

        return Inertia::render('Persetujuan/Index', [
            'items' => $pending->map(fn (ApprovalRequest $r) => [
                'id' => $r->id,
                'workflow_name' => $r->definition->name,
                'title' => $r->approvable->approvalTitle(),
                'submitted_by' => $r->creator->name,
                'current_step' => $r->current_step,
                'created_at' => $r->created_at->format('d M Y'),
                'show_url' => $r->approvable->approvalShowUrl(),
            ])->values(),
        ]);
    }
}
```

- [ ] **Step 4: Add the route**

In `routes/web.php`, add inside the `Route::middleware('auth')->group(...)` block:

```php
    Route::get('/persetujuan', [PersetujuanController::class, 'index'])->name('persetujuan.index');
```

Add the import at the top of the file: `use App\Http\Controllers\PersetujuanController;`

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test tests/Feature/PersetujuanControllerTest.php`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/PersetujuanController.php routes/web.php tests/Feature/PersetujuanControllerTest.php
git commit -m "feat: add generic Kotak Persetujuan inbox endpoint"
```

---

## Task 10: Frontend types and `Penerimaan/Create.tsx`

**Files:**
- Modify: `resources/js/types/index.d.ts`
- Create: `resources/js/Pages/Penerimaan/Create.tsx`

**Interfaces:**
- Produces: TypeScript types `BeritaAcaraPenerimaan`, `BeritaAcaraItem`, `ApprovalRequestSummary`, `ApprovalAction`, `ApprovalStep`, `NotificationItem`, and an updated `PageProps.notifications` shape, all consumed by Tasks 11-13.

- [ ] **Step 1: Add the new types**

In `resources/js/types/index.d.ts`, add these interfaces after the existing `Paginated<T>` interface:

```typescript
export interface BeritaAcaraItem {
    id: number;
    nama_aset: string;
    merk_type: string | null;
    category_id: number;
    jumlah_unit: number;
    nilai_per_unit: string;
    kondisi_awal: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    category?: { id: number; name: string };
}

export interface ApprovalActionEntry {
    id: number;
    step_order: number;
    action: 'approve' | 'reject';
    note: string | null;
    created_at: string;
    user?: { id: number; name: string };
}

export interface ApprovalStep {
    step_order: number;
    approver_role: string;
}

export interface ApprovalRequestSummary {
    id: number;
    current_step: number;
    status: 'pending' | 'approved' | 'rejected';
    definition?: { name: string; steps?: ApprovalStep[] };
    actions?: ApprovalActionEntry[];
}

export interface BeritaAcaraPenerimaan {
    id: number;
    no_berita_acara: string;
    tanggal_penerimaan: string;
    sumber_perolehan: string | null;
    no_kontrak_spk: string;
    vendor: string | null;
    catatan: string | null;
    status: 'draft' | 'submitted';
    unit?: { id: number; name: string };
    creator?: { id: number; name: string };
    items?: BeritaAcaraItem[];
    approval_request?: ApprovalRequestSummary | null;
}

export interface NotificationItem {
    id: string;
    message: string;
    created_at: string;
}
```

Then update the existing `PageProps` type at the bottom of the file to add `notifications`:

```typescript
export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: AuthUser | null;
    };
    flash: Flash;
    notifications: {
        unread_count: number;
        items: NotificationItem[];
    };
};
```

- [ ] **Step 2: Create `Penerimaan/Create.tsx`**

`resources/js/Pages/Penerimaan/Create.tsx`:

```tsx
import { ChevronRightIcon as ChevronRight, PlusIcon as Plus, TrashIcon as Trash, UploadIcon as Upload } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    categories: AssetCategory[];
    kondisiOptions: { value: string; label: string }[];
}

interface ItemForm {
    nama_aset: string;
    merk_type: string;
    category_id: string;
    jumlah_unit: string;
    nilai_per_unit: string;
    kondisi_awal: string;
}

const EMPTY_ITEM: ItemForm = {
    nama_aset: '',
    merk_type: '',
    category_id: '',
    jumlah_unit: '1',
    nilai_per_unit: '',
    kondisi_awal: 'baik',
};

export default function Create({ categories, kondisiOptions }: CreateProps) {
    const form = useForm({
        no_berita_acara: '',
        tanggal_penerimaan: '',
        sumber_perolehan: '',
        no_kontrak_spk: '',
        vendor: '',
        catatan: '',
        status: 'draft' as 'draft' | 'submitted',
        items: [EMPTY_ITEM] as ItemForm[],
        dokumen: [] as File[],
    });

    const updateItem = (index: number, field: keyof ItemForm, value: string) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], [field]: value };
        form.setData('items', items);
    };

    const addItem = () => form.setData('items', [...form.data.items, EMPTY_ITEM]);

    const removeItem = (index: number) => form.setData('items', form.data.items.filter((_, i) => i !== index));

    const itemError = (index: number, field: keyof ItemForm): string | undefined =>
        (form.errors as Record<string, string>)[`items.${index}.${field}`];

    const submit = (status: 'draft' | 'submitted') => (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, status }));
        form.post(route('penerimaan-aset.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Formulir Penerimaan Aset Baru" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('penerimaan-aset.index')} className="hover:text-blue-700">Penerimaan Aset</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Ajukan Penerimaan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Formulir Penerimaan Aset Baru</h1>
                </div>

                <form className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 1: Informasi Berita Acara</h2>
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">No. Berita Acara *</label>
                                <input
                                    type="text"
                                    value={form.data.no_berita_acara}
                                    onChange={(e) => form.setData('no_berita_acara', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    placeholder="BA/xxx/xxx/2025"
                                />
                                {form.errors.no_berita_acara && <p className="mt-1 text-xs text-red-600">{form.errors.no_berita_acara}</p>}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Tanggal Penerimaan *</label>
                                <input
                                    type="date"
                                    value={form.data.tanggal_penerimaan}
                                    onChange={(e) => form.setData('tanggal_penerimaan', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.tanggal_penerimaan && <p className="mt-1 text-xs text-red-600">{form.errors.tanggal_penerimaan}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Sumber Perolehan</label>
                                <input
                                    type="text"
                                    value={form.data.sumber_perolehan}
                                    onChange={(e) => form.setData('sumber_perolehan', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    placeholder="mis. APBD, Hibah"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">No. Kontrak/SPK *</label>
                                <input
                                    type="text"
                                    value={form.data.no_kontrak_spk}
                                    onChange={(e) => form.setData('no_kontrak_spk', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.no_kontrak_spk && <p className="mt-1 text-xs text-red-600">{form.errors.no_kontrak_spk}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Vendor/Penyedia</label>
                            <input
                                type="text"
                                value={form.data.vendor}
                                onChange={(e) => form.setData('vendor', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </section>

                    <hr className="border-slate-200" />

                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 2: Data Aset yang Diterima</h2>
                        {form.data.items.map((item, index) => (
                            <div key={index} className="space-y-4 rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-blue-700">Aset #{index + 1}</p>
                                    {form.data.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600">
                                            <Trash className="h-3.5 w-3.5" /> Hapus
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Nama Barang *</label>
                                        <input
                                            type="text"
                                            value={item.nama_aset}
                                            onChange={(e) => updateItem(index, 'nama_aset', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'nama_aset') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'nama_aset')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Merk/Tipe</label>
                                        <input
                                            type="text"
                                            value={item.merk_type}
                                            onChange={(e) => updateItem(index, 'merk_type', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Subkategori *</label>
                                        <select
                                            value={item.category_id}
                                            onChange={(e) => updateItem(index, 'category_id', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        >
                                            <option value="">Pilih subkategori...</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        {itemError(index, 'category_id') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'category_id')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Kondisi Awal *</label>
                                        <select
                                            value={item.kondisi_awal}
                                            onChange={(e) => updateItem(index, 'kondisi_awal', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        >
                                            {kondisiOptions.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Jumlah Unit *</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={item.jumlah_unit}
                                            onChange={(e) => updateItem(index, 'jumlah_unit', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'jumlah_unit') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'jumlah_unit')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Nilai per Unit (Rp) *</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={item.nilai_per_unit}
                                            onChange={(e) => updateItem(index, 'nilai_per_unit', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'nilai_per_unit') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'nilai_per_unit')}</p>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                            <Plus className="h-3.5 w-3.5" /> Tambah Barang Lain
                        </button>
                    </section>

                    <hr className="border-slate-200" />

                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 3: Dokumen Pendukung</h2>
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
                            <Upload className="h-6 w-6 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah dokumen Berita Acara (PDF/JPG)</span>
                            <span className="text-xs text-slate-500">Maks. 5MB per file</span>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => form.setData('dokumen', Array.from(e.target.files ?? []))}
                            />
                        </label>
                        {form.data.dokumen.length > 0 && (
                            <ul className="space-y-1 text-xs text-slate-600">
                                {form.data.dokumen.map((file, i) => <li key={i}>{file.name}</li>)}
                            </ul>
                        )}

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Catatan / Keterangan</label>
                            <textarea
                                value={form.data.catatan}
                                onChange={(e) => form.setData('catatan', e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </section>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={submit('draft')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Simpan Draft
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={submit('submitted')}
                            className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                            Ajukan Penerimaan
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add resources/js/types/index.d.ts resources/js/Pages/Penerimaan/Create.tsx
git commit -m "feat: add Penerimaan Aset create form with repeatable items"
```

---

## Task 11: `Penerimaan/Index.tsx` — list page

**Files:**
- Create: `resources/js/lib/pagination.ts`
- Modify: `resources/js/Pages/Assets/Index.tsx`
- Create: `resources/js/Pages/Penerimaan/Index.tsx`

**Interfaces:**
- Consumes: `BeritaAcaraPenerimaan`, `Paginated<T>` types (Task 10 / existing).
- Produces: shared `pageNumbersWithGaps(current: number, last: number): (number | '...')[]` in `resources/js/lib/pagination.ts`, extracted out of `Assets/Index.tsx` so both list pages use the same pagination UI logic instead of duplicating it.

- [ ] **Step 1: Extract the shared pagination helper**

Create `resources/js/lib/pagination.ts`:

```typescript
export function pageNumbersWithGaps(current: number, last: number): (number | '...')[] {
    if (last <= 7) {
        return Array.from({ length: last }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, 2, last - 1, last, current - 1, current, current + 1]);
    const sorted = Array.from(pages)
        .filter((p) => p >= 1 && p <= last)
        .sort((a, b) => a - b);

    const result: (number | '...')[] = [];
    sorted.forEach((page, idx) => {
        if (idx > 0 && page - (sorted[idx - 1] as number) > 1) {
            result.push('...');
        }
        result.push(page);
    });

    return result;
}
```

In `resources/js/Pages/Assets/Index.tsx`, remove the local `pageNumbersWithGaps` function definition (currently near the top of the file, right after `registerLabel`) and replace it with an import:

```typescript
import { pageNumbersWithGaps } from '@/lib/pagination';
```

- [ ] **Step 2: Run the full suite to confirm the extraction didn't break anything**

Run: `php artisan test tests/Feature/AssetBrowseTest.php` (Inertia component tests for Assets/Index aren't affected by a pure frontend refactor, but confirm the backend route it renders still works)
Expected: PASS

Run: `npx tsc --noEmit`
Expected: no errors (confirms `Assets/Index.tsx` still compiles against the extracted import)

- [ ] **Step 3: Create `Penerimaan/Index.tsx`**

`resources/js/Pages/Penerimaan/Index.tsx`:

```tsx
import { ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight, EyeIcon as Eye, PlusIcon as Plus, SearchIcon as Search } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { BeritaAcaraPenerimaan, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<BeritaAcaraPenerimaan>;
    filters: { search?: string };
    can: { create: boolean };
}

const STATUS_STYLE: Record<string, string> = {
    diajukan: 'bg-blue-50 text-blue-700',
    diverifikasi: 'bg-amber-50 text-amber-700',
    disetujui: 'bg-emerald-50 text-emerald-700',
    ditolak: 'bg-red-50 text-red-700',
};

function statusLabel(ba: BeritaAcaraPenerimaan): { key: string; label: string } {
    const req = ba.approval_request;
    if (!req) return { key: 'diajukan', label: 'Draft' };
    if (req.status === 'approved') return { key: 'disetujui', label: 'Disetujui' };
    if (req.status === 'rejected') return { key: 'ditolak', label: 'Ditolak' };
    return req.current_step >= 2 ? { key: 'diverifikasi', label: 'Diverifikasi' } : { key: 'diajukan', label: 'Diajukan' };
}

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function Index({ items, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(items.current_page, items.last_page);

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(route('penerimaan-aset.index'), { search: search || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Penerimaan Aset" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Penerimaan Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Penerimaan Aset Baru</h1>
                    </div>
                    {can.create && (
                        <Link href={route('penerimaan-aset.create')} className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                            <Plus className="h-4 w-4" /> Ajukan Penerimaan
                        </Link>
                    )}
                </div>

                <form onSubmit={submitSearch} className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari no. berita acara atau nama aset..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </form>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">No. Berita Acara</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nama Aset</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pengaju</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.data.length === 0 ? (
                                <tr><td colSpan={6} className="py-14 text-center text-sm text-slate-400">Belum ada pengajuan penerimaan aset.</td></tr>
                            ) : (
                                items.data.map((ba) => {
                                    const status = statusLabel(ba);
                                    const extra = (ba.items?.length ?? 0) - 1;
                                    return (
                                        <tr key={ba.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 text-sm text-slate-800">{ba.no_berita_acara}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                {ba.items?.[0]?.nama_aset}
                                                {extra > 0 && <span className="font-normal text-slate-400"> +{extra} lainnya</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{ba.creator?.name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{new Date(ba.tanggal_penerimaan).toLocaleDateString('id-ID')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status.key]}`}>{status.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Link href={route('penerimaan-aset.show', ba.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800">{items.from ?? 0}-{items.to ?? 0}</span> dari <span className="font-semibold text-slate-800">{items.total}</span> penerimaan
                        </p>

                        {items.last_page > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={items.current_page <= 1}
                                    onClick={() => router.get(route('penerimaan-aset.index'), { search: filters.search, page: items.current_page - 1 }, { preserveState: true, preserveScroll: true })}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" /> <span>Sebelumnya</span>
                                </button>
                                <div className="flex items-center gap-1">
                                    {pages.map((page, idx) =>
                                        page === '...' ? (
                                            <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                        ) : (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() => router.get(route('penerimaan-aset.index'), { search: filters.search, page }, { preserveState: true, preserveScroll: true })}
                                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${page === items.current_page ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                            >
                                                {page}
                                            </button>
                                        ),
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled={items.current_page >= items.last_page}
                                    onClick={() => router.get(route('penerimaan-aset.index'), { search: filters.search, page: items.current_page + 1 }, { preserveState: true, preserveScroll: true })}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <span>Berikutnya</span> <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Manual verification**

Start the dev server (`php artisan serve --port=8123` if not already running), log in as an `admin_kecamatan` user, navigate to `/penerimaan-aset`, and confirm the empty state and (after Task 7's controller is live) a submitted Berita Acara render with the correct status badge.

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/pagination.ts resources/js/Pages/Assets/Index.tsx resources/js/Pages/Penerimaan/Index.tsx
git commit -m "feat: add Penerimaan Aset list page and extract shared pagination helper"
```

---

## Task 12: `Penerimaan/Show.tsx` — detail page with approval tracker

**Files:**
- Create: `resources/js/Pages/Penerimaan/Show.tsx`

**Interfaces:**
- Consumes: `BeritaAcaraPenerimaan`, `ApprovalStep`, `ApprovalActionEntry` types (Task 10); routes `approval-requests.approve`/`approval-requests.reject` (Task 8).

- [ ] **Step 1: Create `Penerimaan/Show.tsx`**

`resources/js/Pages/Penerimaan/Show.tsx`:

```tsx
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BeritaAcaraPenerimaan, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean };
}

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

function stepLabel(role: string): string {
    return role === 'kasubag' ? 'Verifikasi Kasubag' : 'Persetujuan Camat';
}

export default function Show({ beritaAcara, can }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [note, setNote] = useState('');
    const req = beritaAcara.approval_request;
    const steps = req?.definition?.steps ?? [];
    const total = (beritaAcara.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);

    const approve = () => {
        if (!req) return;
        router.post(route('approval-requests.approve', req.id));
    };

    const reject = () => {
        if (!req) return;
        router.post(route('approval-requests.reject', req.id), { note }, { onSuccess: () => setShowReject(false) });
    };

    const stepState = (order: number): 'done' | 'current' | 'upcoming' => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) return 'current';
        return 'upcoming';
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`} />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('penerimaan-aset.index')} className="hover:text-blue-700">Penerimaan Aset</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Penerimaan Aset #{beritaAcara.no_berita_acara}
                        </h1>
                    </div>
                    {can.act && (
                        <div className="flex gap-3">
                            <button onClick={() => setShowReject(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Tolak
                            </button>
                            <button onClick={approve} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                                Setujui
                            </button>
                        </div>
                    )}
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
                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${state === 'done' ? 'bg-emerald-100' : state === 'current' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                {state === 'done' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">Step {step.step_order}: {stepLabel(step.approver_role)}</p>
                                            <p className="text-[11px] text-slate-500">
                                                {state === 'done' ? 'Selesai' : state === 'current' ? 'Menunggu' : 'Belum dimulai'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Penerimaan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {([
                                ['No. Berita Acara', beritaAcara.no_berita_acara],
                                ['Tanggal Pengajuan', new Date(beritaAcara.tanggal_penerimaan).toLocaleDateString('id-ID')],
                                ['Sumber Perolehan', beritaAcara.sumber_perolehan ?? '—'],
                                ['No. Kontrak/SPK', beritaAcara.no_kontrak_spk],
                                ['Vendor/Penyedia', beritaAcara.vendor ?? '—'],
                                ['Total Nilai', formatRupiah(total)],
                            ] as [string, string][]).map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Rincian Barang Diterima</p>
                        <div className="space-y-3">
                            {beritaAcara.items?.map((item) => (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{item.nama_aset}</p>
                                            <p className="text-xs text-slate-500">{item.merk_type}</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-semibold text-slate-900">{formatRupiah(item.nilai_per_unit)} / unit</p>
                                            <p className="text-xs text-slate-500">{item.jumlah_unit} unit</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Pengajuan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {beritaAcara.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${action.action === 'approve' ? 'bg-emerald-600' : 'bg-red-600'}`} />
                                    <p className="text-sm font-semibold text-slate-900">
                                        {action.action === 'approve' ? 'Disetujui' : 'Ditolak'} oleh {action.user?.name}
                                    </p>
                                    {action.note && <p className="text-xs text-slate-500">{action.note}</p>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReject(false)}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">Tolak Pengajuan</h3>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Alasan penolakan (wajib diisi)"
                            className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={reject} disabled={!note.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Ya, Tolak</button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Manual verification**

Log in as `kasubag`, open a submitted Berita Acara's detail page, confirm the "Setujui"/"Tolak" buttons appear and the tracker shows step 1 as current. Click "Setujui", confirm the page reloads with step 2 current. Log in as `camat` for the same kecamatan, approve again, confirm the tracker shows both steps done and the linked Asset(s) now exist on `/assets`.

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Penerimaan/Show.tsx
git commit -m "feat: add Penerimaan Aset detail page with approval tracker"
```

---

## Task 13: `Persetujuan/Index.tsx`, nav enablement, and a real notification bell

**Files:**
- Create: `resources/js/Pages/Persetujuan/Index.tsx`
- Modify: `resources/js/config/navigation.ts`
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx`

**Interfaces:**
- Consumes: route `persetujuan.index` (Task 9), shared prop `notifications` (Task 6), route `notifications.read` (Task 6).

- [ ] **Step 1: Create `Persetujuan/Index.tsx`**

`resources/js/Pages/Persetujuan/Index.tsx`:

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface PersetujuanItem {
    id: number;
    workflow_name: string;
    title: string;
    submitted_by: string;
    current_step: number;
    created_at: string;
    show_url: string;
}

interface IndexProps extends PageProps {
    items: PersetujuanItem[];
}

export default function Index({ items }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Kotak Persetujuan" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Kotak Persetujuan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Kotak Persetujuan</h1>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {items.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">Tidak ada pengajuan yang menunggu persetujuan Anda.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <li key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.workflow_name}</p>
                                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">Diajukan oleh {item.submitted_by} · {item.created_at}</p>
                                    </div>
                                    <Link href={item.show_url} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Tinjau
                                    </Link>
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

- [ ] **Step 2: Enable the nav items**

In `resources/js/config/navigation.ts`, find the `TRANSAKSI` group's `items` array and replace these two entries:

```typescript
            {
                label: 'Penerimaan Aset',
                href: '#',
                icon: 'download',
                disabled: true,
            },
```

with:

```typescript
            {
                label: 'Penerimaan Aset',
                href: '/penerimaan-aset',
                icon: 'download',
            },
```

and:

```typescript
            {
                label: 'Kotak Persetujuan',
                href: '#',
                icon: 'check-square',
                badge: 3,
                disabled: true,
            },
```

with:

```typescript
            {
                label: 'Kotak Persetujuan',
                href: '/persetujuan',
                icon: 'check-square',
            },
```

- [ ] **Step 3: Wire the real unread count into the sidebar badge**

In `resources/js/Layouts/AuthenticatedLayout.tsx`, change the destructure on the line `const { auth, flash } = usePage<PageProps>().props;` to also pull `notifications`:

```typescript
    const { auth, flash, notifications } = usePage<PageProps>().props;
```

Right after `const navGroups = navGroupsForRole(role);`, add a small helper that overrides the static config badge with the real pending count for the Kotak Persetujuan item only:

```typescript
    const badgeFor = (item: { href: string; badge?: string | number }) =>
        item.href === '/persetujuan' ? notifications.unread_count || undefined : item.badge;
```

Then replace both occurrences of:

```tsx
                                            {item.badge !== undefined && (
```

with:

```tsx
                                            {badgeFor(item) !== undefined && (
```

and both occurrences of `{item.badge}` (inside those same blocks) with `{badgeFor(item)}`.

- [ ] **Step 4: Replace the hardcoded bell dropdown with real data**

In `resources/js/Layouts/AuthenticatedLayout.tsx`, find the `{/* Notification Bell */}` block (the `<span>...5</span>` badge and the `isNotifOpen &&` dropdown with the two hardcoded demo items). Replace the whole block with:

```tsx
                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                type="button"
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
                                aria-label="Notifikasi"
                            >
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                </svg>
                                {notifications.unread_count > 0 && (
                                    <span className="shadow-xs absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {notifications.unread_count}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-100 bg-white p-3 shadow-lg">
                                    <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                                            Notifikasi
                                        </h3>
                                        {notifications.unread_count > 0 && (
                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                                {notifications.unread_count} Baru
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-xs text-gray-600">
                                        {notifications.items.length === 0 ? (
                                            <p className="p-2 text-center text-gray-400">Tidak ada notifikasi baru.</p>
                                        ) : (
                                            notifications.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => router.post(route('notifications.read', item.id))}
                                                    className="block w-full rounded p-2 text-left hover:bg-gray-50"
                                                >
                                                    <p className="font-medium text-gray-800">{item.message}</p>
                                                    <p className="mt-0.5 text-[11px] text-gray-500">{item.created_at}</p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 6: Run the full backend suite one more time**

Run: `php artisan test`
Expected: all green

- [ ] **Step 7: Manual verification**

Log in as `kasubag`, confirm the sidebar "Kotak Persetujuan" badge shows the real pending count (not a static "3"), the bell dropdown lists the real "Menunggu persetujuan Anda: Penerimaan Aset" notification, clicking it marks it read and the badge count drops, and `/persetujuan` lists the same pending item with a working "Tinjau" link to the Berita Acara detail page.

- [ ] **Step 8: Commit**

```bash
git add resources/js/Pages/Persetujuan/Index.tsx resources/js/config/navigation.ts resources/js/Layouts/AuthenticatedLayout.tsx
git commit -m "feat: add Kotak Persetujuan page and wire the real notification bell"
```
