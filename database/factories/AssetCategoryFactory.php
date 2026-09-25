<?php

namespace Database\Factories;

use App\Models\AssetCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetCategory> */
class AssetCategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => strtoupper(fake()->unique()->words(2, true)),
            'parent_id' => null,
        ];
    }

    public function subcategory(): static
    {
        return $this->state(fn () => ['parent_id' => AssetCategory::factory()]);
    }
}
