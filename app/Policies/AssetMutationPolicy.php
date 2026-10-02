<?php

namespace App\Policies;

use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;

class AssetMutationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('mutasi.view') || true;
    }

    public function view(User $user, AssetMutation $mutation): bool
    {
        $accessibleUnitIds = $user->accessibleUnitIds();

        if ($accessibleUnitIds === null) {
            return true;
        }

        return in_array($mutation->origin_unit_id, $accessibleUnitIds, true)
            || in_array($mutation->destination_unit_id, $accessibleUnitIds, true);
    }

    public function create(User $user, ?Unit $originUnit = null): bool
    {
        $hasPermission = $user->can('mutasi.create') || $user->hasRole(['admin_kecamatan', 'admin_kelurahan']);

        if (! $hasPermission) {
            return false;
        }

        if ($originUnit === null) {
            return true;
        }

        return $user->canAccessUnit($originUnit);
    }
}
