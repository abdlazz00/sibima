<?php

namespace App\Repositories\Contracts;

use App\Models\AssetCategory;
use Illuminate\Database\Eloquent\Collection;

interface AssetCategoryRepositoryInterface
{
    /** @return Collection<int, AssetCategory> */
    public function tree(): Collection;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): AssetCategory;

    /** @param array<string, mixed> $attributes */
    public function update(AssetCategory $category, array $attributes): AssetCategory;

    public function delete(AssetCategory $category): void;

    public function hasDependents(AssetCategory $category): bool;
}
