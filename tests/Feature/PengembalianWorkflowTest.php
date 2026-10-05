<?php

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\AssetMutation;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationEffect;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
});

function pgMutation(object $t): AssetMutation
{
    return AssetMutation::create([
        'nomor_mutasi' => 'PGW/'.uniqid(), 'jenis_mutasi' => 'internal',
        'origin_unit_id' => $t->kec->id, 'destination_unit_id' => $t->kec->id,
        'tanggal_mutasi' => '2026-10-05', 'status' => 'pending', 'created_by' => $t->adminKec->id,
    ]);
}

it('seeds the pengembalian_aset workflow with one atasan unit step', function () {
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();
    $step = $definition->steps->sole();

    expect($definition->name)->toBe('Pengembalian Aset ke Inventaris')
        ->and($step->label)->toBe('Persetujuan Atasan Unit')
        ->and($step->approver_type)->toBe(ApproverType::AtasanUnit)
        ->and($step->unit_scope)->toBe(UnitScope::Subject)
        ->and(config('workflow.effects.pengembalian_aset'))->toBe(AssetMutationEffect::class)
        ->and(config('workflow.capabilities.pengembalian_aset'))->toBe('subject');
});

it('lists the workflow in settings and lets its atasan unit step be saved', function () {
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();

    $this->actingAs($this->kasubag)->get(route('workflow-settings.index'))
        ->assertInertia(fn ($page) => $page->has('workflows', 10));

    $this->actingAs($this->kasubag)->put(route('workflow-settings.update', $definition), [
        'steps' => [[
            'label' => 'Persetujuan Atasan Unit', 'approver_type' => 'atasan_unit',
            'approver_role' => null, 'approver_user_id' => null, 'unit_scope' => 'subject',
        ]],
    ])->assertRedirect()->assertSessionHasNoErrors();
});

it('exposes the origin unit of a mutation as its unit for atasan unit approval', function () {
    expect(pgMutation($this)->unit->id)->toBe($this->kec->id);
});

it('raises a clear error when a workflow definition is missing instead of a 404', function () {
    WorkflowDefinition::where('code', 'pengembalian_aset')->delete();

    expect(fn () => app(ApprovalWorkflowService::class)->submit(pgMutation($this), 'pengembalian_aset', $this->adminKec))
        ->toThrow(InvalidArgumentException::class, "Alur persetujuan 'pengembalian_aset' belum dikonfigurasi");
});
