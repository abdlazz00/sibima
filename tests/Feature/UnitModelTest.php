<?php

use App\Models\Unit;

it('creates a kecamatan with no parent', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);

    expect($unit->isKecamatan())->toBeTrue()
        ->and($unit->parent_id)->toBeNull();
});

it('creates a kelurahan as a child of a kecamatan', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $kelurahan = Unit::create([
        'name' => 'Kelurahan Sagulung Kota',
        'type' => 'kelurahan',
        'parent_id' => $kecamatan->id,
    ]);

    expect($kelurahan->isKelurahan())->toBeTrue()
        ->and($kelurahan->parent->id)->toBe($kecamatan->id)
        ->and($kecamatan->children->pluck('id')->all())->toBe([$kelurahan->id]);
});

it('rejects a kelurahan without a parent_id', function () {
    Unit::create(['name' => 'Kelurahan Tanpa Induk', 'type' => 'kelurahan']);
})->throws(InvalidArgumentException::class);

it('rejects a kecamatan that has a parent_id', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);

    Unit::create([
        'name' => 'Kecamatan Lain',
        'type' => 'kecamatan',
        'parent_id' => $kecamatan->id,
    ]);
})->throws(InvalidArgumentException::class);

it('rejects a kelurahan whose parent is itself a kelurahan', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $kelurahanA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);

    Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $kelurahanA->id]);
})->throws(InvalidArgumentException::class);

it('prevents deleting a kecamatan that still has kelurahan', function () {
    $kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);

    $kecamatan->delete();
})->throws(\Illuminate\Database\QueryException::class);
