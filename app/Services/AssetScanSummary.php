<?php

namespace App\Services;

use App\Models\Asset;

/**
 * The only place that decides what a QR scan may reveal about an asset.
 * Keep it an explicit list: never serialise the model here.
 */
class AssetScanSummary
{
    /** @return array<string, mixed> */
    public function for(Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'nama_aset' => $asset->nama_aset,
            'kode_barang' => $asset->kode_barang,
            'nomor_register' => $asset->registerLabel(),
            'merk_type' => $asset->merk_type,
            'kategori' => $asset->category?->name,
            'unit' => $asset->unit?->name,
            'kondisi' => $asset->kondisi->value,
            'status' => $asset->status->value,
            'pemegang' => $asset->currentHolder?->nama,
            'foto' => $asset->photos->first()?->url,
        ];
    }
}
