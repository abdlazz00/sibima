<?php

namespace App\Repositories;

use App\Models\AssetMutation;
use App\Models\User;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use App\Support\ListSort;
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

    public function paginateForUser(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items'])
            ->when($filters['jenis'] ?? null, fn ($q, $jenis) => $q->where('jenis_mutasi', $jenis))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('nomor_mutasi', 'like', "%{$search}%")
                ->orWhereHas('items.asset', fn ($a) => $a->where('nama_aset', 'like', "%{$search}%"))
                ->orWhereHas('originUnit', fn ($u) => $u->where('name', 'like', "%{$search}%"))
                ->orWhereHas('destinationUnit', fn ($u) => $u->where('name', 'like', "%{$search}%"))
            ));

        ListSort::apply($query, AssetMutation::SORTS, $filters['urut'] ?? null);

        $accessibleUnitIds = $user->accessibleUnitIds();
        if ($accessibleUnitIds !== null) {
            $query->where(function ($q) use ($accessibleUnitIds) {
                $q->whereIn('origin_unit_id', $accessibleUnitIds)
                    ->orWhereIn('destination_unit_id', $accessibleUnitIds);
            });
        }

        return $query->paginate($perPage)->withQueryString();
    }
}
