<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;

class AssetReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('laporan-insiden.view');
    }

    public function view(User $user, AssetReport $report): bool
    {
        return $user->canAccessUnit($report->unit);
    }

    public function create(User $user, ?Asset $asset = null): bool
    {
        if (! $user->can('laporan-insiden.create') || $user->unit_id === null) {
            return false;
        }

        return $asset === null || $user->canAccessUnit($asset->unit);
    }
}
