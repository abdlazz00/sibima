<?php

namespace App\Repositories\Contracts;

use App\Models\AssetMutation;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

interface AssetMutationRepositoryInterface
{
    public function createWithItems(array $data, array $items): AssetMutation;

    public function findById(int $id): ?AssetMutation;

    public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator;
}
