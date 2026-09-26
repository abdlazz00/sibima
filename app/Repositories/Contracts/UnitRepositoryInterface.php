<?php

namespace App\Repositories\Contracts;

use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

interface UnitRepositoryInterface
{
    /** @return Collection<int, Unit> */
    public function accessibleBy(User $user): Collection;
}
