<?php

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\ApprovalRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use App\Services\AssetReportRecapService;

function rrReport($asset, $unit, $user, string $kondisi, string $status, string $date): AssetReport
{
    $report = AssetReport::create([
        'nomor_laporan' => 'LAP-'.uniqid(),
        'asset_id' => $asset->id,
        'unit_id' => $unit->id,
        'pegawai_id' => null,
        'jenis' => $kondisi === 'hilang' ? 'hilang' : 'rusak',
        'kondisi_baru' => $kondisi,
        'tanggal_kejadian' => $date,
        'kronologi' => 'Kejadian pengujian',
        'status' => $status,
        'created_by' => $user->id,
    ]);

    $wf = \App\Models\WorkflowDefinition::firstOrCreate(
        ['code' => 'lapor_rusak_hilang'],
        ['name' => 'Lapor Rusak/Hilang']
    );

    if ($status === 'approved') {
        $ar = ApprovalRequest::create([
            'approvable_type' => (new AssetReport)->getMorphClass(),
            'approvable_id' => $report->id,
            'workflow_definition_id' => $wf->id,
            'current_step' => 1,
            'status' => 'approved',
            'created_by' => $user->id,
        ]);
        $ar->forceFill(['created_at' => now()->subDays(2)])->save();

        $action = $ar->actions()->create([
            'step_order' => 1,
            'user_id' => $user->id,
            'action' => 'approve',
        ]);
        $action->forceFill(['created_at' => now()->subDay()])->save();
    } elseif ($status === 'pending') {
        $ar = ApprovalRequest::create([
            'approvable_type' => (new AssetReport)->getMorphClass(),
            'approvable_id' => $report->id,
            'workflow_definition_id' => $wf->id,
            'current_step' => 1,
            'status' => 'pending',
            'created_by' => $user->id,
        ]);
        $ar->forceFill(['created_at' => now()->subDays(3)])->save();

        $ar->steps()->create([
            'step_order' => 1,
            'label' => 'Persetujuan Atasan Unit',
            'approver_type' => 'atasan_unit',
            'unit_scope' => 'subject',
            'status' => 'pending',
        ]);
    }

    return $report;
}

beforeEach(function () {
    $this->wf = \App\Models\WorkflowDefinition::firstOrCreate(
        ['code' => 'lapor_rusak_hilang'],
        ['name' => 'Lapor Rusak/Hilang']
    );

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->cat = AssetCategory::create(['name' => 'KOMPUTER']);
    $this->subcat = AssetCategory::create(['name' => 'PC', 'parent_id' => $this->cat->id]);

    $this->a1 = Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->subcat->id,
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 8000000,
    ]);
    $this->a2 = Asset::factory()->create([
        'unit_id' => $this->kelA->id,
        'category_id' => $this->subcat->id,
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 3000000,
    ]);

    $this->rep1 = rrReport($this->a1, $this->kec, $this->camat, 'rusak_berat', 'approved', '2026-10-01');
    $this->rep2 = rrReport($this->a2, $this->kelA, $this->adminA, 'hilang', 'approved', '2026-10-05');
    $this->rep3 = rrReport($this->a2, $this->kelA, $this->adminA, 'rusak_ringan', 'pending', '2026-10-08');
});

it('calculates summary metrics correctly for approved reports', function () {
    $service = new AssetReportRecapService();
    $data = $service->for($this->camat, []);

    expect($data['ringkasan']['jumlah_laporan'])->toBe(3)
        ->and($data['ringkasan']['disetujui'])->toBe(2)
        ->and($data['ringkasan']['nilai_perolehan'])->toEqual(15000000.0)
        ->and($data['ringkasan']['nilai_buku'])->toEqual(11000000.0)
        ->and($data['ringkasan']['rata_lama_proses'])->toBe(1.0);
});

it('does not count an asset twice when it has several approved reports', function () {
    rrReport($this->a1, $this->kec, $this->camat, 'hilang', 'approved', '2026-10-09');

    $data = (new AssetReportRecapService())->for($this->camat, []);

    expect($data['ringkasan']['disetujui'])->toBe(3)
        ->and($data['ringkasan']['nilai_perolehan'])->toEqual(15000000.0)
        ->and($data['ringkasan']['nilai_buku'])->toEqual(11000000.0);
});

it('counts the value of an asset once across the trend and the unit breakdown', function () {
    rrReport($this->a1, $this->kec, $this->camat, 'hilang', 'approved', '2026-11-02');

    $data = (new AssetReportRecapService())->for($this->camat, []);

    expect(array_sum(array_column($data['tren'], 'jumlah')))->toBe(3)
        ->and(array_sum(array_column($data['tren'], 'nilai_perolehan')))->toEqual(15000000.0)
        ->and($data['sebaran_unit']['total']['total'])->toBe(3)
        ->and($data['sebaran_unit']['total']['nilai_buku'])->toEqual(11000000.0);
});

it('scopes reports per user role', function () {
    $service = new AssetReportRecapService();
    $data = $service->for($this->adminA, []);

    expect($data['ringkasan']['jumlah_laporan'])->toBe(2)
        ->and($data['ringkasan']['disetujui'])->toBe(1)
        ->and($data['ringkasan']['nilai_perolehan'])->toEqual(5000000.0)
        ->and($data['ringkasan']['nilai_buku'])->toEqual(3000000.0)
        ->and($data['sebaran_unit'])->toBeNull(); // Single unit scope
});

it('provides status and condition compositions with correct totals', function () {
    $service = new AssetReportRecapService();
    $data = $service->for($this->camat, []);

    $statusTotal = array_sum(array_column($data['status'], 'jumlah'));
    $kondisiTotal = array_sum(array_column($data['kondisi'], 'jumlah'));

    expect($statusTotal)->toBe(3)
        ->and($kondisiTotal)->toBe(3);
});

it('provides pending in-flight reports list', function () {
    $service = new AssetReportRecapService();
    $data = $service->for($this->camat, []);

    expect($data['masih_berjalan'])->toHaveCount(1)
        ->and($data['masih_berjalan'][0]['nomor'])->toBe($this->rep3->nomor_laporan)
        ->and($data['masih_berjalan'][0]['menunggu'])->toBe('Atasan Unit');
});
