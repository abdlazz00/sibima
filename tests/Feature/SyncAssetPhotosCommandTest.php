<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
    Storage::fake('public');
});

it('downloads and syncs photo for matching asset from spreadsheet', function () {
    Http::fake([
        'drive.usercontent.google.com/*' => Http::response('fake-binary-image-data', 200, ['Content-Type' => 'image/jpeg']),
        'drive.google.com/*' => Http::response('fake-binary-image-data', 200, ['Content-Type' => 'image/jpeg']),
    ]);

    $unit = Unit::first();
    $parent = AssetCategory::factory()->create(['name' => 'Elektronik', 'parent_id' => null]);
    $cat = AssetCategory::factory()->create(['name' => 'Pendingin', 'parent_id' => $parent->id]);

    // Create asset matching row 2 of PHOTO BARANG (KIB: 1.3.2.05.02.04.004, Reg: 1)
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.004',
        'nomor_register' => 1,
        'nama_aset' => 'A.C. Split',
        'category_id' => $cat->id,
        'unit_id' => $unit->id,
        'kondisi' => Kondisi::Baik,
        'status' => AssetStatus::Aktif,
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 1250000,
        'tanggal_perolehan' => '2023-06-14',
    ]);

    expect($asset->photos()->count())->toBe(0);

    // Run command with limit 1
    $this->artisan('sibima:sync-asset-photos', ['--limit' => 1])
        ->assertSuccessful();

    $asset->refresh();
    expect($asset->photos()->count())->toBe(1);

    $photo = $asset->photos()->first();
    expect($photo)->not->toBeNull();
    Storage::disk('public')->assertExists($photo->path);
});
