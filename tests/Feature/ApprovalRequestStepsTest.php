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
