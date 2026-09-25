<?php

namespace App\Models;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use InvalidArgumentException;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'kode_barang',
        'nomor_register',
        'nama_aset',
        'category_id',
        'unit_id',
        'current_holder_id',
        'merk_type',
        'kondisi',
        'status',
        'tanggal_perolehan',
        'sumber_perolehan',
        'nilai_perolehan',
        'nilai_buku',
        'no_dokumen',
        'keterangan',
    ];

    protected function casts(): array
    {
        return [
            'nomor_register' => 'integer',
            'category_id' => 'integer',
            'unit_id' => 'integer',
            'current_holder_id' => 'integer',
            'kondisi' => Kondisi::class,
            'status' => AssetStatus::class,
            'tanggal_perolehan' => 'date:Y-m-d',
            'nilai_perolehan' => 'decimal:2',
            'nilai_buku' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Asset $asset) {
            if ($asset->exists && ! $asset->isDirty('category_id')) {
                return;
            }

            $category = AssetCategory::find($asset->category_id);

            if ($category === null || ! $category->isSubcategory()) {
                throw new InvalidArgumentException('Aset harus memakai subkategori, bukan kategori utama.');
            }
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(AssetHistory::class)->latest()->latest('id');
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids !== null) {
            $query->whereIn('unit_id', $ids);
        }
    }

    public function registerLabel(): string
    {
        return str_pad((string) $this->nomor_register, 4, '0', STR_PAD_LEFT);
    }
}
