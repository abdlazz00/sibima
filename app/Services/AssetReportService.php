<?php

namespace App\Services;

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetReportService
{
    public const MAX_PHOTOS = 10;

    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $photos
     */
    public function create(array $data, array $photos, User $actor): AssetReport
    {
        $type = AssetReportType::from($data['jenis']);

        return DB::transaction(function () use ($data, $photos, $actor, $type) {
            $asset = Asset::whereKey($data['asset_id'])->lockForUpdate()->firstOrFail();

            if (! $actor->canAccessUnit($asset->unit)) {
                throw new InvalidArgumentException('Aset ini bukan milik unit Anda.');
            }

            if ($asset->kondisi === Kondisi::Hilang) {
                throw new InvalidArgumentException('Aset ini sudah dilaporkan hilang.');
            }

            $kondisiBaru = $this->resolveKondisiBaru($type, $data['kondisi_baru'] ?? null, $asset);

            if (AssetReport::where('asset_id', $asset->id)->where('status', AssetReportStatus::Pending)->exists()) {
                throw new InvalidArgumentException('Aset ini masih punya laporan yang menunggu persetujuan.');
            }

            if ($type === AssetReportType::Rusak && count($photos) < 1) {
                throw new InvalidArgumentException('Laporan rusak wajib menyertakan minimal 1 foto.');
            }

            if (count($photos) > self::MAX_PHOTOS) {
                throw new InvalidArgumentException('Maksimal '.self::MAX_PHOTOS.' foto per laporan.');
            }

            $report = AssetReport::create([
                'nomor_laporan' => $this->nextNumber(),
                'asset_id' => $asset->id,
                'unit_id' => $asset->unit_id,
                'pegawai_id' => $asset->current_holder_id,
                'jenis' => $type,
                'kondisi_baru' => $kondisiBaru,
                'tanggal_kejadian' => $data['tanggal_kejadian'],
                'kronologi' => $data['kronologi'],
                'status' => AssetReportStatus::Pending,
                'created_by' => $actor->id,
            ]);

            $this->workflow->submit($report, 'lapor_rusak_hilang', $actor);

            foreach ($photos as $photo) {
                $report->photos()->create(['path' => $photo->store("asset-reports/{$report->id}", 'public')]);
            }

            return $report;
        });
    }

    private function resolveKondisiBaru(AssetReportType $type, ?string $requested, Asset $asset): Kondisi
    {
        if ($type === AssetReportType::Hilang) {
            return Kondisi::Hilang;
        }

        $kondisi = Kondisi::tryFrom($requested ?? '');

        if (! in_array($kondisi, [Kondisi::RusakRingan, Kondisi::RusakBerat], true)) {
            throw new InvalidArgumentException('Pilih kondisi baru: rusak ringan atau rusak berat.');
        }

        if ($kondisi->severity() <= $asset->kondisi->severity()) {
            throw new InvalidArgumentException(
                "Kondisi aset sekarang ({$asset->kondisi->label()}) sudah sama atau lebih buruk dari {$kondisi->label()}."
            );
        }

        return $kondisi;
    }

    private function nextNumber(): string
    {
        $prefix = 'LP/'.now()->year.'/';

        $last = AssetReport::where('nomor_laporan', 'like', $prefix.'%')
            ->orderByDesc('nomor_laporan')
            ->lockForUpdate()
            ->value('nomor_laporan');

        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
