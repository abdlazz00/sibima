<?php

use App\Models\Asset;
use App\Models\Unit;
use Database\Seeders\AssetCategorySeeder;
use Database\Seeders\AssetExcelSeeder;
use Database\Seeders\PegawaiSeeder;
use Database\Seeders\UnitSeeder;

it('seeds real assets and matches holders to real pegawais', function () {
    $this->seed([
        UnitSeeder::class,
        AssetCategorySeeder::class,
        PegawaiSeeder::class,
        AssetExcelSeeder::class,
    ]);

    expect(Asset::count())->toBe(331)
        ->and(Asset::whereNull('current_holder_id')->count())->toBe(0)
        ->and(Asset::whereNull('qr_token')->count())->toBe(0);

    $sampleAsset = Asset::with(['currentHolder', 'unit'])->first();
    expect($sampleAsset->currentHolder)->not->toBeNull()
        ->and(strlen($sampleAsset->qr_token))->toBe(16);

    $kecamatan = Unit::where('type', 'kecamatan')->first();
    $kecamatanAssets = Asset::where('unit_id', $kecamatan->id)->count();
    expect($kecamatanAssets)->toBe(230);
});
