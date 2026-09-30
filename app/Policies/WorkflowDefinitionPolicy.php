<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkflowDefinition;

class WorkflowDefinitionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function update(User $user, WorkflowDefinition $workflow): bool
    {
        return $user->hasRole('kasubag');
    }
}
