<?php

namespace App\Policies;

use App\Models\AssetCategory;
use App\Models\User;

class AssetCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('kasubag');
    }

    public function update(User $user, AssetCategory $category): bool
    {
        return $user->hasRole('kasubag');
    }

    public function delete(User $user, AssetCategory $category): bool
    {
        return $user->hasRole('kasubag');
    }
}
