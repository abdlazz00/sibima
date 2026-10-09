<?php

use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;
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
    $this->superAdmin = userWithRole('super-admin');
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

it('shows the workflow list and editor only to a super-admin', function () {
    $this->actingAs($this->superAdmin)->get(route('workflow-settings.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('WorkflowSettings/Index')->has('workflows', 10));

    $this->actingAs($this->superAdmin)->get(route('workflow-settings.edit', $this->penerimaan))
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

it('refuses every non-super-admin role on every settings endpoint including kasubag', function () {
    foreach (['kasubag', 'camat', 'lurah', 'adminKec', 'adminKel'] as $who) {
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

    $this->actingAs($this->superAdmin)->put(route('workflow-settings.update', $this->penerimaan), $payload)->assertRedirect();

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
    expect($log->user_id)->toBe($this->superAdmin->id)
        ->and($log->event)->toBe('update')
        ->and($log->steps_before)->toHaveCount(2)
        ->and($log->steps_before[0]['approver_role'])->toBe('kasubag')
        ->and($log->steps_after)->toHaveCount(2)
        ->and($log->steps_after[0]['approver_type'])->toBe('user');
});

it('rejects invalid step configurations', function (string $case) {
    $unassigned = User::factory()->create();

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

    $this->actingAs($this->superAdmin)->from('/x')
        ->put(route('workflow-settings.update', $this->penerimaan), ['steps' => $steps])
        ->assertSessionHasErrors();

    expect($this->penerimaan->fresh()->steps)->toHaveCount(2)
        ->and(WorkflowChangeLog::count())->toBe(0);
})->with([
    'empty', 'blank label', 'role missing', 'unknown role', 'role without users',
    'user missing', 'user without role', 'origin scope on penerimaan',
]);

it('rejects scopes and approver types the workflow cannot support', function () {
    $this->actingAs($this->superAdmin)->from('/x')
        ->put(route('workflow-settings.update', $this->mutasi), ['steps' => [stepPayload(['unit_scope' => 'subject'])]])
        ->assertSessionHasErrors('steps.0.unit_scope');

    $this->actingAs($this->superAdmin)->from('/x')
        ->put(route('workflow-settings.update', $this->mutasi), ['steps' => [stepPayload(['approver_type' => 'atasan_unit', 'approver_role' => null, 'unit_scope' => 'subject'])]])
        ->assertSessionHasErrors('steps.0.approver_type');

    expect($this->mutasi->fresh()->steps)->toHaveCount(3);
});

it('saves atomically: a valid first step is not kept when a later step is invalid', function () {
    $this->actingAs($this->superAdmin)->from('/x')
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

    $this->actingAs($this->superAdmin)->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [
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
    $this->actingAs($this->superAdmin)->put(route('workflow-settings.update', $this->penerimaan), ['steps' => [stepPayload()]])->assertRedirect();
    expect($this->penerimaan->fresh()->steps)->toHaveCount(1);

    $this->actingAs($this->superAdmin)->post(route('workflow-settings.reset', $this->penerimaan))->assertRedirect();

    $steps = $this->penerimaan->fresh()->steps;
    expect($steps->pluck('approver_role')->all())->toBe(['kasubag', 'camat'])
        ->and($steps->pluck('label')->all())->toBe(['Verifikasi Kasubag', 'Persetujuan Camat'])
        ->and(WorkflowChangeLog::orderBy('id')->pluck('event')->all())->toBe(['update', 'reset']);
});

it('offers every role, including custom ones, as an approver and accepts a step for it', function () {
    $verifikator = Role::findOrCreate('verifikator');
    $verifikator->update(['display_name' => 'Verifikator Aset']);
    $user = userWithRole('verifikator', $this->kec);

    $this->actingAs($this->superAdmin)->get(route('workflow-settings.edit', $this->penerimaan))
        ->assertInertia(fn (Assert $p) => $p->where('options.roles', fn ($roles) => collect($roles)->contains(
            fn ($r) => $r['value'] === 'verifikator' && $r['label'] === 'Verifikator Aset',
        )));

    $this->actingAs($this->superAdmin)->put(route('workflow-settings.update', $this->penerimaan), [
        'steps' => [stepPayload(['label' => 'Verifikasi', 'approver_role' => 'verifikator', 'unit_scope' => 'none'])],
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect($this->penerimaan->steps()->first()->approver_role)->toBe('verifikator')
        ->and($user->hasRole('verifikator'))->toBeTrue();
});

it('still rejects an approver role that does not exist', function () {
    $this->actingAs($this->superAdmin)->put(route('workflow-settings.update', $this->penerimaan), [
        'steps' => [stepPayload(['approver_role' => 'tidak_ada', 'unit_scope' => 'none'])],
    ])->assertSessionHasErrors('steps.0.approver_role');
});
