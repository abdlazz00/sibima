<?php

namespace Database\Factories;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Asset> */
class AssetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'kode_barang' => '1.3.2.05.02.04.004',
            'nomor_register' => fake()->unique()->numberBetween(1, 999999),
            'nama_aset' => 'A.C. Split',
            'category_id' => fn () => AssetCategory::factory()->subcategory()->create()->id,
            'unit_id' => fn () => Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan'])->id,
            'merk_type' => 'PANASONIC',
            'kondisi' => Kondisi::Baik,
            'status' => AssetStatus::Aktif,
            'tanggal_perolehan' => '2023-06-14',
            'nilai_perolehan' => 5000000,
            'nilai_buku' => 1250000,
        ];
    }
}
