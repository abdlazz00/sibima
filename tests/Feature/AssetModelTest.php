<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;

it('casts kondisi, status and tanggal_perolehan and links category and unit', function () {
    $asset = Asset::factory()->create(['kondisi' => 'rusak_ringan', 'tanggal_perolehan' => '2023-06-14']);

    expect($asset->kondisi)->toBe(Kondisi::RusakRingan)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->toArray()['tanggal_perolehan'])->toBe('2023-06-14')
        ->and($asset->category->isSubcategory())->toBeTrue()
        ->and($asset->unit)->toBeInstanceOf(Unit::class);
});

it('exposes kondisi options with Indonesian labels', function () {
    expect(Kondisi::options())->toBe([
        ['value' => 'baik', 'label' => 'Baik'],
        ['value' => 'rusak_ringan', 'label' => 'Rusak Ringan'],
        ['value' => 'rusak_berat', 'label' => 'Rusak Berat'],
        ['value' => 'hilang', 'label' => 'Hilang'],
    ]);
});

it('rejects an asset whose category is a top-level kategori', function () {
    $kategori = AssetCategory::factory()->create();

    Asset::factory()->create(['category_id' => $kategori->id]);
})->throws(InvalidArgumentException::class);

it('enforces a unique register number per kode_barang', function () {
    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 1]);

    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 1]);
})->throws(QueryException::class);

it('formats the register number as four digits', function () {
    expect(Asset::factory()->make(['nomor_register' => 7])->registerLabel())->toBe('0007');
});

it('stores photos polymorphically with a public url', function () {
    Storage::fake('public');
    $asset = Asset::factory()->create();

    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    expect($asset->photos()->count())->toBe(1)
        ->and($photo->photoable->is($asset))->toBeTrue()
        ->and($photo->url)->toContain("assets/{$asset->id}/a.jpg");
});

it('lists histories newest first', function () {
    $asset = Asset::factory()->create();
    $asset->histories()->create(['event' => 'dibuat', 'unit_id' => $asset->unit_id, 'kondisi' => 'baik', 'created_at' => now()->subDay()]);
    $asset->histories()->create(['event' => 'kondisi', 'unit_id' => $asset->unit_id, 'kondisi' => 'rusak_ringan']);

    expect($asset->histories()->pluck('event')->all())->toBe(['kondisi', 'dibuat']);
});

it('prevents deleting a unit that still holds assets', function () {
    $asset = Asset::factory()->create();

    $asset->unit->delete();
})->throws(QueryException::class);
