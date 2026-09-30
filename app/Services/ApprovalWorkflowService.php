<?php

namespace App\Services;

use App\Contracts\HandlesApprovalOutcome;
use App\Contracts\HasWorkflowUnits;
use App\Enums\ApprovalActionType;
use App\Enums\ApprovalStatus;
use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\ApprovalRequest;
use App\Models\ApprovalRequestStep;
use App\Models\AssetMutation;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Notifications\ApprovalStepNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
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

        $request->snapshotSteps();
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

        return $step !== null && $this->stepAllows($user, $step, $request->approvable);
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

            if ($locked->approvable instanceof HandlesApprovalOutcome) {
                $locked->approvable->onApprovalRejected();
            }

            $request->setRawAttributes($locked->getAttributes());
        });

        $this->notifySubmitter($request, "Pengajuan Anda ditolak: {$note}");
    }

    public function canCancel(User $user, ApprovalRequest $request): bool
    {
        return $request->status === ApprovalStatus::Pending && $request->created_by === $user->id;
    }

    public function cancel(ApprovalRequest $request, User $submitter, string $note): void
    {
        if (! $this->canCancel($submitter, $request)) {
            throw new InvalidArgumentException('Hanya pengaju yang dapat membatalkan pengajuan yang masih menunggu persetujuan.');
        }

        DB::transaction(function () use ($request, $submitter, $note) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ApprovalStatus::Pending) {
                throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
            }

            $locked->actions()->create([
                'step_order' => $locked->current_step,
                'user_id' => $submitter->id,
                'action' => ApprovalActionType::Cancel,
                'note' => $note,
            ]);

            $locked->update(['status' => ApprovalStatus::Cancelled]);

            if ($locked->approvable instanceof HandlesApprovalOutcome) {
                $locked->approvable->onApprovalCancelled();
            }

            $request->setRawAttributes($locked->getAttributes());
        });
    }

    /** @return Collection<int, ApprovalRequest> */
    public function pendingFor(User $user): Collection
    {
        return ApprovalRequest::query()
            ->with([
                'definition',
                'steps',
                'creator',
                'approvable' => fn (MorphTo $morph) => $morph->morphWith([
                    BeritaAcaraPenerimaan::class => ['unit'],
                    AssetMutation::class => ['originUnit', 'destinationUnit'],
                ]),
            ])
            ->where('status', ApprovalStatus::Pending)
            ->get()
            ->filter(fn (ApprovalRequest $r) => $this->canAct($user, $r))
            ->values();
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
    private function approversFor(ApprovalRequestStep $step, Model $approvable): Collection
    {
        $candidates = match ($step->approver_type) {
            ApproverType::User => User::whereKey($step->approver_user_id)->get(),
            ApproverType::AtasanUnit => User::role($this->atasanRole($approvable))->get(),
            ApproverType::Role => User::role($step->approver_role)->get(),
        };

        return $candidates->filter(fn (User $u) => $this->stepAllows($u, $step, $approvable))->values();
    }

    private function stepAllows(User $user, ApprovalRequestStep $step, Model $approvable): bool
    {
        return match ($step->approver_type) {
            ApproverType::User => $step->approver_user_id !== null && $user->id === $step->approver_user_id,
            ApproverType::AtasanUnit => $this->allowsAtasanUnit($user, $approvable),
            ApproverType::Role => $step->approver_role !== null
                && $user->hasRole($step->approver_role)
                && $this->inUnitScope($user, $step->unit_scope, $approvable),
        };
    }

    private function allowsAtasanUnit(User $user, Model $approvable): bool
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit
            && $user->hasRole($unit->isKecamatan() ? 'camat' : 'lurah')
            && $user->canAccessUnit($unit);
    }

    private function atasanRole(Model $approvable): string
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit && $unit->isKecamatan() ? 'camat' : 'lurah';
    }

    private function inUnitScope(User $user, UnitScope $scope, Model $approvable): bool
    {
        return match ($scope) {
            UnitScope::None => true,
            UnitScope::Subject => $user->canAccessUnit($approvable->unit),
            UnitScope::Origin => $approvable instanceof HasWorkflowUnits
                && $user->canAccessUnit($approvable->getOriginUnit()),
            UnitScope::Destination => $approvable instanceof HasWorkflowUnits
                && $user->canAccessUnit($approvable->getDestinationUnit()),
        };
    }
}
