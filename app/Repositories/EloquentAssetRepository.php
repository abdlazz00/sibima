<?php

namespace App\Repositories;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class EloquentAssetRepository implements AssetRepositoryInterface
{
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator
    {
        return Asset::query()
            ->visibleTo($user)
            ->with(['category.parent', 'unit'])
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $query) use ($search) {
                    $query->where('nama_aset', 'like', "%{$search}%")
                        ->orWhere('kode_barang', 'like', "%{$search}%")
                        ->orWhere('no_dokumen', 'like', "%{$search}%");
                });
            })
            ->when($filters['category_id'] ?? null, function (Builder $query, $categoryId) {
                $query->whereIn('category_id', AssetCategory::query()
                    ->where('id', $categoryId)
                    ->orWhere('parent_id', $categoryId)
                    ->pluck('id'));
            })
            ->when($filters['unit_id'] ?? null, fn (Builder $query, $unitId) => $query->where('unit_id', $unitId))
            ->when($filters['kondisi'] ?? null, fn (Builder $query, $kondisi) => $query->where('kondisi', $kondisi))
            ->orderBy('nama_aset')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function maxRegisterNumber(string $kodeBarang): int
    {
        return (int) Asset::query()
            ->where('kode_barang', $kodeBarang)
            ->lockForUpdate()
            ->max('nomor_register');
    }

    public function create(array $attributes): Asset
    {
        return Asset::create($attributes);
    }

    public function update(Asset $asset, array $attributes): Asset
    {
        $asset->update($attributes);

        return $asset;
    }

    public function findMany(array $ids): Collection
    {
        return Asset::query()
            ->with('unit')
            ->whereIn('id', $ids)
            ->orderBy('kode_barang')
            ->orderBy('nomor_register')
            ->get();
    }
}
