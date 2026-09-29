<?php

use App\Enums\ApprovalStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequest;
use App\Models\AssetMutation;
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

    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/TEST/001',
        'jenis_mutasi' => MutationType::AntarKel,
        'origin_unit_id' => $this->kelA->id,
        'destination_unit_id' => $this->kelB->id,
        'tanggal_mutasi' => '2026-09-29',
        'status' => MutationStatus::Pending,
        'created_by' => $this->lurahA->id,
    ]);

    $request = ApprovalRequest::create([
        'workflow_definition_id' => WorkflowDefinition::where('code', 'mutasi_antar_kel')->first()->id,
        'approvable_type' => $mutation->getMorphClass(),
        'approvable_id' => $mutation->id,
        'current_step' => 1, // Step 1: lurah origin
        'status' => ApprovalStatus::Pending,
        'created_by' => $this->lurahA->id,
    ]);
    $request->setRelation('approvable', $mutation);

    expect($this->service->canAct($this->lurahA, $request))->toBeTrue()
        ->and($this->service->canAct($this->lurahB, $request))->toBeFalse();

    $request->update(['current_step' => 2]);
    expect($this->service->canAct($this->adminKelB, $request))->toBeTrue()
        ->and($this->service->canAct($this->adminKec, $request))->toBeFalse();
});
