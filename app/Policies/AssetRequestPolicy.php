<?php

namespace App\Policies;

use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use App\Models\User;
use App\Services\AssetRequestService;

class AssetRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function view(User $user, AssetRequest $request): bool
    {
        if ($user->canAccessUnit($request->unit)) {
            return true;
        }

        return $request->jenis === AssetRequestType::Unit
            && $user->hasRole('admin_kecamatan')
            && $request->unit->parent_id === $user->unit_id;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->unit_id !== null;
    }

    public function fulfill(User $user, AssetRequest $request): bool
    {
        return app(AssetRequestService::class)->canFulfill($user, $request);
    }
}
