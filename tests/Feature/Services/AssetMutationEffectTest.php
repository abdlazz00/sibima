<?php

use App\Enums\ApprovalStatus;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetHistory;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('lurah');
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sei Lekop');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);

    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->mutationService = app(AssetMutationService::class);
    $this->workflowService = app(ApprovalWorkflowService::class);
});

it('executes AssetMutationEffect on final approval: transfers unit, updates holder, resets status, and logs history', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop HP ProBook',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 14000000,
        'nilai_buku' => 14000000,
    ]);

    $mutation = $this->mutationService->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0010',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id, 'target_holder_id' => $pegawai->id, 'catatan' => 'Serah terima laptop']],
        $this->adminKec
    );

    $req = $mutation->approvalRequest;

    // Step 1: Kasubag
    $this->workflowService->approve($req, $this->kasubag);
    // Step 2: Camat
    $this->workflowService->approve($req, $this->camat);
    // Step 3: Admin Kelurahan
    $this->workflowService->approve($req, $this->adminKel);
    // Step 4: Lurah (final)
    $this->workflowService->approve($req, $this->lurah);

    expect($req->fresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($asset->fresh()->current_holder_id)->toBe($pegawai->id)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);

    $history = AssetHistory::where('asset_id', $asset->id)->latest('id')->first();
    expect($history)->not->toBeNull()
        ->and($history->event)->toBe('mutasi')
        ->and($history->unit_id)->toBe($this->kel->id)
        ->and($history->current_holder_id)->toBe($pegawai->id);
});

it('reverts asset status to aktif and marks mutation as rejected when rejected', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.002',
        'nomor_register' => 2,
        'nama_aset' => 'Printer Epson L3210',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 3000000,
        'nilai_buku' => 3000000,
    ]);

    $mutation = $this->mutationService->submit(
        [
            'nomor_mutasi' => 'MUT/2026/09/0011',
            'jenis_mutasi' => MutationType::KecKeKel->value,
            'origin_unit_id' => $this->kec->id,
            'destination_unit_id' => $this->kel->id,
            'tanggal_mutasi' => '2026-09-29',
        ],
        [['asset_id' => $asset->id]],
        $this->adminKec
    );

    $req = $mutation->approvalRequest;
    $this->workflowService->reject($req, $this->kasubag, 'Data tidak lengkap');

    expect($req->fresh()->status)->toBe(ApprovalStatus::Rejected)
        ->and($mutation->fresh()->status)->toBe(MutationStatus::Rejected)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif)
        ->and($asset->fresh()->unit_id)->toBe($this->kec->id);
});
