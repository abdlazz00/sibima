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
use Illuminate\Support\Str;
use InvalidArgumentException;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'qr_token',
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

    /** Urutan Data Aset: kunci => label dan urutan kolom. `id` menjadi pembeda terakhir agar hasil stabil. */
    public const SORTS = [
        'nama_asc' => ['label' => 'Nama A-Z', 'order' => [['nama_aset', 'asc'], ['kode_barang', 'asc'], ['nomor_register', 'asc']]],
        'nama_desc' => ['label' => 'Nama Z-A', 'order' => [['nama_aset', 'desc'], ['kode_barang', 'asc'], ['nomor_register', 'asc']]],
        'terbaru' => ['label' => 'Terbaru ditambahkan', 'order' => [['created_at', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama ditambahkan', 'order' => [['created_at', 'asc'], ['id', 'asc']]],
        'tahun_desc' => ['label' => 'Tahun perolehan terbaru', 'order' => [['tanggal_perolehan', 'desc'], ['id', 'desc']]],
        'tahun_asc' => ['label' => 'Tahun perolehan terlama', 'order' => [['tanggal_perolehan', 'asc'], ['id', 'asc']]],
        'nilai_desc' => ['label' => 'Nilai perolehan tertinggi', 'order' => [['nilai_perolehan', 'desc'], ['id', 'desc']]],
        'nilai_asc' => ['label' => 'Nilai perolehan terendah', 'order' => [['nilai_perolehan', 'asc'], ['id', 'asc']]],
        'kode' => ['label' => 'Kode BMD', 'order' => [['kode_barang', 'asc'], ['nomor_register', 'asc']]],
    ];

    /** @return list<array{0: string, 1: string}> */
    public static function sortOrder(?string $key): array
    {
        return (self::SORTS[$key ?? ''] ?? self::SORTS['nama_asc'])['order'];
    }

    /** @return list<array{value: string, label: string}> */
    public static function sortOptions(): array
    {
        return array_map(
            fn (string $key) => ['value' => $key, 'label' => self::SORTS[$key]['label']],
            array_keys(self::SORTS),
        );
    }

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
        static::creating(function (Asset $asset) {
            if (empty($asset->qr_token)) {
                do {
                    $token = Str::random(16);
                } while (static::where('qr_token', $token)->exists());

                $asset->qr_token = $token;
            }
        });

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
        return $this->belongsTo(Pegawai::class, 'current_holder_id');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(AssetReport::class);
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
