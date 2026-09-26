<?php

namespace App\Repositories;

use App\Models\Unit;
use App\Models\User;
use App\Repositories\Contracts\UnitRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class EloquentUnitRepository implements UnitRepositoryInterface
{
    public function accessibleBy(User $user): Collection
    {
        $ids = $user->accessibleUnitIds();

        return Unit::query()
            ->when($ids !== null, fn ($query) => $query->whereIn('id', $ids))
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'name', 'type']);
    }
}
