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
