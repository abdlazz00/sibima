<?php

namespace App\Repositories;

use App\Models\AssetMutation;
use App\Models\User;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AssetMutationRepository implements AssetMutationRepositoryInterface
{
    public function createWithItems(array $data, array $items): AssetMutation
    {
        return DB::transaction(function () use ($data, $items) {
            $mutation = AssetMutation::create($data);
            $mutation->items()->createMany($items);

            return $mutation;
        });
    }

    public function findById(int $id): ?AssetMutation
    {
        return AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items.asset', 'items.targetHolder', 'approvalRequest.actions.user', 'photos'])->find($id);
    }

    public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator
    {
        $query = AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items'])
            ->latest('tanggal_mutasi')
            ->latest('id');

        $accessibleUnitIds = $user->accessibleUnitIds();
        if ($accessibleUnitIds !== null) {
            $query->where(function ($q) use ($accessibleUnitIds) {
                $q->whereIn('origin_unit_id', $accessibleUnitIds)
                    ->orWhereIn('destination_unit_id', $accessibleUnitIds);
            });
        }

        return $query->paginate($perPage);
    }
}
