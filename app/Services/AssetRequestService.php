<?php

namespace App\Services;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\User;
use App\Notifications\ApprovalStepNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetRequestService
{
    public function __construct(
        private readonly ApprovalWorkflowService $workflow,
        private readonly AssetMutationService $mutations,
    ) {}

    /** @param  array<string, mixed>  $data */
    public function create(array $data, User $actor): AssetRequest
    {
        $type = AssetRequestType::from($data['jenis']);

        return DB::transaction(function () use ($data, $actor, $type) {
            if (! $actor->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) || $actor->unit_id === null) {
                throw new InvalidArgumentException('Hanya admin unit yang dapat membuat permohonan.');
            }

            $category = AssetCategory::find($data['category_id'] ?? null);

            if ($category === null || ! $category->isSubcategory()) {
                throw new InvalidArgumentException('Pilih subkategori aset yang diminta.');
            }

            if ($type === AssetRequestType::Pegawai) {
                $pegawai = Pegawai::find($data['pegawai_id'] ?? null);

                if ($pegawai === null) {
                    throw new InvalidArgumentException('Pilih pegawai yang mengajukan permohonan.');
                }

                if (! $actor->canAccessUnit($pegawai->unit)) {
                    throw new InvalidArgumentException('Pegawai ini bukan dari unit Anda.');
                }

                $pegawaiId = $pegawai->id;
                $unitId = $pegawai->unit_id;
                $jumlah = 1;
            } else {
                if (! $actor->hasRole('admin_kelurahan')) {
                    throw new InvalidArgumentException('Hanya admin kelurahan yang dapat mengajukan permohonan unit.');
                }

                $jumlah = (int) ($data['jumlah'] ?? 0);

                if ($jumlah < 1) {
                    throw new InvalidArgumentException('Jumlah barang minimal 1.');
                }

                $pegawaiId = null;
                $unitId = $actor->unit_id;
            }

            $request = AssetRequest::create([
                'nomor_permohonan' => $this->nextNumber(),
                'jenis' => $type,
                'pegawai_id' => $pegawaiId,
                'unit_id' => $unitId,
                'category_id' => $category->id,
                'jumlah' => $jumlah,
                'keterangan' => $data['keterangan'],
                'status' => AssetRequestStatus::Pending,
                'created_by' => $actor->id,
            ]);

            $this->workflow->submit(
                $request,
                $type === AssetRequestType::Pegawai ? 'permohonan_pegawai' : 'permohonan_unit',
                $actor,
            );

            return $request;
        });
    }

    public function canFulfill(User $user, AssetRequest $request): bool
    {
        if (! $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan'])) {
            return false;
        }

        return match ($request->jenis) {
            AssetRequestType::Pegawai => $user->canAccessUnit($request->unit),
            AssetRequestType::Unit => $user->hasRole('admin_kecamatan') && $request->unit->parent_id === $user->unit_id,
        };
    }

    /** @return Collection<int, Asset> */
    public function eligibleAssets(AssetRequest $request): Collection
    {
        return Asset::query()
            ->where('unit_id', $this->sourceUnitId($request))
            ->where('category_id', $request->category_id)
            ->where('status', AssetStatus::Aktif)
            ->where('kondisi', '!=', Kondisi::Hilang)
            ->when($request->jenis === AssetRequestType::Pegawai, fn ($q) => $q->whereNull('current_holder_id'))
            ->orderBy('nama_aset')
            ->orderBy('id')
            ->get();
    }

    public function fulfillPegawai(AssetRequest $request, int $assetId, User $actor): void
    {
        DB::transaction(function () use ($request, $assetId, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->assertFulfillable($locked, $actor, AssetRequestType::Pegawai);

            $asset = Asset::whereKey($assetId)->lockForUpdate()->first();
            $this->assertAssetEligible($asset, $locked);

            $asset->update(['current_holder_id' => $locked->pegawai_id]);

            $asset->histories()->create([
                'event' => 'serah_terima',
                'unit_id' => $asset->unit_id,
                'current_holder_id' => $locked->pegawai_id,
                'kondisi' => $asset->kondisi,
                'user_id' => $actor->id,
                'keterangan' => "Serah terima untuk permohonan {$locked->nomor_permohonan} kepada {$locked->pegawai->nama}",
            ]);

            $locked->assets()->attach($asset->id);
            $locked->update([
                'status' => AssetRequestStatus::Fulfilled,
                'fulfilled_by' => $actor->id,
                'fulfilled_at' => now(),
            ]);
        });
    }

    /** @param  list<int>  $assetIds */
    public function fulfillUnit(AssetRequest $request, array $assetIds, User $actor): AssetMutation
    {
        return DB::transaction(function () use ($request, $assetIds, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->assertFulfillable($locked, $actor, AssetRequestType::Unit);

            $ids = array_values(array_unique(array_map('intval', $assetIds)));

            if (count($ids) !== count($assetIds)) {
                throw new InvalidArgumentException('Satu aset tidak boleh dipilih lebih dari sekali.');
            }

            if (count($ids) !== $locked->jumlah) {
                throw new InvalidArgumentException("Pilih tepat {$locked->jumlah} aset untuk permohonan ini.");
            }

            $assets = Asset::whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

            foreach ($ids as $id) {
                $this->assertAssetEligible($assets->get($id), $locked);
            }

            $sequence = AssetMutation::where('nomor_mutasi', 'like', "MUT/{$locked->nomor_permohonan}%")->count() + 1;

            $mutation = $this->mutations->submit(
                [
                    'nomor_mutasi' => "MUT/{$locked->nomor_permohonan}/{$sequence}",
                    'jenis_mutasi' => MutationType::KecKeKel->value,
                    'origin_unit_id' => $locked->unit->parent_id,
                    'destination_unit_id' => $locked->unit_id,
                    'tanggal_mutasi' => now()->toDateString(),
                    'keterangan' => "Pemenuhan permohonan {$locked->nomor_permohonan}",
                ],
                array_map(fn (int $id) => ['asset_id' => $id], $ids),
                $actor,
            );

            $locked->assets()->sync($ids);
            $locked->update(['mutation_id' => $mutation->id]);

            return $mutation;
        });
    }

    public function close(AssetRequest $request, string $note, User $actor): void
    {
        $approval = DB::transaction(function () use ($request, $note, $actor) {
            $locked = AssetRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== AssetRequestStatus::Approved || $locked->mutation_id !== null) {
                throw new InvalidArgumentException('Hanya permohonan yang sudah disetujui dan belum diproses yang dapat ditutup.');
            }

            if (! $this->canFulfill($actor, $locked)) {
                throw new InvalidArgumentException('Anda tidak berwenang menutup permohonan ini.');
            }

            $locked->update(['status' => AssetRequestStatus::Cancelled, 'catatan_penutupan' => $note]);

            return $locked->approvalRequest;
        });

        $request->creator->notify(new ApprovalStepNotification($approval, "Permohonan {$request->nomor_permohonan} ditutup: {$note}"));
    }

    private function sourceUnitId(AssetRequest $request): int
    {
        return $request->jenis === AssetRequestType::Pegawai ? $request->unit_id : $request->unit->parent_id;
    }

    private function assertFulfillable(AssetRequest $request, User $actor, AssetRequestType $expected): void
    {
        if ($request->jenis !== $expected) {
            throw new InvalidArgumentException('Jenis permohonan tidak sesuai dengan tindakan ini.');
        }

        if ($request->status !== AssetRequestStatus::Approved) {
            throw new InvalidArgumentException('Permohonan ini belum disetujui atau sudah selesai.');
        }

        if ($request->mutation_id !== null) {
            throw new InvalidArgumentException('Permohonan ini sudah dalam proses mutasi.');
        }

        if (! $this->canFulfill($actor, $request)) {
            throw new InvalidArgumentException('Anda tidak berwenang memenuhi permohonan ini.');
        }
    }

    private function assertAssetEligible(?Asset $asset, AssetRequest $request): void
    {
        if ($asset === null) {
            throw new InvalidArgumentException('Aset yang dipilih tidak ditemukan.');
        }

        $valid = $asset->unit_id === $this->sourceUnitId($request)
            && $asset->category_id === $request->category_id
            && $asset->status === AssetStatus::Aktif
            && $asset->kondisi !== Kondisi::Hilang
            && ($request->jenis !== AssetRequestType::Pegawai || $asset->current_holder_id === null);

        if (! $valid) {
            throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" tidak memenuhi syarat untuk permohonan ini.");
        }
    }

    private function nextNumber(): string
    {
        $prefix = 'PM/'.now()->year.'/';

        $last = AssetRequest::where('nomor_permohonan', 'like', $prefix.'%')
            ->orderByDesc('nomor_permohonan')
            ->lockForUpdate()
            ->value('nomor_permohonan');

        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
