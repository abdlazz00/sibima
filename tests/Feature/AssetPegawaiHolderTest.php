<?php

use App\Models\Asset;
use App\Models\Pegawai;

it('links Asset.currentHolder to a Pegawai', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id]);

    expect($asset->currentHolder)->toBeInstanceOf(Pegawai::class)
        ->and($asset->currentHolder->id)->toBe($pegawai->id);
});

it('links AssetHistory.currentHolder to a Pegawai', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create();
    $history = $asset->histories()->create([
        'event' => 'dipegang',
        'unit_id' => $asset->unit_id,
        'current_holder_id' => $pegawai->id,
        'kondisi' => 'baik',
    ]);

    expect($history->currentHolder)->toBeInstanceOf(Pegawai::class)
        ->and($history->currentHolder->id)->toBe($pegawai->id);
});

it('nulls current_holder_id on the asset when the pegawai is deleted', function () {
    $pegawai = Pegawai::factory()->create();
    $asset = Asset::factory()->create(['current_holder_id' => $pegawai->id]);

    $pegawai->delete();

    expect($asset->refresh()->current_holder_id)->toBeNull();
});
