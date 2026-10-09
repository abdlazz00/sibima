<?php

use App\Models\AssetMutation;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->engine = app(ApprovalWorkflowService::class);
});

function pdStep(string $code, array $attrs): void
{
    WorkflowDefinition::where('code', $code)->firstOrFail()->steps()->update($attrs);
}

function pdPending(object $t)
{
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'AP/'.uniqid(), 'jenis_mutasi' => 'pengembalian', 'origin_unit_id' => $t->kec->id,
        'destination_unit_id' => $t->kec->id, 'tanggal_mutasi' => '2026-10-09', 'status' => 'pending', 'created_by' => $t->adminKec->id,
    ]);

    return $t->engine->submit($mutation, 'pengembalian_aset', $t->adminKec)->fresh();
}

it('requires persetujuan.act on top of the workflow step for an atasan unit step', function () {
    $request = pdPending($this);

    expect($this->engine->canAct($this->camat, $request))->toBeTrue();

    Role::findByName('camat')->revokePermissionTo('persetujuan.act');
    $camat = $this->camat->fresh();

    expect($this->engine->canAct($camat, $request))->toBeFalse()
        ->and(fn () => $this->engine->approve($request, $camat))->toThrow(InvalidArgumentException::class);
});

it('requires persetujuan.act for a role step and a user step too', function () {
    pdStep('pengembalian_aset', ['approver_type' => 'role', 'approver_role' => 'admin_kelurahan', 'approver_user_id' => null, 'unit_scope' => 'none']);
    $adminKel = userWithRole('admin_kelurahan', makeKelurahan($this->kec, 'Kelurahan A'));
    $request = pdPending($this);

    expect($this->engine->canAct($adminKel, $request))->toBeTrue();

    Role::findByName('admin_kelurahan')->revokePermissionTo('persetujuan.act');
    expect($this->engine->canAct($adminKel->fresh(), $request))->toBeFalse();

    pdStep('pengembalian_aset', ['approver_type' => 'user', 'approver_role' => null, 'approver_user_id' => $this->camat->id, 'unit_scope' => 'none']);
    $userRequest = pdPending($this);

    expect($this->engine->canAct($this->camat->fresh(), $userRequest))->toBeTrue();
    Role::findByName('camat')->revokePermissionTo('persetujuan.act');
    expect($this->engine->canAct($this->camat->fresh(), $userRequest))->toBeFalse();
});

it('does not notify approvers who lack persetujuan.act', function () {
    Role::findByName('camat')->revokePermissionTo('persetujuan.act');

    pdPending($this);

    expect($this->camat->notifications()->count())->toBe(0);
});

it('lets only holders of persetujuan.reassign hand a step over, and only to someone who can act', function () {
    $request = pdPending($this);
    $target = userWithRole('lurah', makeKelurahan($this->kec, 'Kelurahan B'));

    expect($this->engine->canReassign($this->kasubag, $request))->toBeTrue()
        ->and($this->engine->canReassign($this->camat, $request))->toBeFalse();

    Role::findByName('kasubag')->revokePermissionTo('persetujuan.reassign');
    expect($this->engine->canReassign($this->kasubag->fresh(), $request))->toBeFalse();

    Role::findByName('kasubag')->givePermissionTo('persetujuan.reassign');
    $noAct = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');

    expect(fn () => $this->engine->reassign($request, $this->kasubag->fresh(), $noAct->fresh(), 'tes'))
        ->toThrow(InvalidArgumentException::class, 'izin');

    $this->engine->reassign($request, $this->kasubag->fresh(), $target->fresh(), 'tes');

    expect($this->engine->canAct($target->fresh(), $request->fresh()))->toBeTrue();
});

it('lists only holders of persetujuan.act as reassign candidates', function () {
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');

    $ids = collect($this->engine->reassignCandidates())->pluck('id');

    expect($ids)->toContain($this->camat->id)->not->toContain($this->adminKec->id);
});

it('flags roles and users without persetujuan.act on the workflow settings page', function () {
    Role::findByName('admin_kecamatan')->revokePermissionTo('persetujuan.act');
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();

    $this->actingAs($this->kasubag)->get(route('workflow-settings.edit', $definition))
        ->assertInertia(fn ($page) => $page
            ->where('options.roles', fn ($roles) => collect($roles)->firstWhere('value', 'admin_kecamatan')['can_act'] === false
                && collect($roles)->firstWhere('value', 'camat')['can_act'] === true)
            ->where('options.users', fn ($users) => collect($users)->firstWhere('id', $this->adminKec->id)['can_act'] === false));
});
