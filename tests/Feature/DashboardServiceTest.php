<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\AssetRequest;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\DashboardService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

function dashAsset(object $t, $unit, $category, string $kondisi, float $buku): Asset
{
    return Asset::factory()->create([
        'unit_id' => $unit->id,
        'category_id' => $category->id,
        'kondisi' => $kondisi,
        'nilai_buku' => $buku,
        'nilai_perolehan' => $buku * 2,
    ]);
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->kursi = AssetCategory::create(['name' => 'KURSI', 'parent_id' => $this->alat->id]);
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);

    $this->mejaKec = dashAsset($this, $this->kec, $this->meja, 'baik', 1000);
    $this->kursiA = dashAsset($this, $this->kelA, $this->kursi, 'baik', 2000);
    $this->laptopA = dashAsset($this, $this->kelA, $this->laptop, 'rusak_berat', 3000);
    $this->laptopB = dashAsset($this, $this->kelB, $this->laptop, 'hilang', 500);
    $this->mejaOther = dashAsset($this, $this->otherKec, $this->meja, 'baik', 9000);

    $this->service = app(DashboardService::class);
});

it('gives the kasubag the whole picture', function () {
    $data = $this->service->for(userWithRole('kasubag'));

    expect($data['totals'])->toBe(['jumlah_aset' => 5, 'nilai_perolehan' => 31000.0, 'nilai_buku' => 15500.0])
        ->and($data['per_kondisi'])->toBe(['baik' => 3, 'rusak_ringan' => 0, 'rusak_berat' => 1, 'hilang' => 1])
        ->and($data['per_unit'])->toHaveCount(4)
        ->and($data['units'])->toHaveCount(4)
        ->and($data['per_kategori'][0])->toBe(['id' => $this->alat->id, 'nama' => 'ALAT KANTOR', 'jumlah' => 3, 'nilai_buku' => 12000.0])
        ->and($data['per_kategori'][1])->toBe(['id' => $this->elektronik->id, 'nama' => 'ELEKTRONIK', 'jumlah' => 2, 'nilai_buku' => 3500.0]);
});

it('limits the camat to the kecamatan and its kelurahan', function () {
    $data = $this->service->for(userWithRole('camat', $this->kec));

    expect($data['totals']['jumlah_aset'])->toBe(4)
        ->and($data['totals']['nilai_buku'])->toBe(6500.0)
        ->and($data['per_unit'])->toHaveCount(3)
        ->and(collect($data['per_unit'])->pluck('id')->all())->not->toContain($this->otherKec->id);
});

it('narrows cards but not the per-unit table with a unit filter, and ignores units out of scope', function () {
    $camat = userWithRole('camat', $this->kec);

    $filtered = $this->service->for($camat, $this->kelA->id);
    expect($filtered['totals']['jumlah_aset'])->toBe(2)
        ->and($filtered['totals']['nilai_buku'])->toBe(5000.0)
        ->and($filtered['per_unit'])->toHaveCount(3)
        ->and($filtered['selected_unit_id'])->toBe($this->kelA->id);

    $foreign = $this->service->for($camat, $this->otherKec->id);
    expect($foreign['totals']['jumlah_aset'])->toBe(4)
        ->and($foreign['selected_unit_id'])->toBeNull();
});

it('shows a single-unit user only their unit, with no per-unit table or unit list, and ignores a crafted unit', function () {
    foreach ([userWithRole('admin_kelurahan', $this->kelA), userWithRole('lurah', $this->kelA)] as $user) {
        $data = $this->service->for($user, $this->kelB->id);

        expect($data['totals']['jumlah_aset'])->toBe(2)
            ->and($data['totals']['nilai_buku'])->toBe(5000.0)
            ->and($data['per_unit'])->toBeNull()
            ->and($data['units'])->toBe([])
            ->and($data['selected_unit_id'])->toBeNull();
    }

    $adminKec = $this->service->for(userWithRole('admin_kecamatan', $this->kec));
    expect($adminKec['totals']['jumlah_aset'])->toBe(1)
        ->and($adminKec['per_unit'])->toBeNull();
});

function dashMutation(object $t, string $no, $origin, $dest, string $status, int $minutesAgo): AssetMutation
{
    $m = AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $origin->id === $dest->id ? 'internal' : 'kec_ke_kel',
        'origin_unit_id' => $origin->id, 'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => '2026-10-01', 'status' => $status, 'created_by' => userWithRole('admin_kecamatan', $t->kec)->id,
    ]);
    $m->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    return $m;
}

function dashBa(object $t, string $no, $unit, string $status, ?string $approval, int $minutesAgo): BeritaAcaraPenerimaan
{
    $creator = userWithRole('admin_kecamatan', $t->kec);
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $no, 'tanggal_penerimaan' => '2026-10-02', 'no_kontrak_spk' => 'SPK-1',
        'unit_id' => $unit->id, 'created_by' => $creator->id, 'status' => $status,
    ]);
    $ba->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();

    if ($approval !== null) {
        app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $creator);
        $ba->approvalRequest->update(['status' => $approval]);
    }

    return $ba;
}

it('lists the five newest submitted transactions in scope with a status label and detail link', function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $mutA = dashMutation($this, 'M-A', $this->kec, $this->kelA, 'pending', 1);
    $baA = dashBa($this, 'BA-A', $this->kelA, 'submitted', 'approved', 2);
    dashMutation($this, 'M-B', $this->kec, $this->kelB, 'approved', 3);
    dashBa($this, 'BA-B', $this->kelB, 'submitted', 'pending', 4);
    dashMutation($this, 'M-OTHER', $this->otherKec, $this->otherKec, 'pending', 5);
    dashBa($this, 'BA-DRAFT', $this->kelA, 'draft', null, 0);
    dashMutation($this, 'M-REJ', $this->kec, $this->kelA, 'rejected', 10);
    dashMutation($this, 'M-CAN', $this->kec, $this->kelA, 'cancelled', 11);

    $adminA = $this->service->for(userWithRole('admin_kelurahan', $this->kelA))['transaksi'];
    expect(collect($adminA)->pluck('nomor')->all())->toBe(['M-A', 'BA-A', 'M-REJ', 'M-CAN'])
        ->and(collect($adminA)->pluck('status')->all())->toBe(['berjalan', 'selesai', 'ditolak', 'dibatalkan'])
        ->and($adminA[0])->toBe([
            'jenis' => 'mutasi', 'nomor' => 'M-A', 'ringkasan' => $this->kec->name.' → Kelurahan A',
            'tanggal' => '2026-10-01', 'status' => 'berjalan', 'url' => route('asset-mutations.show', $mutA),
        ])
        ->and($adminA[1])->toBe([
            'jenis' => 'penerimaan', 'nomor' => 'BA-A', 'ringkasan' => 'Kelurahan A',
            'tanggal' => '2026-10-02', 'status' => 'selesai', 'url' => route('penerimaan-aset.show', $baA),
        ]);

    $camat = $this->service->for(userWithRole('camat', $this->kec))['transaksi'];
    expect(collect($camat)->pluck('nomor')->all())->toBe(['M-A', 'BA-A', 'M-B', 'BA-B', 'M-REJ']);

    $kasubag = $this->service->for(userWithRole('kasubag'))['transaksi'];
    expect($kasubag)->toHaveCount(5)
        ->and(collect($kasubag)->pluck('nomor')->all())->toContain('M-OTHER');
});

it('has no activity feed any more', function () {
    expect($this->service->for(userWithRole('kasubag')))->not->toHaveKey('aktivitas');
});

it('counts the work queue within scope', function () {
    AssetReport::factory()->create(['asset_id' => $this->kursiA->id, 'unit_id' => $this->kelA->id, 'status' => 'pending']);
    AssetReport::factory()->create(['asset_id' => $this->laptopB->id, 'unit_id' => $this->kelB->id, 'status' => 'pending']);
    AssetReport::factory()->create(['asset_id' => $this->laptopA->id, 'unit_id' => $this->kelA->id, 'status' => 'approved']);

    $creator = userWithRole('admin_kecamatan', $this->kec);
    foreach ([[$this->kec, $this->kelA, 'M1'], [$this->kec, $this->kelB, 'M2']] as [$origin, $dest, $no]) {
        AssetMutation::create([
            'nomor_mutasi' => $no, 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $origin->id,
            'destination_unit_id' => $dest->id, 'tanggal_mutasi' => '2026-10-01', 'status' => 'pending', 'created_by' => $creator->id,
        ]);
    }

    AssetRequest::factory()->create([
        'status' => 'approved', 'unit_id' => $this->kelA->id,
        'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelA->id])->id,
    ]);

    $adminA = $this->service->for(userWithRole('admin_kelurahan', $this->kelA))['antrean'];
    expect($adminA['laporan_pending'])->toBe(1)
        ->and($adminA['mutasi_pending'])->toBe(1)
        ->and($adminA['permohonan_menunggu_pemenuhan'])->toBe(1)
        ->and($adminA['persetujuan_menunggu'])->toBeInt();

    $adminB = $this->service->for(userWithRole('admin_kelurahan', $this->kelB))['antrean'];
    expect($adminB['laporan_pending'])->toBe(1)
        ->and($adminB['mutasi_pending'])->toBe(1)
        ->and($adminB['permohonan_menunggu_pemenuhan'])->toBe(0);

    $camat = $this->service->for(userWithRole('camat', $this->kec))['antrean'];
    expect($camat['laporan_pending'])->toBe(2)
        ->and($camat['mutasi_pending'])->toBe(2)
        ->and($camat['permohonan_menunggu_pemenuhan'])->toBe(0);
});
