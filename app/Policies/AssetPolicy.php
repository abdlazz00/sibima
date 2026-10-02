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
        return $user->can('aset.view') || $user->hasAnyRole(self::VIEWERS);
    }

    public function view(User $user, Asset $asset): bool
    {
        $hasPermission = $user->can('aset.view') || $user->hasAnyRole(self::VIEWERS);

        return $hasPermission && $user->canAccessUnit($asset->unit);
    }

    public function create(User $user): bool
    {
        $hasPermission = $user->can('aset.create') || $user->hasAnyRole(self::EDITORS);

        return $hasPermission && $user->unit_id !== null;
    }

    public function update(User $user, Asset $asset): bool
    {
        $hasPermission = $user->can('aset.update') || $user->hasAnyRole(self::EDITORS);

        return $hasPermission && $user->canAccessUnit($asset->unit) && $user->unit_id === $asset->unit_id;
    }

    public function delete(User $user, Asset $asset): bool
    {
        $hasPermission = $user->can('aset.delete') || $user->hasAnyRole(self::EDITORS);

        return $hasPermission && $user->canAccessUnit($asset->unit) && $user->unit_id === $asset->unit_id;
    }
}
