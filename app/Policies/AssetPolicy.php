<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

class AssetPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('aset.view');
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->can('aset.view') && $user->canAccessUnit($asset->unit);
    }

    public function create(User $user): bool
    {
        return $user->can('aset.create') && $user->unit_id !== null;
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->can('aset.update') && $user->canAccessUnit($asset->unit);
    }

    public function delete(User $user, Asset $asset): bool
    {
        return $user->can('aset.delete') && $user->canAccessUnit($asset->unit);
    }
}
