<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class AssetCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'parent_id', 'code', 'description'];

    protected $casts = [
        'parent_id' => 'integer',
    ];

    protected $appends = ['formatted_code'];

    public function getFormattedCodeAttribute(): string
    {
        if (! empty($this->code)) {
            return $this->code;
        }

        if ($this->parent_id === null) {
            return sprintf('01.%02d', $this->id);
        }

        return sprintf('01.%02d.%02d', $this->parent_id, $this->id);
    }

    protected static function booted(): void
    {
        static::saving(function (AssetCategory $category) {
            if ($category->parent_id === null) {
                return;
            }

            if ($category->exists && $category->parent_id === $category->id) {
                throw new InvalidArgumentException('Kategori tidak boleh menjadi induk dirinya sendiri.');
            }

            $parent = AssetCategory::find($category->parent_id);

            if ($parent === null || $parent->parent_id !== null) {
                throw new InvalidArgumentException('Subkategori harus berada langsung di bawah kategori utama.');
            }

            if ($category->exists && $category->children()->exists()) {
                throw new InvalidArgumentException('Kategori yang punya subkategori tidak bisa dijadikan subkategori.');
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(AssetCategory::class, 'parent_id')->orderBy('name');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'category_id');
    }

    public function isSubcategory(): bool
    {
        return $this->parent_id !== null;
    }
}
