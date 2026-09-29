<?php

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Services\AssetMutationService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sagulung Kota');
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);

    $this->service = app(AssetMutationService::class);
});

it('submits mutation, locks assets to dalam_proses, and creates approval request', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Komputer PC All-in-One',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 12000000,
        'nilai_buku' => 12000000,
    ]);

    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $mutation = $this->service->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0001',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
            'keterangan' => 'Mutasi operasional',
        ],
        [
            [
                'asset_id' => $asset->id,
                'target_holder_id' => $pegawai->id,
                'catatan' => 'Siap pakai',
            ],
        ],
        $this->admin
    );

    expect($mutation->status)->toBe(MutationStatus::Pending)
        ->and($asset->fresh()->status)->toBe(AssetStatus::DalamProses)
        ->and($mutation->approvalRequest)->not->toBeNull()
        ->and($mutation->approvalRequest->definition->code)->toBe('mutasi_kec_ke_kel');
});

it('rejects submission if asset is not in origin unit or already dalam_proses', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.002',
        'nomor_register' => 2,
        'nama_aset' => 'Laptop Lenovo',
        'category_id' => $this->category->id,
        'unit_id' => $this->kel->id, // Not in kec
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    expect(fn () => $this->service->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0002',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id]],
        $this->admin
    ))->toThrow(InvalidArgumentException::class);
});
