<?php

namespace App\Repositories\Contracts;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AssetRepositoryInterface
{
    /**
     * @param  array{search?: ?string, category_id?: int|string|null, unit_id?: int|string|null, kondisi?: ?string}  $filters
     */
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator;

    public function maxRegisterNumber(string $kodeBarang): int;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Asset;

    /** @param array<string, mixed> $attributes */
    public function update(Asset $asset, array $attributes): Asset;
}
