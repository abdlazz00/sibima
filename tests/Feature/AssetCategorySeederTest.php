<?php

use App\Models\AssetCategory;
use Database\Seeders\AssetCategorySeeder;

it('seeds official BMD codes for every known subkategori', function () {
    (new AssetCategorySeeder)->run();

    $expected = [
        'KENDARAAN BERMOTOR ANGKUTAN BARANG' => '1.3.2.02.01.03',
        'KENDARAAN BERMOTOR BERODA DUA' => '1.3.2.02.01.04',
        'KENDARAAN DINAS BERMOTOR PERORANGAN' => '1.3.2.02.01.01',
        'ALAT KANTOR LAINNYA' => '1.3.2.05.01.05',
        'ALAT PENYIMPAN PERLENGKAPAN KANTOR' => '1.3.2.05.01.04',
        'ALAT DAPUR' => '1.3.2.05.02.05',
        'ALAT PENDINGIN' => '1.3.2.05.02.04',
        'ALAT RUMAH TANGGA LAINNYA (HOME USE)' => '1.3.2.05.02.06',
        'MEUBELAIR' => '1.3.2.05.02.01',
        'PERALATAN STUDIO VIDEO DAN FILM' => '1.3.2.06.01.02',
        'PERSONAL KOMPUTER' => '1.3.2.10.01.02',
        'KURSI KERJA PEJABAT' => '1.3.2.05.03.03',
        'LEMARI DAN ARSIP PEJABAT' => '1.3.2.05.03.07',
        'MEJA KERJA PEJABAT' => '1.3.2.05.03.01',
        'PERALATAN PERSONAL KOMPUTER' => '1.3.2.10.02.03',
    ];

    foreach ($expected as $name => $code) {
        expect(AssetCategory::where('name', $name)->first()?->code)->toBe($code);
    }
});

it('is idempotent and backfills the code onto an already-seeded category', function () {
    $parent = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA', 'parent_id' => null]);
    AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $parent->id]);

    (new AssetCategorySeeder)->run();

    expect(AssetCategory::where('name', 'ALAT PENDINGIN')->first()->code)->toBe('1.3.2.05.02.04')
        ->and(AssetCategory::where('name', 'ALAT PENDINGIN')->count())->toBe(1);
});
