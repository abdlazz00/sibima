<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;

class AssetReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('laporan-insiden.view') || $user->getRoleNames()->isNotEmpty();
    }

    public function view(User $user, AssetReport $report): bool
    {
        return $user->canAccessUnit($report->unit);
    }

    public function create(User $user, ?Asset $asset = null): bool
    {
        $hasPermission = $user->can('laporan-insiden.create') || $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']);

        if (! $hasPermission || $user->unit_id === null) {
            return false;
        }

        return $asset === null || $user->canAccessUnit($asset->unit);
    }
}
