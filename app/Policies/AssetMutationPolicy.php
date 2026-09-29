<?php

namespace App\Policies;

use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;

class AssetMutationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
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
        if (! $user->hasRole(['admin_kecamatan', 'admin_kelurahan'])) {
            return false;
        }

        if ($originUnit === null) {
            return true;
        }

        return $user->canAccessUnit($originUnit);
    }
}
