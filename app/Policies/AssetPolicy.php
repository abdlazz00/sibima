<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

class AssetPolicy
{
    private const VIEWERS = ['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'];

    private const EDITORS = ['admin_kecamatan', 'admin_kelurahan'];

    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(self::VIEWERS);
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->hasAnyRole(self::VIEWERS) && $user->canAccessUnit($asset->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(self::EDITORS) && $user->unit_id !== null;
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->hasAnyRole(self::EDITORS) && $user->unit_id === $asset->unit_id;
    }
}
