<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetMutationService
{
    public function __construct(
        private readonly AssetMutationRepositoryInterface $repository,
        private readonly ApprovalWorkflowService $workflowService
    ) {}

    public function submit(array $data, array $items, User $creator): AssetMutation
    {
        if (empty($items)) {
            throw new InvalidArgumentException('Mutasi harus memiliki setidaknya satu aset.');
        }

        $type = $data['jenis_mutasi'] instanceof MutationType
            ? $data['jenis_mutasi']
            : MutationType::from($data['jenis_mutasi']);

        $originUnit = Unit::findOrFail($data['origin_unit_id']);
        $destUnit = Unit::findOrFail($data['destination_unit_id']);

        if ($type === MutationType::Internal && $originUnit->id !== $destUnit->id) {
            throw new InvalidArgumentException('Mutasi internal harus berada di unit yang sama.');
        }

        if ($type !== MutationType::Internal && $originUnit->id === $destUnit->id) {
            throw new InvalidArgumentException('Mutasi antar unit harus memiliki unit asal dan tujuan yang berbeda.');
        }

        $workflowCode = $this->resolveWorkflowCode($type, $originUnit);

        return DB::transaction(function () use ($data, $items, $creator, $originUnit, $type, $workflowCode) {
            $assetIds = array_column($items, 'asset_id');
            $assets = Asset::whereIn('id', $assetIds)->lockForUpdate()->get();

            if ($assets->count() !== count($assetIds)) {
                throw new InvalidArgumentException('Beberapa aset yang dipilih tidak ditemukan.');
            }

            foreach ($assets as $asset) {
                if ($asset->unit_id !== $originUnit->id) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" bukan milik unit asal.");
                }
                if ($asset->status !== AssetStatus::Aktif) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" sedang tidak aktif atau dalam proses mutasi lain.");
                }
            }

            foreach ($items as $item) {
                if ($type === MutationType::Internal && empty($item['target_holder_id'])) {
                    throw new InvalidArgumentException('Mutasi internal wajib menentukan pegawai pemegang baru.');
                }
            }

            // Lock assets
            Asset::whereIn('id', $assetIds)->update(['status' => AssetStatus::DalamProses]);

            $data['status'] = MutationStatus::Pending;
            $data['created_by'] = $creator->id;

            $mutation = $this->repository->createWithItems($data, $items);
            $this->workflowService->submit($mutation, $workflowCode, $creator);

            return $mutation;
        });
    }

    public function resolveWorkflowCode(MutationType $type, Unit $originUnit): string
    {
        return match ($type) {
            MutationType::KecKeKel => 'mutasi_kec_ke_kel',
            MutationType::AntarKel => 'mutasi_antar_kel',
            MutationType::ReturKelKeKec => 'retur_kel_ke_kec',
            MutationType::Internal => $originUnit->isKecamatan()
                ? 'mutasi_internal_kec'
                : 'mutasi_internal_kel',
        };
    }
}
