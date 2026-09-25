<?php

use App\Models\AssetCategory;
use Illuminate\Database\QueryException;

it('creates a kategori with subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $sub = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $kategori->id]);

    expect($kategori->isSubcategory())->toBeFalse()
        ->and($sub->isSubcategory())->toBeTrue()
        ->and($sub->parent->id)->toBe($kategori->id)
        ->and($kategori->children->pluck('name')->all())->toBe(['ALAT PENDINGIN']);
});

it('rejects a third level under a subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $kategori->id]);

    AssetCategory::create(['name' => 'TERLALU DALAM', 'parent_id' => $sub->id]);
})->throws(InvalidArgumentException::class);

it('rejects making a category its own parent', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT STUDIO']);

    $kategori->update(['parent_id' => $kategori->id]);
})->throws(InvalidArgumentException::class);

it('rejects demoting a kategori that has subkategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $a->id]);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);

    $a->update(['parent_id' => $b->id]);
})->throws(InvalidArgumentException::class);

it('rejects a duplicate subkategori name under the same kategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);

    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);
})->throws(QueryException::class);

it('prevents deleting a kategori that still has subkategori', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);

    $kategori->delete();
})->throws(QueryException::class);
