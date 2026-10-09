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
        return $user->can('permohonan.view');
    }

    public function view(User $user, AssetRequest $request): bool
    {
        if ($user->canAccessUnit($request->unit)) {
            return true;
        }

        return $request->jenis === AssetRequestType::Unit
            && $user->can('permohonan.fulfill')
            && $request->unit->parent_id === $user->unit_id;
    }

    public function create(User $user): bool
    {
        return $user->can('permohonan.create') && $user->unit_id !== null;
    }

    public function fulfill(User $user, AssetRequest $request): bool
    {
        return app(AssetRequestService::class)->canFulfill($user, $request);
    }

    public function close(User $user, AssetRequest $request): bool
    {
        return app(AssetRequestService::class)->canClose($user, $request);
    }
}
