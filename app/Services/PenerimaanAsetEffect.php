<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetStatus;
use App\Models\BeritaAcaraPenerimaan;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PenerimaanAsetEffect implements WorkflowEffect
{
    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof BeritaAcaraPenerimaan) {
            throw new InvalidArgumentException('PenerimaanAsetEffect hanya berlaku untuk BeritaAcaraPenerimaan.');
        }

        DB::transaction(function () use ($approvable) {
            $noDokumenSeq = 0;

            foreach ($approvable->items as $item) {
                $category = $item->category;

                if (blank($category->code)) {
                    throw new InvalidArgumentException(
                        "Kategori \"{$category->name}\" belum punya kode BMD. Isi dulu lewat halaman Kategori Aset."
                    );
                }

                // 1. Resolve single kode_barang for this entire item line
                $kodeBarang = $this->assets->findExistingKodeBarang($item->category_id, $item->nama_aset);

                if ($kodeBarang === null) {
                    $suffix = $this->assets->maxKodeBarangSuffix($category->code) + 1;
                    $kodeBarang = $category->code.'.'.str_pad((string) $suffix, 3, '0', STR_PAD_LEFT);
                }

                // 2. Resolve starting register number
                $baseRegister = $this->assets->maxRegisterNumber($kodeBarang);

                $assetIds = [];

                // 3. Create each physical unit with SAME kode_barang and INCREMENTAL nomor_register
                for ($i = 0; $i < $item->jumlah_unit; $i++) {
                    $noDokumenSeq++;
                    $nomorRegister = $baseRegister + $i + 1;

                    $asset = $this->assets->create([
                        'kode_barang' => $kodeBarang,
                        'nomor_register' => $nomorRegister,
                        'nama_aset' => $item->nama_aset,
                        'merk_type' => $item->merk_type,
                        'category_id' => $item->category_id,
                        'unit_id' => $approvable->unit_id,
                        'kondisi' => $item->kondisi_awal,
                        'status' => AssetStatus::Aktif,
                        'tanggal_perolehan' => $approvable->tanggal_penerimaan,
                        'sumber_perolehan' => $approvable->sumber_perolehan,
                        'nilai_perolehan' => $item->nilai_per_unit,
                        'nilai_buku' => $item->nilai_per_unit,
                        // assets.no_dokumen is unique, but one Berita Acara covers many
                        // units across possibly several categories — a BA-wide counter
                        // (not the per-category kode_barang suffix) keeps every unit's
                        // no_dokumen distinct even when two categories share a suffix.
                        'no_dokumen' => $approvable->no_berita_acara.'-'.str_pad((string) $noDokumenSeq, 3, '0', STR_PAD_LEFT),
                    ]);

                    $asset->histories()->create([
                        'event' => 'diterima',
                        'unit_id' => $asset->unit_id,
                        'current_holder_id' => null,
                        'kondisi' => $asset->kondisi,
                        'user_id' => $approvable->created_by,
                    ]);

                    $assetIds[] = $asset->id;
                }

                $item->update(['asset_ids' => $assetIds]);
            }
        });
    }
}
