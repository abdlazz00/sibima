<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;

beforeEach(function () {
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $parent = AssetCategory::create(['name' => 'Peralatan dan Mesin', 'code' => '02']);
    $this->category = AssetCategory::create([
        'name' => 'Peralatan Komputer',
        'code' => '02.06.01.02.001',
        'parent_id' => $parent->id,
    ]);
});

it('automatically generates a 16-character alphanumeric qr_token on asset creation', function () {
    $asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop ThinkPad X1',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 15000000,
        'nilai_buku' => 15000000,
    ]);

    expect($asset->qr_token)->not->toBeNull()
        ->and(strlen($asset->qr_token))->toBe(16)
        ->and(preg_match('/^[A-Za-z0-9]{16}$/', $asset->qr_token))->toBe(1);
});

it('ensures distinct qr_tokens for newly created assets and recreating deleted register', function () {
    $asset1 = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop A',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    $oldToken = $asset1->qr_token;

    // Hapus aset 1
    $asset1->delete();

    // Buat aset baru dengan nomor register yang sama
    $asset2 = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop A Baru',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-02-15',
        'nilai_perolehan' => 12000000,
        'nilai_buku' => 12000000,
    ]);

    expect($asset2->qr_token)->not->toBe($oldToken)
        ->and(strlen($asset2->qr_token))->toBe(16);
});
