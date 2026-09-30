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

    $this->actingAs($this->camat)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'x', 'step_order' => 1])->assertForbidden();
    $this->actingAs($this->admin)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'x', 'step_order' => 1])->assertForbidden();

    $this->actingAs($this->kasubagA)->from('/x')->post($url, ['user_id' => $this->kasubagB->id, 'step_order' => 1])->assertSessionHasErrors('note');
    $this->actingAs($this->kasubagA)->from('/x')->post($url, ['note' => 'x', 'step_order' => 1])->assertSessionHasErrors('user_id');

    $this->actingAs($this->kasubagA)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'Cuti', 'step_order' => 1])->assertRedirect();
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

it('refuses to reassign a step to the submitter of the request', function () {
    expect(fn () => $this->service->reassign($this->request, $this->kasubagA, $this->admin, 'x'))
        ->toThrow(InvalidArgumentException::class);

    expect($this->request->fresh()->currentStepDefinition()->approver_user_id)->toBeNull();
});

it('refuses a reassignment posted from a stale page after the request moved to another step', function () {
    $this->service->approve($this->request, $this->kasubagA);

    expect(fn () => $this->service->reassign($this->request->fresh(), $this->kasubagA, $this->kasubagB, 'Cuti', 1))
        ->toThrow(InvalidArgumentException::class);

    $url = route('approval-requests.reassign', $this->request);
    $this->actingAs($this->kasubagA)->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'Cuti', 'step_order' => 1])
        ->assertRedirect()->assertSessionHas('error');
    $this->actingAs($this->kasubagA)->from('/x')->post($url, ['user_id' => $this->kasubagB->id, 'note' => 'Cuti'])
        ->assertSessionHasErrors('step_order');

    $step = $this->request->fresh()->currentStepDefinition();
    expect($step->step_order)->toBe(2)
        ->and($step->approver_user_id)->toBeNull()
        ->and($step->approver_role)->toBe('camat');
});
