<?php

use App\Contracts\HasWorkflowUnits;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;

it('creates AssetMutation with cast attributes and relationships', function () {
    $origin = makeKecamatan();
    $destination = makeKelurahan($origin, 'Kelurahan Sungai Binti');
    $user = userWithRole('admin_kecamatan', $origin);
    $pegawai = Pegawai::factory()->create(['unit_id' => $destination->id]);

    $category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop Dell Latitude',
        'category_id' => $category->id,
        'unit_id' => $origin->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 15000000,
        'nilai_buku' => 15000000,
    ]);

    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/001',
        'jenis_mutasi' => MutationType::KecKeKel,
        'origin_unit_id' => $origin->id,
        'destination_unit_id' => $destination->id,
        'tanggal_mutasi' => '2026-09-29',
        'keterangan' => 'Pengalihan aset operasional',
        'status' => MutationStatus::Pending,
        'created_by' => $user->id,
    ]);

    $item = $mutation->items()->create([
        'asset_id' => $asset->id,
        'target_holder_id' => $pegawai->id,
        'catatan' => 'Kondisi baik lengkap charger',
    ]);

    expect($mutation)->toBeInstanceOf(HasWorkflowUnits::class)
        ->and($mutation->jenis_mutasi)->toBe(MutationType::KecKeKel)
        ->and($mutation->status)->toBe(MutationStatus::Pending)
        ->and($mutation->getOriginUnit()->id)->toBe($origin->id)
        ->and($mutation->getDestinationUnit()->id)->toBe($destination->id)
        ->and($mutation->items)->toHaveCount(1)
        ->and($mutation->creator->id)->toBe($user->id)
        ->and($mutation->approvalTitle())->toBe('Mutasi Aset #MUT/2026/001')
        ->and($item->asset->id)->toBe($asset->id)
        ->and($item->targetHolder->id)->toBe($pegawai->id);
});
