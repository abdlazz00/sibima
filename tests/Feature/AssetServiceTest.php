<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Services\AssetService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->sub = AssetCategory::factory()->subcategory()->create();
    $this->service = app(AssetService::class);

    $this->data = fn (array $overrides = []) => array_merge([
        'kode_barang' => '1.3.2.05.02.04.004',
        'nama_aset' => 'A.C. Split',
        'category_id' => $this->sub->id,
        'merk_type' => 'PANASONIC',
        'kondisi' => 'baik',
        'tanggal_perolehan' => '2023-06-14',
        'sumber_perolehan' => null,
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 1250000,
        'no_dokumen' => null,
        'keterangan' => null,
    ], $overrides);
});

it('numbers registers consecutively per kode_barang', function () {
    $first = $this->service->create(($this->data)(), [], $this->admin);
    $second = $this->service->create(($this->data)(), [], $this->admin);
    $otherCode = $this->service->create(($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), [], $this->admin);

    expect($first->nomor_register)->toBe(1)
        ->and($second->nomor_register)->toBe(2)
        ->and($otherCode->nomor_register)->toBe(1);
});

it('continues numbering from the max even when that asset lives in another unit', function () {
    Asset::factory()->create(['kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 41, 'unit_id' => $this->kel->id]);

    $asset = $this->service->create(($this->data)(), [], $this->admin);

    expect($asset->nomor_register)->toBe(42);
});

it('places the asset in the creator unit as aktif and records a history entry', function () {
    $asset = $this->service->create(($this->data)(['kondisi' => 'rusak_ringan']), [], $this->admin);

    $history = $asset->histories()->first();

    expect($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->kondisi)->toBe(Kondisi::RusakRingan)
        ->and($history->event)->toBe('dibuat')
        ->and($history->user_id)->toBe($this->admin->id)
        ->and($history->unit_id)->toBe($this->kec->id)
        ->and($history->kondisi)->toBe(Kondisi::RusakRingan);
});

it('ignores unit, status and holder fields smuggled into create data', function () {
    $asset = $this->service->create(($this->data)([
        'unit_id' => $this->kel->id,
        'status' => 'dalam_proses',
        'current_holder_id' => $this->admin->id,
        'nomor_register' => 999,
    ]), [], $this->admin);

    expect($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->current_holder_id)->toBeNull()
        ->and($asset->nomor_register)->toBe(1);
});

it('stores uploaded photos on the public disk', function () {
    $asset = $this->service->create(($this->data)(), [
        UploadedFile::fake()->create('depan.jpg', 200, 'image/jpeg'),
        UploadedFile::fake()->create('samping.jpg', 200, 'image/jpeg'),
    ], $this->admin);

    expect($asset->photos)->toHaveCount(2);
    foreach ($asset->photos as $photo) {
        expect($photo->path)->toStartWith("assets/{$asset->id}/");
        Storage::disk('public')->assertExists($photo->path);
    }
});

it('updates descriptive fields only', function () {
    $asset = $this->service->create(($this->data)(), [], $this->admin);

    $this->service->update($asset, ($this->data)([
        'nama_aset' => 'AC Split 1 PK',
        'kondisi' => 'hilang',
        'unit_id' => $this->kel->id,
        'status' => 'dalam_proses',
    ]), []);

    $asset->refresh();

    expect($asset->nama_aset)->toBe('AC Split 1 PK')
        ->and($asset->kondisi)->toBe(Kondisi::Baik)
        ->and($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif);
});

it('reassigns the register number when kode_barang changes', function () {
    $this->service->create(($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), [], $this->admin);
    $asset = $this->service->create(($this->data)(), [], $this->admin);

    $this->service->update($asset, ($this->data)(['kode_barang' => '1.3.2.10.02.03.004']), []);

    expect($asset->refresh()->nomor_register)->toBe(2)
        ->and($asset->kode_barang)->toBe('1.3.2.10.02.03.004');
});

it('deletes a photo file and row', function () {
    $asset = $this->service->create(($this->data)(), [UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg')], $this->admin);
    $photo = $asset->photos()->first();

    $this->service->deletePhoto($photo);

    Storage::disk('public')->assertMissing($photo->path);
    expect($asset->photos()->count())->toBe(0);
});
