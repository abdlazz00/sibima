<?php

namespace App\Repositories\Contracts;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

interface AssetRepositoryInterface
{
    /**
     * @param  array{search?: ?string, category_id?: int|string|null, unit_id?: int|string|null, kondisi?: ?string}  $filters
     */
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator;

    /**
     * Query aset yang terlihat oleh user, sudah berfilter dan berurutan (dipakai daftar dan ekspor).
     *
     * @param  array{search?: ?string, category_id?: int|string|null, unit_id?: int|string|null, kondisi?: ?string}  $filters
     */
    public function queryVisibleTo(User $user, array $filters): Builder;

    public function maxRegisterNumber(string $kodeBarang): int;

    public function maxKodeBarangSuffix(string $prefix): int;

    public function findExistingKodeBarang(int $categoryId, string $namaAset): ?string;

    /**
     * @param  list<int>  $ids
     * @return Collection<int, Asset>
     */
    public function findMany(array $ids): Collection;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Asset;

    /** @param array<string, mixed> $attributes */
    public function update(Asset $asset, array $attributes): Asset;
}
