<?php

use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);
});

it('creates a draft berita acara with items and casts fields correctly', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/001/IX/2025',
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/001/IX/2025',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'draft',
    ]);

    $item = $ba->items()->create([
        'nama_aset' => 'AC Split Daikin 1.5PK',
        'merk_type' => 'FTXM35 Inverter',
        'category_id' => $this->category->id,
        'jumlah_unit' => 3,
        'nilai_per_unit' => 5500000,
        'kondisi_awal' => 'baik',
    ]);

    expect($ba->status)->toBe(BeritaAcaraStatus::Draft)
        ->and($ba->items)->toHaveCount(1)
        ->and($item->kondisi_awal)->toBe(Kondisi::Baik)
        ->and($item->category->id)->toBe($this->category->id)
        ->and($ba->unit->id)->toBe($this->kec->id)
        ->and($ba->creator->id)->toBe($this->admin->id);
});

it('attaches supporting documents via the existing polymorphic photo table', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/002/IX/2025',
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/002/IX/2025',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'draft',
    ]);

    $ba->photos()->create(['path' => 'berita-acara/1/dokumen.pdf']);

    expect($ba->photos)->toHaveCount(1)
        ->and($ba->photos->first()->url)->toContain('berita-acara/1/dokumen.pdf');
});
