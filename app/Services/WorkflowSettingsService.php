<?php

namespace App\Services;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\User;
use App\Models\WorkflowChangeLog;
use App\Models\WorkflowDefinition;
use App\Support\WorkflowDefaults;
use Illuminate\Support\Facades\DB;

class WorkflowSettingsService
{
    /** @param  list<array<string, mixed>>  $steps */
    public function update(WorkflowDefinition $workflow, array $steps, User $by): void
    {
        DB::transaction(function () use ($workflow, $steps, $by) {
            $before = $this->snapshot($workflow);

            $workflow->steps()->delete();
            foreach (array_values($steps) as $i => $step) {
                $workflow->steps()->create($this->normalize($step, $i + 1));
            }

            $this->log($workflow, $by, 'update', $before);
        });
    }

    public function reset(WorkflowDefinition $workflow, User $by): void
    {
        DB::transaction(function () use ($workflow, $by) {
            $before = $this->snapshot($workflow);

            WorkflowDefaults::applyTo($workflow);

            $this->log($workflow, $by, 'reset', $before);
        });
    }

    /** @return list<array<string, mixed>> */
    public function snapshot(WorkflowDefinition $workflow): array
    {
        return $workflow->steps()->get()->map(fn ($s) => [
            'step_order' => $s->step_order,
            'label' => $s->label,
            'approver_type' => $s->approver_type->value,
            'approver_role' => $s->approver_role,
            'approver_user_id' => $s->approver_user_id,
            'unit_scope' => $s->unit_scope->value,
        ])->all();
    }

    /** @return array<string, mixed> */
    private function normalize(array $step, int $order): array
    {
        $type = ApproverType::from($step['approver_type']);

        return [
            'step_order' => $order,
            'label' => trim($step['label']),
            'approver_type' => $type,
            'approver_role' => $type === ApproverType::Role ? $step['approver_role'] : null,
            'approver_user_id' => $type === ApproverType::User ? (int) $step['approver_user_id'] : null,
            'unit_scope' => match ($type) {
                ApproverType::Role => UnitScope::from($step['unit_scope'] ?? 'none'),
                ApproverType::User => UnitScope::None,
                ApproverType::AtasanUnit => UnitScope::Subject,
            },
        ];
    }

    /** @param  list<array<string, mixed>>  $before */
    private function log(WorkflowDefinition $workflow, User $by, string $event, array $before): void
    {
        $workflow->unsetRelation('steps');

        WorkflowChangeLog::create([
            'workflow_definition_id' => $workflow->id,
            'user_id' => $by->id,
            'event' => $event,
            'steps_before' => $before,
            'steps_after' => $this->snapshot($workflow),
        ]);
    }
}
