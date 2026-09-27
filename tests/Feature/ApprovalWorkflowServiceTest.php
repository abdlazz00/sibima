<?php

use App\Contracts\WorkflowEffect;
use App\Enums\ApprovalStatus;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Model;
use Spatie\Permission\Models\Role;

class TestWorkflowEffect implements WorkflowEffect
{
    public static ?int $applied = null;

    public function apply(Model $approvable): void
    {
        self::$applied = $approvable->getKey();
    }
}

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');

    $this->kec = makeKecamatan();
    $this->submitter = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);

    $definition = WorkflowDefinition::create(['code' => 'test_workflow', 'name' => 'Test Workflow']);
    $definition->steps()->createMany([
        ['step_order' => 1, 'approver_role' => 'kasubag', 'unit_scope' => 'none'],
        ['step_order' => 2, 'approver_role' => 'camat', 'unit_scope' => 'subject'],
    ]);

    config(['workflow.effects.test_workflow' => TestWorkflowEffect::class]);
    TestWorkflowEffect::$applied = null;

    $this->service = app(ApprovalWorkflowService::class);
});

it('submits at step 1 and notifies the first step approver', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    expect($request->current_step)->toBe(1)
        ->and($request->status)->toBe(ApprovalStatus::Pending)
        ->and($this->kasubag->notifications)->toHaveCount(1);
});

it('advances to the next step on approve and notifies its approver', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    $this->service->approve($request, $this->kasubag);

    expect($request->fresh()->current_step)->toBe(2)
        ->and($this->camat->fresh()->notifications)->toHaveCount(1);
});

it('triggers the registered effect and notifies the submitter on final approve', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);
    $this->service->approve($request, $this->kasubag);

    $this->service->approve($request, $this->camat);

    expect($request->fresh()->status)->toBe(ApprovalStatus::Approved)
        ->and(TestWorkflowEffect::$applied)->toBe($this->submitter->id)
        ->and($this->submitter->fresh()->notifications)->toHaveCount(1);
});

it('rejects with a required note, skips the effect, and notifies the submitter', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    $this->service->reject($request, $this->kasubag, 'Dokumen tidak lengkap');

    expect($request->fresh()->status)->toBe(ApprovalStatus::Rejected)
        ->and(TestWorkflowEffect::$applied)->toBeNull()
        ->and($this->submitter->fresh()->notifications)->toHaveCount(1);
});

it('forbids an actor without the required role or unit scope from approving', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);

    expect(fn () => $this->service->approve($request, $this->submitter))
        ->toThrow(InvalidArgumentException::class);

    $this->service->approve($request, $this->kasubag);
    $outsideCamat = userWithRole('camat', makeKecamatan('Kecamatan Lain'));

    expect(fn () => $this->service->approve($request, $outsideCamat))
        ->toThrow(InvalidArgumentException::class);
});

it('refuses to act twice on an already-decided request', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);
    $this->service->reject($request, $this->kasubag, 'Tidak lengkap');

    expect(fn () => $this->service->approve($request, $this->kasubag))
        ->toThrow(InvalidArgumentException::class);
});

it('reports canAct as false once approved, even for the deciding step\'s own approver', function () {
    $request = $this->service->submit($this->submitter, 'test_workflow', $this->submitter);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    expect($this->service->canAct($this->camat, $request->fresh()))->toBeFalse();
});
