<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\ApprovalStatus;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Models\WorkflowStep;
use App\Notifications\ApprovalStepNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ApprovalWorkflowService
{
    public function submit(Model $approvable, string $workflowCode, User $submitter): ApprovalRequest
    {
        $definition = WorkflowDefinition::where('code', $workflowCode)->firstOrFail();

        $request = ApprovalRequest::create([
            'workflow_definition_id' => $definition->id,
            'approvable_type' => $approvable->getMorphClass(),
            'approvable_id' => $approvable->getKey(),
            'current_step' => 1,
            'status' => ApprovalStatus::Pending,
            'created_by' => $submitter->id,
        ]);

        $request->setRelation('approvable', $approvable);
        $this->notifyApprovers($request);

        return $request;
    }

    public function canAct(User $user, ApprovalRequest $request): bool
    {
        if ($request->status !== ApprovalStatus::Pending) {
            return false;
        }

        $step = $request->currentStepDefinition();

        if ($step === null || ! $user->hasRole($step->approver_role)) {
            return false;
        }

        return match ($step->unit_scope) {
            UnitScope::None => true,
            UnitScope::Subject => $user->canAccessUnit($request->approvable->unit),
            UnitScope::Origin => $request->approvable instanceof \App\Contracts\HasWorkflowUnits
                && $user->canAccessUnit($request->approvable->getOriginUnit()),
            UnitScope::Destination => $request->approvable instanceof \App\Contracts\HasWorkflowUnits
                && $user->canAccessUnit($request->approvable->getDestinationUnit()),
        };
    }

    public function approve(ApprovalRequest $request, User $approver, ?string $note = null): void
    {
        if (! $this->canAct($approver, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang menyetujui step ini.');
        }

        DB::transaction(function () use ($request, $approver, $note) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ApprovalStatus::Pending || $locked->current_step !== $request->current_step) {
                throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
            }

            $locked->actions()->create([
                'step_order' => $locked->current_step,
                'user_id' => $approver->id,
                'action' => ApprovalActionType::Approve,
                'note' => $note,
            ]);

            if ($locked->isLastStep()) {
                $locked->update(['status' => ApprovalStatus::Approved]);
                $this->runEffect($locked);
            } else {
                $locked->update(['current_step' => $locked->current_step + 1]);
            }

            $request->setRawAttributes($locked->getAttributes());
        });

        if ($request->fresh()->status === ApprovalStatus::Approved) {
            $this->notifySubmitter($request, 'Pengajuan Anda telah disetujui.');
        } else {
            $this->notifyApprovers($request->fresh());
        }
    }

    public function reject(ApprovalRequest $request, User $approver, string $note): void
    {
        if (! $this->canAct($approver, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang menolak step ini.');
        }

        DB::transaction(function () use ($request, $approver, $note) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ApprovalStatus::Pending || $locked->current_step !== $request->current_step) {
                throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
            }

            $locked->actions()->create([
                'step_order' => $locked->current_step,
                'user_id' => $approver->id,
                'action' => ApprovalActionType::Reject,
                'note' => $note,
            ]);

            $locked->update(['status' => ApprovalStatus::Rejected]);

            if (method_exists($locked->approvable, 'onApprovalRejected')) {
                $locked->approvable->onApprovalRejected();
            }

            $request->setRawAttributes($locked->getAttributes());
        });

        $this->notifySubmitter($request, "Pengajuan Anda ditolak: {$note}");
    }

    private function runEffect(ApprovalRequest $request): void
    {
        $effectClass = config("workflow.effects.{$request->definition->code}");

        if ($effectClass === null) {
            throw new InvalidArgumentException("Tidak ada effect terdaftar untuk alur \"{$request->definition->code}\".");
        }

        app($effectClass)->apply($request->approvable);
    }

    private function notifyApprovers(ApprovalRequest $request): void
    {
        $step = $request->currentStepDefinition();

        if ($step === null) {
            return;
        }

        $this->approversFor($step, $request->approvable)->each(
            fn (User $user) => $user->notify(new ApprovalStepNotification(
                $request,
                "Menunggu persetujuan Anda: {$request->definition->name}",
            ))
        );
    }

    private function notifySubmitter(ApprovalRequest $request, string $message): void
    {
        $request->creator->notify(new ApprovalStepNotification($request, $message));
    }

    /** @return Collection<int, User> */
    private function approversFor(WorkflowStep $step, Model $approvable): Collection
    {
        $users = User::role($step->approver_role)->get();

        if ($step->unit_scope === UnitScope::Subject) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->unit))->values();
        }

        if ($step->unit_scope === UnitScope::Origin && $approvable instanceof \App\Contracts\HasWorkflowUnits) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getOriginUnit()))->values();
        }

        if ($step->unit_scope === UnitScope::Destination && $approvable instanceof \App\Contracts\HasWorkflowUnits) {
            return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getDestinationUnit()))->values();
        }

        return $users;
    }
}
