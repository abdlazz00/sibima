<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AssetService
{
    public const DESCRIPTIVE_FIELDS = [
        'kode_barang',
        'nama_aset',
        'category_id',
        'merk_type',
        'tanggal_perolehan',
        'sumber_perolehan',
        'nilai_perolehan',
        'nilai_buku',
        'no_dokumen',
        'keterangan',
    ];

    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function create(array $data, array $photos, User $actor): Asset
    {
        return DB::transaction(function () use ($data, $photos, $actor) {
            $asset = $this->assets->create([
                ...Arr::only($data, self::DESCRIPTIVE_FIELDS),
                'kondisi' => $data['kondisi'],
                'unit_id' => $actor->unit_id,
                'status' => AssetStatus::Aktif,
                'nomor_register' => $this->assets->maxRegisterNumber($data['kode_barang']) + 1,
            ]);

            $this->storePhotos($asset, $photos);

            $asset->histories()->create([
                'event' => 'dibuat',
                'unit_id' => $asset->unit_id,
                'current_holder_id' => null,
                'kondisi' => $asset->kondisi,
                'user_id' => $actor->id,
            ]);

            return $asset;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function update(Asset $asset, array $data, array $photos): Asset
    {
        return DB::transaction(function () use ($asset, $data, $photos) {
            $attributes = Arr::only($data, self::DESCRIPTIVE_FIELDS);

            if (isset($attributes['kode_barang']) && $attributes['kode_barang'] !== $asset->kode_barang) {
                $attributes['nomor_register'] = $this->assets->maxRegisterNumber($attributes['kode_barang']) + 1;
            }

            $this->assets->update($asset, $attributes);
            $this->storePhotos($asset, $photos);

            return $asset;
        });
    }

    public function deletePhoto(AssetPhoto $photo): void
    {
        Storage::disk('public')->delete($photo->path);
        $photo->delete();
    }

    /** @param list<UploadedFile> $photos */
    private function storePhotos(Asset $asset, array $photos): void
    {
        foreach ($photos as $photo) {
            $asset->photos()->create(['path' => $photo->store("assets/{$asset->id}", 'public')]);
        }
    }
}
