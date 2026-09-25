<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'type', 'parent_id'];

    protected function casts(): array
    {
        return ['parent_id' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saving(function (Unit $unit) {
            if ($unit->type === 'kelurahan' && $unit->parent_id === null) {
                throw new InvalidArgumentException('Kelurahan harus memiliki parent kecamatan.');
            }

            if ($unit->type === 'kecamatan' && $unit->parent_id !== null) {
                throw new InvalidArgumentException('Kecamatan tidak boleh memiliki parent.');
            }

            if ($unit->type === 'kelurahan' && $unit->parent_id !== null) {
                $parent = Unit::find($unit->parent_id);

                if (! $parent?->isKecamatan()) {
                    throw new InvalidArgumentException('Parent kelurahan harus berupa kecamatan.');
                }
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Unit::class, 'parent_id');
    }

    public function isKecamatan(): bool
    {
        return $this->type === 'kecamatan';
    }

    public function isKelurahan(): bool
    {
        return $this->type === 'kelurahan';
    }
}
