<?php

use App\Enums\ApprovalActionType;
use App\Enums\ApprovalStatus;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowDefinition;
use Database\Seeders\WorkflowDefinitionSeeder;

it('seeds the penerimaan_aset definition with kasubag then camat steps', function () {
    (new WorkflowDefinitionSeeder)->run();

    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();

    expect($definition->steps)->toHaveCount(2)
        ->and($definition->steps[0]->approver_role)->toBe('kasubag')
        ->and($definition->steps[0]->unit_scope)->toBe(UnitScope::None)
        ->and($definition->steps[1]->approver_role)->toBe('camat')
        ->and($definition->steps[1]->unit_scope)->toBe(UnitScope::Subject);
});

it('resolves the current step definition and detects the last step', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $user = User::factory()->create();

    $request = ApprovalRequest::create([
        'workflow_definition_id' => $definition->id,
        'approvable_type' => User::class,
        'approvable_id' => $user->id,
        'current_step' => 1,
        'status' => ApprovalStatus::Pending,
        'created_by' => $user->id,
    ]);

    expect($request->currentStepDefinition()->approver_role)->toBe('kasubag')
        ->and($request->isLastStep())->toBeFalse();

    $request->current_step = 2;
    expect($request->isLastStep())->toBeTrue();
});

it('logs an approval action tied to a request', function () {
    (new WorkflowDefinitionSeeder)->run();
    $definition = WorkflowDefinition::where('code', 'penerimaan_aset')->firstOrFail();
    $user = User::factory()->create();
    $request = ApprovalRequest::create([
        'workflow_definition_id' => $definition->id,
        'approvable_type' => User::class,
        'approvable_id' => $user->id,
        'current_step' => 1,
        'status' => ApprovalStatus::Pending,
        'created_by' => $user->id,
    ]);

    $action = $request->actions()->create([
        'step_order' => 1,
        'user_id' => $user->id,
        'action' => 'reject',
        'note' => 'Dokumen tidak lengkap',
    ]);

    expect($action->action)->toBe(ApprovalActionType::Reject)
        ->and($request->actions)->toHaveCount(1)
        ->and($request->creator->id)->toBe($user->id);
});
