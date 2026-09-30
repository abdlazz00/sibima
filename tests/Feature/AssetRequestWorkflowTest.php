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
