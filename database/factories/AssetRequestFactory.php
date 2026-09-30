<?php

namespace Database\Factories;

use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetRequest> */
class AssetRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nomor_permohonan' => 'PM/'.now()->year.'/'.str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'jenis' => 'pegawai',
            'pegawai_id' => fn () => Pegawai::factory()->create()->id,
            'unit_id' => fn (array $attrs) => Pegawai::find($attrs['pegawai_id'])->unit_id,
            'category_id' => fn () => AssetCategory::factory()->subcategory()->create()->id,
            'jumlah' => 1,
            'keterangan' => 'Butuh laptop untuk pekerjaan harian.',
            'status' => 'pending',
            'created_by' => fn () => User::factory()->create()->id,
        ];
    }

    public function unitRequest(): static
    {
        return $this->state(function () {
            $kecamatan = Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan']);
            $kelurahan = Unit::create(['name' => 'Kelurahan '.fake()->unique()->word(), 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);

            return ['jenis' => 'unit', 'pegawai_id' => null, 'unit_id' => $kelurahan->id, 'jumlah' => 2];
        });
    }
}
