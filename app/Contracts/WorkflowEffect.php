<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;

interface WorkflowEffect
{
    public function apply(Model $approvable): void;
}
