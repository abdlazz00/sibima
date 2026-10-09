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
        $definition = WorkflowDefinition::where('code', $workflowCode)->first()
            ?? throw new InvalidArgumentException("Alur persetujuan '{$workflowCode}' belum dikonfigurasi. Jalankan WorkflowDefinitionSeeder.");

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
        if ($request->status !== ApprovalStatus::Pending || $user->id === $request->created_by) {
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

            if (! $this->canAct($approver, $locked)) {
                throw new InvalidArgumentException('Anda tidak lagi berwenang pada langkah ini.');
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

            if (! $this->canAct($approver, $locked)) {
                throw new InvalidArgumentException('Anda tidak lagi berwenang pada langkah ini.');
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

    public function canReassign(User $user, ApprovalRequest $request): bool
    {
        return $user->hasRole('kasubag') && $request->status === ApprovalStatus::Pending;
    }

    public function reassign(ApprovalRequest $request, User $by, User $to, string $note, ?int $expectedStep = null): void
    {
        if (! $this->canReassign($by, $request)) {
            throw new InvalidArgumentException('Hanya Kasubag yang dapat mengalihkan approver pengajuan yang masih pending.');
        }

        if ($to->getRoleNames()->isEmpty()) {
            throw new InvalidArgumentException('Approver tujuan harus memiliki akun dengan role yang valid.');
        }

        if ($to->id === $request->created_by) {
            throw new InvalidArgumentException('Approver tujuan tidak boleh pengaju pengajuan ini.');
        }

        DB::transaction(function () use ($request, $by, $to, $note, $expectedStep) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ApprovalStatus::Pending) {
                throw new InvalidArgumentException('Pengajuan ini sudah tidak menunggu persetujuan.');
            }

            if ($expectedStep !== null && $locked->current_step !== $expectedStep) {
                throw new InvalidArgumentException('Pengajuan sudah berpindah langkah. Muat ulang halaman lalu coba lagi.');
            }

            $step = $locked->currentStepDefinition();

            if ($step === null) {
                throw new InvalidArgumentException('Langkah pengajuan tidak ditemukan.');
            }

            $step->update([
                'approver_type' => ApproverType::User,
                'approver_role' => null,
                'approver_user_id' => $to->id,
                'unit_scope' => UnitScope::None,
            ]);

            $locked->actions()->create([
                'step_order' => $locked->current_step,
                'user_id' => $by->id,
                'action' => ApprovalActionType::Reassign,
                'note' => "Dialihkan dari {$step->label} ke {$to->name}: {$note}",
            ]);
        });

        $request->unsetRelation('steps');
        $this->notifyApprovers($request->fresh());
    }

    /** @return list<array{id: int, name: string, role: ?string, unit: ?string}> */
    public function reassignCandidates(): array
    {
        return User::whereHas('roles')->with(['roles', 'unit'])->orderBy('name')->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->getRoleNames()->first(),
                'unit' => $u->unit?->name,
            ])->all();
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

        $this->approversFor($step, $request->approvable)
            ->reject(fn (User $u) => $u->id === $request->created_by)
            ->each(
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
            ApproverType::AtasanUnit => User::whereHas('roles', fn ($q) => $q->where('unit_head_of', $this->unitKind($approvable)))->get(),
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
            && $user->roles->contains(fn ($role) => $role->unit_head_of === $this->unitKind($approvable))
            && $user->canAccessUnit($unit);
    }

    /** `kecamatan` atau `kelurahan` menurut jenis unit pengaju; role pimpinan dicocokkan dengan nilai ini. */
    private function unitKind(Model $approvable): ?string
    {
        $unit = $approvable->unit ?? null;

        return $unit instanceof Unit ? ($unit->isKecamatan() ? 'kecamatan' : 'kelurahan') : null;
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
