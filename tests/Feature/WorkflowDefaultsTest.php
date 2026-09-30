<?php

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Database\Seeders\WorkflowDefinitionSeeder;

it('seeds every default workflow with labelled role steps', function () {
    (new WorkflowDefinitionSeeder)->run();

    expect(WorkflowDefinition::count())->toBe(count(WorkflowDefaults::all()));

    $penerimaan = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail()->steps;
    expect($penerimaan->pluck('label')->all())->toBe(['Verifikasi Kasubag', 'Persetujuan Camat'])
        ->and($penerimaan[0]->approver_type)->toBe(ApproverType::Role)
        ->and($penerimaan[1]->unit_scope)->toBe(UnitScope::Subject);

    foreach (WorkflowDefinition::with('steps')->get() as $definition) {
        expect($definition->steps->every(fn ($s) => $s->label !== ''))->toBeTrue();
    }
});

it('declares a capability for every default workflow', function () {
    expect(array_keys(config('workflow.capabilities')))
        ->toEqualCanonicalizing(array_keys(WorkflowDefaults::all()));
});

it('does not overwrite steps an admin has edited when the seeder runs again', function () {
    (new WorkflowDefinitionSeeder)->run();

    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $definition->steps()->where('step_order', 2)->delete();
    $definition->steps()->where('step_order', 1)->update(['label' => 'Nama Baru', 'approver_role' => 'camat']);

    (new WorkflowDefinitionSeeder)->run();

    $steps = $definition->fresh()->steps;
    expect($steps)->toHaveCount(1)
        ->and($steps[0]->label)->toBe('Nama Baru')
        ->and($steps[0]->approver_role)->toBe('camat');
});

it('applyTo replaces custom steps with the defaults', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'mutasi_antar_kel')->firstOrFail();
    $definition->steps()->delete();
    $definition->steps()->create(['step_order' => 1, 'label' => 'Kustom', 'approver_type' => 'role', 'approver_role' => 'kasubag', 'unit_scope' => 'none']);

    WorkflowDefaults::applyTo($definition);

    expect($definition->fresh()->steps->pluck('approver_role')->all())->toBe(['lurah', 'admin_kelurahan', 'lurah']);
});
