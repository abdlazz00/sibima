<?php

namespace App\Models;

use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BeritaAcaraItem extends Model
{
    protected $fillable = [
        'berita_acara_penerimaan_id', 'nama_aset', 'merk_type', 'category_id',
        'jumlah_unit', 'nilai_per_unit', 'kondisi_awal', 'asset_ids',
    ];

    protected function casts(): array
    {
        return [
            'jumlah_unit' => 'integer',
            'nilai_per_unit' => 'decimal:2',
            'kondisi_awal' => Kondisi::class,
            'asset_ids' => 'array',
        ];
    }

    public function beritaAcara(): BelongsTo
    {
        return $this->belongsTo(BeritaAcaraPenerimaan::class, 'berita_acara_penerimaan_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }
}
