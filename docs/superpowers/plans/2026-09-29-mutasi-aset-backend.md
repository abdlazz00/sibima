# Asset Mutation Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi backend untuk Modul Mutasi Aset yang menangani 4 alur mutasi (Kecamatan ke Kelurahan, Antar Kelurahan, Retur ke Kecamatan, dan Mutasi Internal), terintegrasi penuh dengan Generic Approval Workflow Engine, penguncian status aset, eksekusi efek transaksi, dan pencatatan audit trail histori.

**Architecture:** Pendekatan Clean Architecture dengan model transaksi terpadu (`asset_mutations` dan `asset_mutation_items`) yang mengimplementasikan interface `HasWorkflowUnits`. Mengekstensi `ApprovalWorkflowService` untuk mendukung scope `UnitScope::Origin` dan `UnitScope::Destination`. Menggunakan event-driven effect handler `AssetMutationEffect` pada step final untuk pemindahan unit & pemegang aset, pembukaan kunci status aset (`AssetStatus::Aktif`), dan pencatatan ke `asset_histories`.

**Tech Stack:** PHP 8.2+, Laravel 11, MySQL, Spatie Laravel Permission, Pest PHP Testing Framework.

**Spec:** `docs/superpowers/specs/2026-09-29-mutasi-aset-backend-design.md`

## Global Constraints
- Ikuti standar PSR-12 / Laravel Pint yang sudah berlaku di repo.
- Terapkan Strict TDD di setiap task: Red (failing test) -> Green (minimal pass) -> Refactor/Commit.
- Pertahankan 206 automated tests yang sudah passing saat ini agar tidak mengalami regresi.
- Model transaksi wajib terintegrasi dengan `ApprovalRequest` polymorphic.

---

### Task 1: Enums & Contract (`MutationType`, `MutationStatus`, `HasWorkflowUnits`)

**Files:**
- Create: `app/Enums/MutationType.php`
- Create: `app/Enums/MutationStatus.php`
- Create: `app/Contracts/HasWorkflowUnits.php`
- Test: `tests/Unit/Enums/MutationEnumsTest.php`

**Interfaces:**
- Consumes: None
- Produces:
  - `App\Enums\MutationType` (`KecKeKel`, `AntarKel`, `ReturKelKeKec`, `Internal`) with method `label(): string`
  - `App\Enums\MutationStatus` (`Pending`, `Approved`, `Rejected`) with method `label(): string`
  - `App\Contracts\HasWorkflowUnits` with methods `getOriginUnit(): App\Models\Unit` and `getDestinationUnit(): App\Models\Unit`

- [ ] **Step 1: Write failing test for Enums and Contract**

```php
<?php

use App\Contracts\HasWorkflowUnits;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Unit;

it('has expected cases and labels for MutationType', function () {
    expect(MutationType::KecKeKel->value)->toBe('kec_ke_kel')
        ->and(MutationType::AntarKel->value)->toBe('antar_kel')
        ->and(MutationType::ReturKelKeKec->value)->toBe('retur_kel_ke_kec')
        ->and(MutationType::Internal->value)->toBe('internal')
        ->and(MutationType::KecKeKel->label())->toBe('Mutasi Kecamatan ke Kelurahan')
        ->and(MutationType::AntarKel->label())->toBe('Mutasi Antar Kelurahan')
        ->and(MutationType::ReturKelKeKec->label())->toBe('Retur Kelurahan ke Kecamatan')
        ->and(MutationType::Internal->label())->toBe('Mutasi Internal');
});

it('has expected cases and labels for MutationStatus', function () {
    expect(MutationStatus::Pending->value)->toBe('pending')
        ->and(MutationStatus::Approved->value)->toBe('approved')
        ->and(MutationStatus::Rejected->value)->toBe('rejected')
        ->and(MutationStatus::Pending->label())->toBe('Menunggu Persetujuan')
        ->and(MutationStatus::Approved->label())->toBe('Disetujui')
        ->and(MutationStatus::Rejected->label())->toBe('Ditolak');
});

it('verifies HasWorkflowUnits contract interface methods', function () {
    $instance = new class implements HasWorkflowUnits {
        public function getOriginUnit(): Unit { return new Unit(); }
        public function getDestinationUnit(): Unit { return new Unit(); }
    };

    expect($instance)->toBeInstanceOf(HasWorkflowUnits::class)
        ->and($instance->getOriginUnit())->toBeInstanceOf(Unit::class)
        ->and($instance->getDestinationUnit())->toBeInstanceOf(Unit::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Unit/Enums/MutationEnumsTest.php`
Expected: FAIL (Classes not found)

- [ ] **Step 3: Implement MutationType, MutationStatus, and HasWorkflowUnits**

Create `app/Enums/MutationType.php`:
```php
<?php

namespace App\Enums;

enum MutationType: string
{
    case KecKeKel = 'kec_ke_kel';
    case AntarKel = 'antar_kel';
    case ReturKelKeKec = 'retur_kel_ke_kec';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::KecKeKel => 'Mutasi Kecamatan ke Kelurahan',
            self::AntarKel => 'Mutasi Antar Kelurahan',
            self::ReturKelKeKec => 'Retur Kelurahan ke Kecamatan',
            self::Internal => 'Mutasi Internal',
        };
    }
}
```

Create `app/Enums/MutationStatus.php`:
```php
<?php

namespace App\Enums;

enum MutationStatus: string
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

Create `app/Contracts/HasWorkflowUnits.php`:
```php
<?php

namespace App\Contracts;

use App\Models\Unit;

interface HasWorkflowUnits
{
    public function getOriginUnit(): Unit;

    public function getDestinationUnit(): Unit;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Unit/Enums/MutationEnumsTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Enums/MutationType.php app/Enums/MutationStatus.php app/Contracts/HasWorkflowUnits.php tests/Unit/Enums/MutationEnumsTest.php
git commit -m "feat(mutations): add mutation enums and workflow units contract"
```

---

### Task 2: Database Migrations (`asset_mutations` & `asset_mutation_items`)

**Files:**
- Create: `database/migrations/2026_09_29_000001_create_asset_mutations_table.php`
- Create: `database/migrations/2026_09_29_000002_create_asset_mutation_items_table.php`
- Test: `tests/Feature/Migrations/AssetMutationMigrationsTest.php`

**Interfaces:**
- Consumes: `units`, `users`, `assets`, `pegawais` tables
- Produces: Tables `asset_mutations` and `asset_mutation_items`

- [ ] **Step 1: Write failing test for migrations**

```php
<?php

use Illuminate\Support\Facades\Schema;

it('creates asset_mutations and asset_mutation_items tables with required columns', function () {
    expect(Schema::hasTable('asset_mutations'))->toBeTrue()
        ->and(Schema::hasColumns('asset_mutations', [
            'id', 'nomor_mutasi', 'jenis_mutasi', 'origin_unit_id', 'destination_unit_id',
            'tanggal_mutasi', 'keterangan', 'status', 'created_by', 'created_at', 'updated_at',
        ]))->toBeTrue()
        ->and(Schema::hasTable('asset_mutation_items'))->toBeTrue()
        ->and(Schema::hasColumns('asset_mutation_items', [
            'id', 'asset_mutation_id', 'asset_id', 'target_holder_id', 'catatan',
            'created_at', 'updated_at',
        ]))->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Migrations/AssetMutationMigrationsTest.php`
Expected: FAIL (Tables do not exist)

- [ ] **Step 3: Create migrations**

Create `database/migrations/2026_09_29_000001_create_asset_mutations_table.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_mutations', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_mutasi', 50)->unique();
            $table->string('jenis_mutasi', 30);
            $table->foreignId('origin_unit_id')->constrained('units');
            $table->foreignId('destination_unit_id')->constrained('units');
            $table->date('tanggal_mutasi');
            $table->text('keterangan')->nullable();
            $table->string('status', 20)->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_mutations');
    }
};
```

Create `database/migrations/2026_09_29_000002_create_asset_mutation_items_table.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_mutation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_mutation_id')->constrained('asset_mutations')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('target_holder_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->string('catatan', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_mutation_items');
    }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Migrations/AssetMutationMigrationsTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_09_29_000001_create_asset_mutations_table.php database/migrations/2026_09_29_000002_create_asset_mutation_items_table.php tests/Feature/Migrations/AssetMutationMigrationsTest.php
git commit -m "feat(mutations): add migrations for asset_mutations and asset_mutation_items"
```

---

### Task 3: Eloquent Models & Relationships (`AssetMutation`, `AssetMutationItem`)

**Files:**
- Create: `app/Models/AssetMutation.php`
- Create: `app/Models/AssetMutationItem.php`
- Modify: `app/Models/Asset.php` (tambahkan relasi `mutations()`)
- Test: `tests/Unit/Models/AssetMutationModelTest.php`

**Interfaces:**
- Consumes: Task 1 (Enums & Contract), Task 2 (DB Tables)
- Produces: `AssetMutation` & `AssetMutationItem` models with casts and relations

- [ ] **Step 1: Write failing test for models and relationships**

```php
<?php

use App\Contracts\HasWorkflowUnits;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;

it('creates AssetMutation with cast attributes and relationships', function () {
    $origin = makeKecamatan();
    $destination = makeKelurahan($origin, 'Kelurahan Sungai Binti');
    $user = userWithRole('admin_kecamatan', $origin);
    $pegawai = Pegawai::factory()->create(['unit_id' => $destination->id]);

    $category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop Dell Latitude',
        'category_id' => $category->id,
        'unit_id' => $origin->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 15000000,
        'nilai_buku' => 15000000,
    ]);

    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/001',
        'jenis_mutasi' => MutationType::KecKeKel,
        'origin_unit_id' => $origin->id,
        'destination_unit_id' => $destination->id,
        'tanggal_mutasi' => '2026-09-29',
        'keterangan' => 'Pengalihan aset operasional',
        'status' => MutationStatus::Pending,
        'created_by' => $user->id,
    ]);

    $item = $mutation->items()->create([
        'asset_id' => $asset->id,
        'target_holder_id' => $pegawai->id,
        'catatan' => 'Kondisi baik lengkap charger',
    ]);

    expect($mutation)->toBeInstanceOf(HasWorkflowUnits::class)
        ->and($mutation->jenis_mutasi)->toBe(MutationType::KecKeKel)
        ->and($mutation->status)->toBe(MutationStatus::Pending)
        ->and($mutation->getOriginUnit()->id)->toBe($origin->id)
        ->and($mutation->getDestinationUnit()->id)->toBe($destination->id)
        ->and($mutation->items)->toHaveCount(1)
        ->and($mutation->creator->id)->toBe($user->id)
        ->and($mutation->approvalTitle())->toBe('Mutasi Aset #MUT/2026/001')
        ->and($item->asset->id)->toBe($asset->id)
        ->and($item->targetHolder->id)->toBe($pegawai->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Unit/Models/AssetMutationModelTest.php`
Expected: FAIL (AssetMutation model not found)

- [ ] **Step 3: Implement AssetMutation and AssetMutationItem models**

Create `app/Models/AssetMutation.php`:
```php
<?php

namespace App\Models;

use App\Contracts\HasWorkflowUnits;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetMutation extends Model implements HasWorkflowUnits
{
    use HasFactory;

    protected $fillable = [
        'nomor_mutasi',
        'jenis_mutasi',
        'origin_unit_id',
        'destination_unit_id',
        'tanggal_mutasi',
        'keterangan',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'jenis_mutasi' => MutationType::class,
            'status' => MutationStatus::class,
            'tanggal_mutasi' => 'date:Y-m-d',
            'origin_unit_id' => 'integer',
            'destination_unit_id' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function originUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'origin_unit_id');
    }

    public function destinationUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'destination_unit_id');
    }

    public function getOriginUnit(): Unit
    {
        return $this->originUnit;
    }

    public function getDestinationUnit(): Unit
    {
        return $this->destinationUnit;
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetMutationItem::class);
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
        return "Mutasi Aset #{$this->nomor_mutasi}";
    }
}
```

Create `app/Models/AssetMutationItem.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMutationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'asset_mutation_id',
        'asset_id',
        'target_holder_id',
        'catatan',
    ];

    protected function casts(): array
    {
        return [
            'asset_mutation_id' => 'integer',
            'asset_id' => 'integer',
            'target_holder_id' => 'integer',
        ];
    }

    public function mutation(): BelongsTo
    {
        return $this->belongsTo(AssetMutation::class, 'asset_mutation_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function targetHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'target_holder_id');
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Unit/Models/AssetMutationModelTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Models/AssetMutation.php app/Models/AssetMutationItem.php tests/Unit/Models/AssetMutationModelTest.php
git commit -m "feat(mutations): add AssetMutation and AssetMutationItem models with relationships"
```

---

### Task 4: Workflow Seeder & Scope Resolution in `ApprovalWorkflowService`

**Files:**
- Modify: `database/seeders/WorkflowDefinitionSeeder.php`
- Modify: `app/Services/ApprovalWorkflowService.php`
- Test: `tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php`

**Interfaces:**
- Consumes: `HasWorkflowUnits` interface, `WorkflowStep`
- Produces: 5 mutation workflow definitions and fully functional `UnitScope::Origin` and `UnitScope::Destination` resolvers in `canAct()` and `approversFor()`

- [ ] **Step 1: Write failing test for UnitScope Origin & Destination in ApprovalWorkflowService**

```php
<?php

use App\Contracts\HasWorkflowUnits;
use App\Enums\ApprovalStatus;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\Unit;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('lurah');
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Sagulung Kota');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Sungai Lekop');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
    $this->lurahB = userWithRole('lurah', $this->kelB);

    $this->service = app(ApprovalWorkflowService::class);
});

it('seeds all 5 mutation workflow definitions correctly', function () {
    (new WorkflowDefinitionSeeder)->run();

    expect(WorkflowDefinition::where('code', 'mutasi_kec_ke_kel')->first()->steps)->toHaveCount(4)
        ->and(WorkflowDefinition::where('code', 'mutasi_antar_kel')->first()->steps)->toHaveCount(3)
        ->and(WorkflowDefinition::where('code', 'retur_kel_ke_kec')->first()->steps)->toHaveCount(4)
        ->and(WorkflowDefinition::where('code', 'mutasi_internal_kec')->first()->steps)->toHaveCount(1)
        ->and(WorkflowDefinition::where('code', 'mutasi_internal_kel')->first()->steps)->toHaveCount(1);
});

it('resolves canAct correctly for Origin and Destination scopes', function () {
    (new WorkflowDefinitionSeeder)->run();

    // Create a mock approvable with HasWorkflowUnits
    $approvable = new class($this->kelA, $this->kelB) extends \Illuminate\Database\Eloquent\Model implements HasWorkflowUnits {
        public $id = 1;
        public function __construct(private Unit $origin, private Unit $dest) { parent::__construct(); }
        public function getOriginUnit(): Unit { return $this->origin; }
        public function getDestinationUnit(): Unit { return $this->dest; }
    };

    $request = ApprovalRequest::create([
        'workflow_definition_id' => WorkflowDefinition::where('code', 'mutasi_antar_kel')->first()->id,
        'approvable_type' => $approvable->getMorphClass(),
        'approvable_id' => 1,
        'current_step' => 1, // Step 1: lurah origin
        'status' => ApprovalStatus::Pending,
        'created_by' => $this->lurahA->id,
    ]);
    $request->setRelation('approvable', $approvable);

    // Lurah asal can act, Lurah tujuan cannot act on step 1
    expect($this->service->canAct($this->lurahA, $request))->toBeTrue()
        ->and($this->service->canAct($this->lurahB, $request))->toBeFalse();

    // Move to step 2: admin_kelurahan destination
    $request->update(['current_step' => 2]);
    expect($this->service->canAct($this->adminKelB, $request))->toBeTrue()
        ->and($this->service->canAct($this->adminKec, $request))->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php`
Expected: FAIL (missing workflow definitions and canAct returning false for Origin/Destination)

- [ ] **Step 3: Update WorkflowDefinitionSeeder and ApprovalWorkflowService**

Modify `database/seeders/WorkflowDefinitionSeeder.php`:
```php
<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;

class WorkflowDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            'penerimaan_aset' => [
                'name' => 'Penerimaan Aset',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
                ],
            ],
            'mutasi_kec_ke_kel' => [
                'name' => 'Mutasi Kecamatan ke Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'origin'],
                    ['step_order' => 3, 'approver_role' => 'admin_kelurahan', 'unit_scope' => 'destination'],
                    ['step_order' => 4, 'approver_role' => 'lurah', 'unit_scope' => 'destination'],
                ],
            ],
            'mutasi_antar_kel' => [
                'name' => 'Mutasi Antar Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                    ['step_order' => 2, 'approver_role' => 'admin_kelurahan', 'unit_scope' => 'destination'],
                    ['step_order' => 3, 'approver_role' => 'lurah', 'unit_scope' => 'destination'],
                ],
            ],
            'retur_kel_ke_kec' => [
                'name' => 'Retur Kelurahan ke Kecamatan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                    ['step_order' => 2, 'approver_role' => 'admin_kecamatan', 'unit_scope' => 'destination'],
                    ['step_order' => 3, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
                    ['step_order' => 4, 'approver_role' => 'camat', 'unit_scope' => 'destination'],
                ],
            ],
            'mutasi_internal_kec' => [
                'name' => 'Mutasi Internal Kecamatan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'camat', 'unit_scope' => 'origin'],
                ],
            ],
            'mutasi_internal_kel' => [
                'name' => 'Mutasi Internal Kelurahan',
                'steps' => [
                    ['step_order' => 1, 'approver_role' => 'lurah', 'unit_scope' => 'origin'],
                ],
            ],
        ];

        foreach ($definitions as $code => $data) {
            $def = WorkflowDefinition::updateOrCreate(['code' => $code], ['name' => $data['name']]);
            foreach ($data['steps'] as $step) {
                $def->steps()->updateOrCreate(['step_order' => $step['step_order']], $step);
            }
        }
    }
}
```

Update `app/Services/ApprovalWorkflowService.php`:
In `canAct()`:
```php
        return match ($step->unit_scope) {
            UnitScope::None => true,
            UnitScope::Subject => $user->canAccessUnit($request->approvable->unit),
            UnitScope::Origin => $request->approvable instanceof \App\Contracts\HasWorkflowUnits
                && $user->canAccessUnit($request->approvable->getOriginUnit()),
            UnitScope::Destination => $request->approvable instanceof \App\Contracts\HasWorkflowUnits
                && $user->canAccessUnit($request->approvable->getDestinationUnit()),
        };
```
In `approversFor()`:
```php
        if ($step->unit_scope === UnitScope::Subject) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->unit))->values();
        }

        if ($step->unit_scope === UnitScope::Origin && $approvable instanceof \App\Contracts\HasWorkflowUnits) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getOriginUnit()))->values();
        }

        if ($step->unit_scope === UnitScope::Destination && $approvable instanceof \App\Contracts\HasWorkflowUnits) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getDestinationUnit()))->values();
        }

        return $users;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add database/seeders/WorkflowDefinitionSeeder.php app/Services/ApprovalWorkflowService.php tests/Feature/Services/ApprovalWorkflowServiceScopesTest.php
git commit -m "feat(workflow): seed 5 mutation workflows and implement origin/destination unit scopes"
```

---

### Task 5: Repository & Service Layer (`AssetMutationRepository`, `AssetMutationService`)

**Files:**
- Create: `app/Repositories/Contracts/AssetMutationRepositoryInterface.php`
- Create: `app/Repositories/AssetMutationRepository.php`
- Create: `app/Services/AssetMutationService.php`
- Modify: `app/Providers/AppServiceProvider.php` (bind repository interface)
- Test: `tests/Feature/Services/AssetMutationServiceTest.php`

**Interfaces:**
- Consumes: `AssetMutation`, `AssetMutationItem`, `Asset`, `ApprovalWorkflowService`
- Produces: `AssetMutationService::submit(array $data, array $items, User $creator): AssetMutation` with automatic status locking (`AssetStatus::DalamProses`) and automatic workflow code detection

- [ ] **Step 1: Write failing test for AssetMutationService**

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Services\AssetMutationService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sagulung Kota');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);

    $this->service = app(AssetMutationService::class);
});

it('submits mutation, locks assets to dalam_proses, and creates approval request', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Komputer PC All-in-One',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 12000000,
        'nilai_buku' => 12000000,
    ]);

    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $mutation = $this->service->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0001',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
            'keterangan' => 'Mutasi operasional',
        ],
        [
            [
                'asset_id' => $asset->id,
                'target_holder_id' => $pegawai->id,
                'catatan' => 'Siap pakai',
            ],
        ],
        $this->admin
    );

    expect($mutation->status)->toBe(MutationStatus::Pending)
        ->and($asset->fresh()->status)->toBe(AssetStatus::DalamProses)
        ->and($mutation->approvalRequest)->not->toBeNull()
        ->and($mutation->approvalRequest->definition->code)->toBe('mutasi_kec_ke_kel');
});

it('rejects submission if asset is not in origin unit or already dalam_proses', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.002',
        'nomor_register' => 2,
        'nama_aset' => 'Laptop Lenovo',
        'category_id' => $this->category->id,
        'unit_id' => $this->kel->id, // Not in kec
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    expect(fn () => $this->service->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0002',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id]],
        $this->admin
    ))->toThrow(InvalidArgumentException::class);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Services/AssetMutationServiceTest.php`
Expected: FAIL (Service class not found)

- [ ] **Step 3: Implement Repository and Service**

Create `app/Repositories/Contracts/AssetMutationRepositoryInterface.php`:
```php
<?php

namespace App\Repositories\Contracts;

use App\Models\AssetMutation;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

interface AssetMutationRepositoryInterface
{
    public function createWithItems(array $data, array $items): AssetMutation;

    public function findById(int $id): ?AssetMutation;

    public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator;
}
```

Create `app/Repositories/AssetMutationRepository.php`:
```php
<?php

namespace App\Repositories;

use App\Models\AssetMutation;
use App\Models\User;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AssetMutationRepository implements AssetMutationRepositoryInterface
{
    public function createWithItems(array $data, array $items): AssetMutation
    {
        return DB::transaction(function () use ($data, $items) {
            $mutation = AssetMutation::create($data);
            $mutation->items()->createMany($items);

            return $mutation;
        });
    }

    public function findById(int $id): ?AssetMutation
    {
        return AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items.asset', 'items.targetHolder', 'approvalRequest.actions.user', 'photos'])->find($id);
    }

    public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator
    {
        $query = AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items'])
            ->latest('tanggal_mutasi')
            ->latest('id');

        $accessibleUnitIds = $user->accessibleUnitIds();
        if ($accessibleUnitIds !== null) {
            $query->where(function ($q) use ($accessibleUnitIds) {
                $q->whereIn('origin_unit_id', $accessibleUnitIds)
                    ->orWhereIn('destination_unit_id', $accessibleUnitIds);
            });
        }

        return $query->paginate($perPage);
    }
}
```

Create `app/Services/AssetMutationService.php`:
```php
<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetMutationService
{
    public function __construct(
        private readonly AssetMutationRepositoryInterface $repository,
        private readonly ApprovalWorkflowService $workflowService
    ) {}

    public function submit(array $data, array $items, User $creator): AssetMutation
    {
        if (empty($items)) {
            throw new InvalidArgumentException('Mutasi harus memiliki setidaknya satu aset.');
        }

        $type = $data['jenis_mutasi'] instanceof MutationType
            ? $data['jenis_mutasi']
            : MutationType::from($data['jenis_mutasi']);

        $originUnit = Unit::findOrFail($data['origin_unit_id']);
        $destUnit = Unit::findOrFail($data['destination_unit_id']);

        if ($type === MutationType::Internal && $originUnit->id !== $destUnit->id) {
            throw new InvalidArgumentException('Mutasi internal harus berada di unit yang sama.');
        }

        if ($type !== MutationType::Internal && $originUnit->id === $destUnit->id) {
            throw new InvalidArgumentException('Mutasi antar unit harus memiliki unit asal dan tujuan yang berbeda.');
        }

        $workflowCode = $this->resolveWorkflowCode($type, $originUnit);

        return DB::transaction(function () use ($data, $items, $creator, $originUnit, $type, $workflowCode) {
            $assetIds = array_column($items, 'asset_id');
            $assets = Asset::whereIn('id', $assetIds)->lockForUpdate()->get();

            if ($assets->count() !== count($assetIds)) {
                throw new InvalidArgumentException('Beberapa aset yang dipilih tidak ditemukan.');
            }

            foreach ($assets as $asset) {
                if ($asset->unit_id !== $originUnit->id) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" bukan milik unit asal.");
                }
                if ($asset->status !== AssetStatus::Aktif) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" sedang tidak aktif atau dalam proses mutasi lain.");
                }
            }

            foreach ($items as $item) {
                if ($type === MutationType::Internal && empty($item['target_holder_id'])) {
                    throw new InvalidArgumentException('Mutasi internal wajib menentukan pegawai pemegang baru.');
                }
            }

            // Lock assets
            Asset::whereIn('id', $assetIds)->update(['status' => AssetStatus::DalamProses]);

            $data['status'] = MutationStatus::Pending;
            $data['created_by'] = $creator->id;

            $mutation = $this->repository->createWithItems($data, $items);
            $this->workflowService->submit($mutation, $workflowCode, $creator);

            return $mutation;
        });
    }

    public function resolveWorkflowCode(MutationType $type, Unit $originUnit): string
    {
        return match ($type) {
            MutationType::KecKeKel => 'mutasi_kec_ke_kel',
            MutationType::AntarKel => 'mutasi_antar_kel',
            MutationType::ReturKelKeKec => 'retur_kel_ke_kec',
            MutationType::Internal => $originUnit->isKecamatan()
                ? 'mutasi_internal_kec'
                : 'mutasi_internal_kel',
        };
    }
}
```

Bind repository in `app/Providers/AppServiceProvider.php`:
```php
$this->app->bind(
    \App\Repositories\Contracts\AssetMutationRepositoryInterface::class,
    \App\Repositories\AssetMutationRepository::class
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Services/AssetMutationServiceTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Repositories/Contracts/AssetMutationRepositoryInterface.php app/Repositories/AssetMutationRepository.php app/Services/AssetMutationService.php app/Providers/AppServiceProvider.php tests/Feature/Services/AssetMutationServiceTest.php
git commit -m "feat(mutations): implement AssetMutationRepository and AssetMutationService"
```

---

### Task 6: Effect Handler & Rollback on Rejection (`AssetMutationEffect`, `config/workflow.php`)

**Files:**
- Create: `app/Services/AssetMutationEffect.php`
- Modify: `config/workflow.php`
- Modify: `app/Services/ApprovalWorkflowService.php` (handle rejection unlocking)
- Test: `tests/Feature/Services/AssetMutationEffectTest.php`

**Interfaces:**
- Consumes: `WorkflowEffect` interface, `AssetMutation`, `AssetHistory`
- Produces: Transfer of assets on final approve; reversion to `AssetStatus::Aktif` on reject

- [ ] **Step 1: Write failing test for final effect and rejection handling**

```php
<?php

use App\Enums\ApprovalStatus;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetHistory;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('lurah');
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sei Lekop');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);

    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->mutationService = app(AssetMutationService::class);
    $this->workflowService = app(ApprovalWorkflowService::class);
});

it('executes AssetMutationEffect on final approval: transfers unit, updates holder, resets status, and logs history', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop HP ProBook',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 14000000,
        'nilai_buku' => 14000000,
    ]);

    $mutation = $this->mutationService->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0010',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id, 'target_holder_id' => $pegawai->id, 'catatan' => 'Serah terima laptop']],
        $this->adminKec
    );

    $req = $mutation->approvalRequest;

    // Step 1: Kasubag
    $this->workflowService->approve($req, $this->kasubag);
    // Step 2: Camat
    $this->workflowService->approve($req, $this->camat);
    // Step 3: Admin Kelurahan
    $this->workflowService->approve($req, $this->adminKel);
    // Step 4: Lurah (final)
    $this->workflowService->approve($req, $this->lurah);

    expect($req->fresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($asset->fresh()->current_holder_id)->toBe($pegawai->id)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);

    $history = AssetHistory::where('asset_id', $asset->id)->latest('id')->first();
    expect($history)->not->toBeNull()
        ->and($history->event)->toBe('mutasi')
        ->and($history->unit_id)->toBe($this->kel->id)
        ->and($history->current_holder_id)->toBe($pegawai->id);
});

it('reverts asset status to aktif and marks mutation as rejected when rejected', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.002',
        'nomor_register' => 2,
        'nama_aset' => 'Printer Epson L3210',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 3000000,
        'nilai_buku' => 3000000,
    ]);

    $mutation = $this->mutationService->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0011',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id]],
        $this->adminKec
    );

    $req = $mutation->approvalRequest;
    $this->workflowService->reject($req, $this->kasubag, 'Data tidak lengkap');

    expect($req->fresh()->status)->toBe(ApprovalStatus::Rejected)
        ->and($mutation->fresh()->status)->toBe(MutationStatus::Rejected)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif)
        ->and($asset->fresh()->unit_id)->toBe($this->kec->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Services/AssetMutationEffectTest.php`
Expected: FAIL (AssetMutationEffect not implemented / not mapped)

- [ ] **Step 3: Implement AssetMutationEffect and update ApprovalWorkflowService**

Create `app/Services/AssetMutationEffect.php`:
```php
<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Models\Asset;
use App\Models\AssetHistory;
use App\Models\AssetMutation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetMutationEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetMutation) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetMutation.');
        }

        DB::transaction(function () use ($approvable) {
            $approvable->load(['items.asset', 'originUnit', 'destinationUnit']);

            foreach ($approvable->items as $item) {
                $asset = $item->asset;

                $asset->update([
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'status' => AssetStatus::Aktif,
                ]);

                AssetHistory::create([
                    'asset_id' => $asset->id,
                    'event' => 'mutasi',
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => auth()->id() ?? $approvable->created_by,
                    'keterangan' => "Mutasi {$approvable->jenis_mutasi->label()} ({$approvable->originUnit->name} -> {$approvable->destinationUnit->name}) No. {$approvable->nomor_mutasi}. " . ($item->catatan ?? ''),
                ]);
            }

            $approvable->update(['status' => MutationStatus::Approved]);
        });
    }
}
```

Register effects in `config/workflow.php`:
```php
    'effects' => [
        'penerimaan_aset' => PenerimaanAsetEffect::class,
        'mutasi_kec_ke_kel' => AssetMutationEffect::class,
        'mutasi_antar_kel' => AssetMutationEffect::class,
        'retur_kel_ke_kec' => AssetMutationEffect::class,
        'mutasi_internal_kec' => AssetMutationEffect::class,
        'mutasi_internal_kel' => AssetMutationEffect::class,
    ],
```

Update `reject()` in `app/Services/ApprovalWorkflowService.php`:
```php
            $locked->update(['status' => ApprovalStatus::Rejected]);

            if ($locked->approvable instanceof \App\Models\AssetMutation) {
                $locked->approvable->update(['status' => \App\Enums\MutationStatus::Rejected]);
                $assetIds = $locked->approvable->items()->pluck('asset_id');
                \App\Models\Asset::whereIn('id', $assetIds)->update(['status' => \App\Enums\AssetStatus::Aktif]);
            }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Services/AssetMutationEffectTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetMutationEffect.php config/workflow.php app/Services/ApprovalWorkflowService.php tests/Feature/Services/AssetMutationEffectTest.php
git commit -m "feat(mutations): implement AssetMutationEffect and rejection asset unlock"
```

---

### Task 7: Request Validation & Policy (`StoreAssetMutationRequest`, `AssetMutationPolicy`)

**Files:**
- Create: `app/Http/Requests/StoreAssetMutationRequest.php`
- Create: `app/Policies/AssetMutationPolicy.php`
- Modify: `app/Models/User.php` or Policy Registration
- Test: `tests/Feature/Policies/AssetMutationPolicyTest.php`

**Interfaces:**
- Consumes: `User`, `AssetMutation`, `MutationType`
- Produces: Authorization gate and validation rules for mutation creation

- [ ] **Step 1: Write failing test for policy and request validation**

```php
<?php

use App\Models\AssetMutation;
use App\Models\User;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Sagulung');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Tembesi');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
});

it('authorizes mutation creation only for origin unit admins', function () {
    expect($this->adminKec->can('create', [AssetMutation::class, $this->kec]))->toBeTrue()
        ->and($this->adminKec->can('create', [AssetMutation::class, $this->kelA]))->toBeFalse()
        ->and($this->adminKelA->can('create', [AssetMutation::class, $this->kelA]))->toBeTrue()
        ->and($this->adminKelA->can('create', [AssetMutation::class, $this->kelB]))->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Policies/AssetMutationPolicyTest.php`
Expected: FAIL (Policy not found or unauthorized)

- [ ] **Step 3: Implement StoreAssetMutationRequest and AssetMutationPolicy**

Create `app/Policies/AssetMutationPolicy.php`:
```php
<?php

namespace App\Policies;

use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;

class AssetMutationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, AssetMutation $mutation): bool
    {
        $accessibleUnitIds = $user->accessibleUnitIds();

        if ($accessibleUnitIds === null) {
            return true;
        }

        return in_array($mutation->origin_unit_id, $accessibleUnitIds, true)
            || in_array($mutation->destination_unit_id, $accessibleUnitIds, true);
    }

    public function create(User $user, ?Unit $originUnit = null): bool
    {
        if (! $user->hasRole(['admin_kecamatan', 'admin_kelurahan'])) {
            return false;
        }

        if ($originUnit === null) {
            return true;
        }

        return $user->canAccessUnit($originUnit);
    }
}
```

Create `app/Http/Requests/StoreAssetMutationRequest.php`:
```php
<?php

namespace App\Http\Requests;

use App\Enums\MutationType;
use App\Models\AssetMutation;
use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetMutationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $originUnit = Unit::find($this->input('origin_unit_id'));

        return $this->user()->can('create', [AssetMutation::class, $originUnit]);
    }

    public function rules(): array
    {
        return [
            'nomor_mutasi' => ['required', 'string', 'max:50', 'unique:asset_mutations,nomor_mutasi'],
            'jenis_mutasi' => ['required', Rule::enum(MutationType::class)],
            'origin_unit_id' => ['required', 'integer', 'exists:units,id'],
            'destination_unit_id' => ['required', 'integer', 'exists:units,id'],
            'tanggal_mutasi' => ['required', 'date'],
            'keterangan' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.asset_id' => ['required', 'integer', 'exists:assets,id'],
            'items.*.target_holder_id' => ['nullable', 'integer', 'exists:pegawais,id'],
            'items.*.catatan' => ['nullable', 'string', 'max:255'],
        ];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Policies/AssetMutationPolicyTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Policies/AssetMutationPolicy.php app/Http/Requests/StoreAssetMutationRequest.php tests/Feature/Policies/AssetMutationPolicyTest.php
git commit -m "feat(mutations): implement AssetMutationPolicy and StoreAssetMutationRequest"
```

---

### Task 8: Controller, Routing & End-to-End Feature Tests (`AssetMutationController`, `routes/web.php`)

**Files:**
- Create: `app/Http/Controllers/AssetMutationController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/AssetMutationEndToEndTest.php`

**Interfaces:**
- Consumes: `AssetMutationService`, `AssetMutationRepositoryInterface`, `StoreAssetMutationRequest`
- Produces: Web endpoints for listing, viewing, and creating mutations

- [ ] **Step 1: Write failing End-to-End test**

```php
<?php

use App\Enums\ApprovalStatus;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('lurah');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sungai Binti');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);

    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
});

it('executes full mutation HTTP lifecycle: create via POST, index, show, and approve through generic approvals', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'PC Laboratorium',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $payload = [
        'nomor_mutasi' => 'MUT/2026/09/9999',
        'jenis_mutasi' => MutationType::KecKeKel->value,
        'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kel->id,
        'tanggal_mutasi' => '2026-09-29',
        'keterangan' => 'Pengalihan PC ke kelurahan',
        'items' => [
            [
                'asset_id' => $asset->id,
                'target_holder_id' => $pegawai->id,
                'catatan' => 'Lengkap monitor & mouse',
            ],
        ],
    ];

    $response = $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), $payload);
    $response->assertRedirect(route('asset-mutations.index'));

    $mutation = AssetMutation::where('nomor_mutasi', 'MUT/2026/09/9999')->first();
    expect($mutation)->not->toBeNull()
        ->and($mutation->status)->toBe(MutationStatus::Pending)
        ->and($asset->fresh()->status)->toBe(AssetStatus::DalamProses);

    // List mutations
    $this->actingAs($this->adminKec)->get(route('asset-mutations.index'))->assertOk();

    // Show mutation
    $this->actingAs($this->adminKec)->get(route('asset-mutations.show', $mutation))->assertOk();

    // Step 1 approval: Kasubag
    $this->actingAs($this->kasubag)
        ->post(route('approvals.approve', $mutation->approvalRequest), ['note' => 'Setuju administrasi'])
        ->assertRedirect();

    // Step 2 approval: Camat
    $this->actingAs($this->camat)
        ->post(route('approvals.approve', $mutation->approvalRequest), ['note' => 'Setuju pengeluaran aset'])
        ->assertRedirect();

    // Step 3 approval: Admin Kelurahan
    $this->actingAs($this->adminKel)
        ->post(route('approvals.approve', $mutation->approvalRequest), ['note' => 'Barang fisik diterima'])
        ->assertRedirect();

    // Step 4 approval: Lurah (final)
    $this->actingAs($this->lurah)
        ->post(route('approvals.approve', $mutation->approvalRequest), ['note' => 'Disetujui masuk'])
        ->assertRedirect();

    expect($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($asset->fresh()->current_holder_id)->toBe($pegawai->id)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetMutationEndToEndTest.php`
Expected: FAIL (Route/Controller not found)

- [ ] **Step 3: Implement AssetMutationController and register routes**

Create `app/Http/Controllers/AssetMutationController.php`:
```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAssetMutationRequest;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use App\Services\AssetMutationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AssetMutationController extends Controller
{
    public function __construct(
        private readonly AssetMutationRepositoryInterface $repository,
        private readonly AssetMutationService $service
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetMutation::class);

        $mutations = $this->repository->paginateForUser($request->user(), 15);

        return Inertia::render('AssetMutations/Index', [
            'mutations' => $mutations,
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetMutation::class);

        $user = $request->user();
        $accessibleUnitIds = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($accessibleUnitIds !== null, fn ($q) => $q->whereIn('id', $accessibleUnitIds))
            ->get();

        $allUnits = Unit::all();

        return Inertia::render('AssetMutations/Create', [
            'units' => $units,
            'allUnits' => $allUnits,
        ]);
    }

    public function store(StoreAssetMutationRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $items = $validated['items'];
        unset($validated['items']);

        $mutation = $this->service->submit($validated, $items, $request->user());

        return redirect()->route('asset-mutations.index')->with('success', "Mutasi aset #{$mutation->nomor_mutasi} berhasil diajukan.");
    }

    public function show(AssetMutation $assetMutation): Response
    {
        Gate::authorize('view', $assetMutation);

        $assetMutation->load([
            'originUnit',
            'destinationUnit',
            'creator',
            'items.asset.category',
            'items.targetHolder',
            'approvalRequest.definition.steps',
            'approvalRequest.actions.user',
            'photos',
        ]);

        return Inertia::render('AssetMutations/Show', [
            'mutation' => $assetMutation,
        ]);
    }
}
```

Add routes in `routes/web.php`:
```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('asset-mutations', AssetMutationController::class)->only(['index', 'create', 'store', 'show']);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/AssetMutationEndToEndTest.php`
Expected: PASS

- [ ] **Step 5: Run full test suite to ensure zero regression**

Run: `php artisan test`
Expected: All existing tests + new mutation tests pass (214+ tests passing).

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/AssetMutationController.php routes/web.php tests/Feature/AssetMutationEndToEndTest.php
git commit -m "feat(mutations): implement AssetMutationController, routes, and end-to-end tests"
```
