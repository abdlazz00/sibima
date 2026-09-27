<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ApprovalRequest extends Model
{
    protected $fillable = [
        'workflow_definition_id', 'approvable_type', 'approvable_id',
        'current_step', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return ['status' => ApprovalStatus::class, 'current_step' => 'integer'];
    }

    public function approvable(): MorphTo
    {
        return $this->morphTo();
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(ApprovalAction::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function currentStepDefinition(): ?WorkflowStep
    {
        return $this->definition->steps->firstWhere('step_order', $this->current_step);
    }

    public function isLastStep(): bool
    {
        return $this->current_step >= $this->definition->steps->max('step_order');
    }
}
