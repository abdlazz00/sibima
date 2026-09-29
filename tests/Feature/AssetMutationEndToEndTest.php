<?php

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('admin_kelurahan');
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('lurah');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Sungai Binti');

    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->lurah = userWithRole('lurah', $this->kel);

    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
});

it('executes full mutation HTTP lifecycle: create via POST, index, show, and approve through generic approvals', function () {
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'PC Laboratorium',
        'category_id' => $this->category->id,
        'unit_id' => $this->kec->id,
        'kondisi' => 'baik',
        'status' => AssetStatus::Aktif,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $payload = [
        'nomor_mutasi' => 'MUT/2026/09/9999',
        'jenis_mutasi' => MutationType::KecKeKel->value,
        'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kel->id,
        'tanggal_mutasi' => '2026-09-29',
        'keterangan' => 'Pengalihan PC ke kelurahan',
        'items' => [
            [
                'asset_id' => $asset->id,
                'target_holder_id' => $pegawai->id,
                'catatan' => 'Lengkap monitor & mouse',
            ],
        ],
    ];

    $response = $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), $payload);
    $response->assertRedirect(route('asset-mutations.index'));

    $mutation = AssetMutation::where('nomor_mutasi', 'MUT/2026/09/9999')->first();
    expect($mutation)->not->toBeNull()
        ->and($mutation->status)->toBe(MutationStatus::Pending)
        ->and($asset->fresh()->status)->toBe(AssetStatus::DalamProses);

    // Create view
    $this->actingAs($this->adminKec)->get(route('asset-mutations.create'))->assertOk();

    // List mutations
    $this->actingAs($this->adminKec)->get(route('asset-mutations.index'))->assertOk();

    // Show mutation
    $this->actingAs($this->adminKec)->get(route('asset-mutations.show', $mutation))->assertOk();

    // Step 1 approval: Kasubag
    $this->actingAs($this->kasubag)
        ->post(route('approval-requests.approve', $mutation->approvalRequest), ['note' => 'Setuju administrasi'])
        ->assertRedirect();

    // Step 2 approval: Camat
    $this->actingAs($this->camat)
        ->post(route('approval-requests.approve', $mutation->approvalRequest), ['note' => 'Setuju pengeluaran aset'])
        ->assertRedirect();

    // Step 3 approval: Admin Kelurahan
    $this->actingAs($this->adminKel)
        ->post(route('approval-requests.approve', $mutation->approvalRequest), ['note' => 'Barang fisik diterima'])
        ->assertRedirect();

    // Step 4 approval: Lurah (final)
    $this->actingAs($this->lurah)
        ->post(route('approval-requests.approve', $mutation->approvalRequest), ['note' => 'Disetujui masuk'])
        ->assertRedirect();

    expect($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($asset->fresh()->current_holder_id)->toBe($pegawai->id)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
});
