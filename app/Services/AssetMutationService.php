<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\Pegawai;
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

        $sameUnit = in_array($type, [MutationType::Internal, MutationType::Pengembalian], true);

        if ($sameUnit && $originUnit->id !== $destUnit->id) {
            throw new InvalidArgumentException($type === MutationType::Pengembalian
                ? 'Pengembalian ke inventaris harus berada di unit yang sama.'
                : 'Mutasi internal harus berada di unit yang sama.');
        }

        if (! $sameUnit && $originUnit->id === $destUnit->id) {
            throw new InvalidArgumentException('Mutasi antar unit harus memiliki unit asal dan tujuan yang berbeda.');
        }

        $this->assertUnitKindsMatch($type, $originUnit, $destUnit);

        $assetIds = array_column($items, 'asset_id');
        if (count($assetIds) !== count(array_unique($assetIds))) {
            throw new InvalidArgumentException('Satu aset tidak boleh dipilih lebih dari sekali.');
        }

        $this->assertHoldersBelongToUnit($items, $destUnit);

        $workflowCode = $this->resolveWorkflowCode($type, $originUnit);

        return DB::transaction(function () use ($data, $items, $creator, $originUnit, $type, $workflowCode, $assetIds) {
            $assets = Asset::whereIn('id', $assetIds)->lockForUpdate()->get();

            if ($assets->count() !== count($assetIds)) {
                throw new InvalidArgumentException('Beberapa aset yang dipilih tidak ditemukan.');
            }

            foreach ($assets as $asset) {
                if ($asset->unit_id !== $originUnit->id) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" bukan milik unit asal.");
                }
                if ($asset->kondisi === Kondisi::Hilang) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" berkondisi hilang dan tidak dapat dimutasi.");
                }
                if ($asset->status !== AssetStatus::Aktif) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" sedang tidak aktif atau dalam proses mutasi lain.");
                }
                if ($type === MutationType::Pengembalian && $asset->current_holder_id === null) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" sudah berada di inventaris unit, tidak ada yang perlu dikembalikan.");
                }
            }

            foreach ($items as $item) {
                if ($type === MutationType::Pengembalian && ! empty($item['target_holder_id'])) {
                    throw new InvalidArgumentException('Pengembalian ke inventaris tidak boleh menentukan pemegang baru.');
                }

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
            MutationType::Pengembalian => 'pengembalian_aset',
        };
    }

    private function assertUnitKindsMatch(MutationType $type, Unit $origin, Unit $dest): void
    {
        $valid = match ($type) {
            MutationType::KecKeKel => $origin->isKecamatan() && $dest->isKelurahan(),
            MutationType::AntarKel => $origin->isKelurahan() && $dest->isKelurahan(),
            MutationType::ReturKelKeKec => $origin->isKelurahan() && $dest->isKecamatan(),
            MutationType::Internal, MutationType::Pengembalian => true,
        };

        if (! $valid) {
            throw new InvalidArgumentException("Unit asal dan tujuan tidak sesuai untuk jenis \"{$type->label()}\".");
        }
    }

    private function assertHoldersBelongToUnit(array $items, Unit $destUnit): void
    {
        $holderIds = array_filter(array_column($items, 'target_holder_id'));

        if ($holderIds === []) {
            return;
        }

        $outside = Pegawai::whereIn('id', $holderIds)->where('unit_id', '!=', $destUnit->id)->exists();

        if ($outside) {
            throw new InvalidArgumentException("Pegawai pemegang baru harus terdaftar di unit tujuan ({$destUnit->name}).");
        }
    }
}
