<?php

namespace App\Services;

use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use Illuminate\Validation\ValidationException;

class AssetCategoryService
{
    public function __construct(private readonly AssetCategoryRepositoryInterface $categories) {}

    /** @param array{name: string, parent_id?: int|null} $data */
    public function create(array $data): AssetCategory
    {
        return $this->categories->create($data);
    }

    /** @param array{name: string, parent_id?: int|null} $data */
    public function update(AssetCategory $category, array $data): AssetCategory
    {
        return $this->categories->update($category, $data);
    }

    public function delete(AssetCategory $category): void
    {
        if ($this->categories->hasDependents($category)) {
            throw ValidationException::withMessages([
                'category' => "Kategori \"{$category->name}\" masih dipakai (punya subkategori atau aset), tidak bisa dihapus.",
            ]);
        }

        $this->categories->delete($category);
    }
}
