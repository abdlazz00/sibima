<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowChangeLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['workflow_definition_id', 'user_id', 'event', 'steps_before', 'steps_after'];

    protected function casts(): array
    {
        return ['steps_before' => 'array', 'steps_after' => 'array'];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
