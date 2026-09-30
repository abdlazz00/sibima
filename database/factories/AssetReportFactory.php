<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetReport> */
class AssetReportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nomor_laporan' => 'LP/'.now()->year.'/'.str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'asset_id' => fn () => Asset::factory()->create()->id,
            'unit_id' => fn (array $attrs) => Asset::find($attrs['asset_id'])->unit_id,
            'pegawai_id' => null,
            'jenis' => 'rusak',
            'kondisi_baru' => 'rusak_ringan',
            'tanggal_kejadian' => now()->toDateString(),
            'kronologi' => 'Jatuh saat dipindahkan.',
            'status' => 'pending',
            'created_by' => fn () => User::factory()->create()->id,
        ];
    }
}
