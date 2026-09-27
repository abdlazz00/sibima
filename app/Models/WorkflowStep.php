<?php

namespace App\Models;

use App\Enums\UnitScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStep extends Model
{
    protected $fillable = ['workflow_definition_id', 'step_order', 'approver_role', 'unit_scope'];

    protected function casts(): array
    {
        return ['unit_scope' => UnitScope::class, 'step_order' => 'integer'];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }
}
