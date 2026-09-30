<?php

namespace App\Services;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetRequestService
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

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
