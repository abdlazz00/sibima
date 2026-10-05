<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMutationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'asset_mutation_id',
        'asset_id',
        'origin_holder_id',
        'target_holder_id',
        'catatan',
    ];

    protected function casts(): array
    {
        return [
            'asset_mutation_id' => 'integer',
            'asset_id' => 'integer',
            'origin_holder_id' => 'integer',
            'target_holder_id' => 'integer',
        ];
    }

    public function mutation(): BelongsTo
    {
        return $this->belongsTo(AssetMutation::class, 'asset_mutation_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    /** Pemegang aset saat diajukan (pemegang aset sekarang bisa sudah berubah setelah disetujui). */
    public function originHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'origin_holder_id');
    }

    public function targetHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'target_holder_id');
    }
}
