<?php

namespace App\Contracts;

use App\Models\Unit;

interface HasWorkflowUnits
{
    public function getOriginUnit(): Unit;

    public function getDestinationUnit(): Unit;
}
