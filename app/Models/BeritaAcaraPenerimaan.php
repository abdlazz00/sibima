<?php

namespace App\Models;

use App\Enums\BeritaAcaraStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class BeritaAcaraPenerimaan extends Model
{
    use HasFactory;

    protected $fillable = [
        'no_berita_acara', 'tanggal_penerimaan', 'sumber_perolehan',
        'no_kontrak_spk', 'vendor', 'catatan', 'unit_id', 'created_by', 'status',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_penerimaan' => 'date:Y-m-d',
            'status' => BeritaAcaraStatus::class,
            'unit_id' => 'integer',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(BeritaAcaraItem::class);
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function approvalTitle(): string
    {
        return "Penerimaan Aset #{$this->no_berita_acara}";
    }

    public function approvalShowUrl(): string
    {
        return route('penerimaan-aset.show', $this);
    }
}
