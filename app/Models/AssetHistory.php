<?php

namespace App\Models;

use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetHistory extends Model
{
    protected $fillable = [
        'asset_id',
        'event',
        'unit_id',
        'current_holder_id',
        'kondisi',
        'user_id',
        'keterangan',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['kondisi' => Kondisi::class];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'current_holder_id');
    }
}
