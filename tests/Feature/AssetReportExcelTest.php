<?php

use App\Models\ApprovalRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\AssetReportExcel;
use App\Services\ReportQuery;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;

beforeEach(function () {
    $this->wf = WorkflowDefinition::firstOrCreate(
        ['code' => 'lapor_rusak_hilang'],
        ['name' => 'Lapor Rusak/Hilang']
    );

    $this->kec = makeKecamatan();
    $this->camat = userWithRole('camat', $this->kec);

    $this->cat = AssetCategory::create(['name' => 'PERALATAN']);
    $this->subcat = AssetCategory::create(['name' => 'PRINTER', 'parent_id' => $this->cat->id]);

    $this->asset = Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->subcat->id,
        'kode_barang' => '02.03.01.01.001',
        'nama_aset' => 'Epson L3110',
        'nilai_perolehan' => 2500000,
        'nilai_buku' => 1500000,
    ]);

    $this->report = AssetReport::create([
        'nomor_laporan' => 'LAP-TEST-001',
        'asset_id' => $this->asset->id,
        'unit_id' => $this->kec->id,
        'pegawai_id' => null,
        'jenis' => 'rusak',
        'kondisi_baru' => 'rusak_ringan',
        'tanggal_kejadian' => '2026-10-01',
        'kronologi' => 'Roller macet',
        'status' => 'approved',
        'created_by' => $this->camat->id,
    ]);

    $ar = ApprovalRequest::create([
        'approvable_type' => (new AssetReport)->getMorphClass(),
        'approvable_id' => $this->report->id,
        'workflow_definition_id' => $this->wf->id,
        'current_step' => 1,
        'status' => 'approved',
        'created_by' => $this->camat->id,
    ]);

    $ar->actions()->create([
        'step_order' => 1,
        'user_id' => $this->camat->id,
        'action' => 'approve',
    ]);
});

it('generates an excel spreadsheet with single sheet and proper header and totals', function () {
    $excel = app(AssetReportExcel::class);
    $query = (new ReportQuery($this->camat))->build('rusak-hilang', []);
    $response = $excel->download($query, [], $this->camat);

    expect($response->headers->get('content-type'))
        ->toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // capture stream output into file
    ob_start();
    $response->sendContent();
    $content = ob_get_clean();

    $tmp = tempnam(sys_get_temp_dir(), 'test_excel_');
    file_put_contents($tmp, $content);

    $reader = new Xlsx();
    $spreadsheet = $reader->load($tmp);
    unlink($tmp);

    expect($spreadsheet->getSheetCount())->toBe(1);
    $sheet = $spreadsheet->getActiveSheet();
    expect($sheet->getTitle())->toBe('Daftar Rusak & Hilang');

    // Check letterhead and title
    expect($sheet->getCell('B1')->getValue())->toBe('PEMERINTAH KOTA BATAM')
        ->and($sheet->getCell('B2')->getValue())->toBe('KECAMATAN SAGULUNG')
        ->and($sheet->getCell('B3')->getValue())->toBe('Laporan Aset Rusak & Hilang');

    // Data row check (row 10 after row 9 header)
    expect($sheet->getCell('B10')->getValue())->toBe('LAP-TEST-001')
        ->and($sheet->getCell('D10')->getValue())->toBe('02.03.01.01.001')
        ->and($sheet->getCell('E10')->getValue())->toBe('Epson L3110');
});
