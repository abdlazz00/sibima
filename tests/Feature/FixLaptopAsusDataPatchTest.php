<?php

use App\Models\Asset;
use App\Models\AssetCategory;

it('patches corrupted historical laptop assets into unified kode_barang and sequential register', function () {
    $cat = AssetCategory::where('code', '1.3.2.10.02.03')->first() ?? AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.02.03']);

    Asset::factory()->create(['id' => 332, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.005', 'nomor_register' => 1, 'nama_aset' => 'Laptop asus vivobook']);
    Asset::factory()->create(['id' => 333, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.006', 'nomor_register' => 1, 'nama_aset' => 'Laptop asus #1']);
    Asset::factory()->create(['id' => 334, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.007', 'nomor_register' => 1, 'nama_aset' => 'Laptop asus #1']);
    Asset::factory()->create(['id' => 335, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.008', 'nomor_register' => 1, 'nama_aset' => 'Laptop asus #1']);
    Asset::factory()->create(['id' => 336, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.009', 'nomor_register' => 1, 'nama_aset' => 'Laptop asus #1']);

    $migration = require database_path('migrations/2026_10_05_100000_fix_laptop_asus_register_and_codes.php');
    $migration->up();

    expect(Asset::find(332)->nomor_register)->toBe(1)
        ->and(Asset::find(333)->nomor_register)->toBe(2)
        ->and(Asset::find(334)->nomor_register)->toBe(3)
        ->and(Asset::find(335)->nomor_register)->toBe(4)
        ->and(Asset::find(336)->nomor_register)->toBe(5)
        ->and(Asset::find(332)->nama_aset)->toBe('Laptop asus #1')
        ->and(Asset::whereIn('id', [332, 333, 334, 335, 336])->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.10.02.03.005']);
});
