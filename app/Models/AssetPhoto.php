<?php

namespace App\Models;

use App\Services\ThumbnailService;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

class AssetPhoto extends Model
{
    protected $fillable = ['path'];

    protected $appends = ['url', 'thumbnail_url'];

    public function photoable(): MorphTo
    {
        return $this->morphTo();
    }

    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    protected function thumbnailUrl(): Attribute
    {
        return Attribute::get(fn () => app(ThumbnailService::class)->url($this->path));
    }
}
