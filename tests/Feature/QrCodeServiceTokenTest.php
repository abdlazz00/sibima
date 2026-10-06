<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Services\QrCodeService;

it('generates scan URL using qr_token instead of numeric database id', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $parent = AssetCategory::create(['name' => 'Peralatan dan Mesin', 'code' => '02']);
    $category = AssetCategory::create([
        'name' => 'Peralatan Komputer',
        'code' => '02.06.01.02.001',
        'parent_id' => $parent->id,
    ]);

    $asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Meja Kerja',
        'category_id' => $category->id,
        'unit_id' => $unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 1000000,
        'nilai_buku' => 1000000,
    ]);

    $service = app(QrCodeService::class);
    $url = $service->urlForAsset($asset);

    expect($url)->toBe(rtrim(config('app.url'), '/') . '/scan/' . $asset->qr_token)
        ->and($url)->not->toBe(rtrim(config('app.url'), '/') . '/scan/' . $asset->id);
});
