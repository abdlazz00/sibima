<?php

namespace App\Repositories;

use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class EloquentAssetCategoryRepository implements AssetCategoryRepositoryInterface
{
    public function tree(): Collection
    {
        return AssetCategory::query()
            ->whereNull('parent_id')
            ->withCount('assets')
            ->with(['children' => fn ($query) => $query->withCount('assets')])
            ->orderBy('name')
            ->get();
    }

    public function create(array $attributes): AssetCategory
    {
        return AssetCategory::create($attributes);
    }

    public function update(AssetCategory $category, array $attributes): AssetCategory
    {
        $category->update($attributes);

        return $category;
    }

    public function delete(AssetCategory $category): void
    {
        $category->delete();
    }

    public function hasDependents(AssetCategory $category): bool
    {
        return $category->children()->exists() || $category->assets()->exists();
    }
}
