<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetReportEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetReport) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetReport.');
        }

        DB::transaction(function () use ($approvable) {
            $asset = Asset::whereKey($approvable->asset_id)->lockForUpdate()->first();

            if ($asset === null) {
                throw new InvalidArgumentException('Aset pada laporan ini sudah tidak ditemukan.');
            }

            if ($asset->unit_id !== $approvable->unit_id) {
                throw new InvalidArgumentException('Aset sudah berpindah unit; ajukan laporan baru dari unit pemilik.');
            }

            if ($asset->kondisi === Kondisi::Hilang) {
                throw new InvalidArgumentException('Aset ini sudah berkondisi hilang, laporan tidak dapat diterapkan.');
            }

            if ($approvable->kondisi_baru->severity() <= $asset->kondisi->severity()) {
                throw new InvalidArgumentException(
                    "Kondisi aset sekarang ({$asset->kondisi->label()}) sudah sama atau lebih buruk dari kondisi pada laporan ({$approvable->kondisi_baru->label()})."
                );
            }

            $asset->update(['kondisi' => $approvable->kondisi_baru]);

            $asset->histories()->create([
                'event' => 'laporan_'.$approvable->jenis->value,
                'unit_id' => $asset->unit_id,
                'current_holder_id' => $asset->current_holder_id,
                'kondisi' => $asset->kondisi,
                'user_id' => auth()->id() ?? $approvable->created_by,
                'keterangan' => $approvable->kronologi,
            ]);

            $approvable->update(['status' => AssetReportStatus::Approved]);
        });
    }
}
