<?php

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::firstOrCreate(
            ['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan'],
        );

        collect([
            'Kelurahan Sagulung Kota',
            'Kelurahan Sungai Binti',
            'Kelurahan Sungai Langkai',
            'Kelurahan Sungai Lekop',
            'Kelurahan Sungai Pelunggut',
            'Kelurahan Tembesi',
        ])->each(fn (string $name) => Unit::firstOrCreate(
            ['name' => $name, 'type' => 'kelurahan'],
            ['parent_id' => $kecamatan->id],
        ));

        Unit::where('name', 'Kelurahan Sungai Buluh')->delete();
    }
}
