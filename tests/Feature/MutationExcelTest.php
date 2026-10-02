<?php

use App\Models\ApprovalAction;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Services\ApprovalWorkflowService;
use App\Services\MutationExcel;
use App\Services\MutationRecapService;
use App\Services\ReportQuery;
use Database\Seeders\WorkflowDefinitionSeeder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Spatie\Permission\Models\Role;

function meBuild($user, array $filters = []): Spreadsheet
{
    $query = (new ReportQuery($user))->build('mutasi', $filters);
    $response = app(MutationExcel::class)->download($query, $filters, $user);

    ob_start();
    $response->sendContent();
    $content = ob_get_clean();

    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $content);
    $spreadsheet = IOFactory::load($path);
    unlink($path);

    return $spreadsheet;
}

function meRows(Spreadsheet $book): array
{
    return $book->getActiveSheet()->toArray(null, true, false, false);
}

function meDate(mixed $serial): string
{
    return Date::excelToDateTimeObject($serial)->format('Y-m-d');
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);

    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004', 'nilai_perolehan' => 1000]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => 'Kursi', 'kode_barang' => '1.3.2.10.01.02.001', 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => 'Meja', 'nilai_perolehan' => 3000]);

    $this->m1 = AssetMutation::create([
        'nomor_mutasi' => 'M-1', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelA->id,
        'tanggal_mutasi' => '2026-08-10', 'status' => 'approved', 'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    foreach ([$this->a1, $this->a2] as $a) {
        AssetMutationItem::create(['asset_mutation_id' => $this->m1->id, 'asset_id' => $a->id]);
    }
    app(ApprovalWorkflowService::class)->submit($this->m1, 'mutasi_kec_ke_kel', $this->camat);
    $request = $this->m1->approvalRequest()->first();
    $request->forceFill(['created_at' => '2026-08-10 09:00:00'])->save();
    $action = ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => 1, 'user_id' => $this->camat->id, 'action' => 'approve']);
    $action->forceFill(['created_at' => '2026-08-12 09:00:00'])->save();

    $this->m2 = AssetMutation::create([
        'nomor_mutasi' => 'M-2', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelB->id,
        'tanggal_mutasi' => '2026-10-05', 'status' => 'pending', 'created_by' => $this->camat->id,
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $this->m2->id, 'asset_id' => $this->a3->id]);
});

it('writes exactly one sheet named Daftar Mutasi with the letterhead', function () {
    $book = meBuild($this->camat);
    $rows = meRows($book);

    expect($book->getSheetCount())->toBe(1)
        ->and($book->getActiveSheet()->getTitle())->toBe('Daftar Mutasi')
        ->and($rows[0][1])->toBe('PEMERINTAH KOTA BATAM')
        ->and($rows[1][1])->toBe('KECAMATAN SAGULUNG')
        ->and($rows[2][1])->toBe('Laporan Mutasi Aset')
        ->and($rows[4][0])->toStartWith('Cakupan: ')
        ->and($rows[5][0])->toBe('Filter: Tanpa filter')
        ->and($rows[6][0])->toStartWith('Dicetak: ')
        ->and($book->getActiveSheet()->getDrawingCollection())->toHaveCount(1)
        ->and(array_slice($rows[8], 0, 15))->toBe([
            'No', 'Nomor Mutasi', 'Tanggal', 'Jenis', 'Unit Asal', 'Unit Tujuan', 'Jumlah Aset', 'Daftar Aset',
            'Nilai Perolehan', 'Status', 'Diajukan Oleh', 'Tanggal Diajukan', 'Tanggal Selesai', 'Lama Proses (hari)', 'Keterangan',
        ]);
});

it('lists one row per mutation, newest first, with assets, dates and processing time', function () {
    $rows = meRows(meBuild($this->camat));
    $h = array_flip($rows[8]);

    expect($rows[9][$h['Nomor Mutasi']])->toBe('M-2')
        ->and($rows[10][$h['Nomor Mutasi']])->toBe('M-1');

    $m1 = $rows[10];
    expect($m1[$h['Jenis']])->toBe('Mutasi Kecamatan ke Kelurahan')
        ->and($m1[$h['Unit Tujuan']])->toBe('Kelurahan A')
        ->and((int) $m1[$h['Jumlah Aset']])->toBe(2)
        ->and($m1[$h['Daftar Aset']])->toContain('1.3.2.05.02.04.004 - =SUM(1+1)')
        ->and($m1[$h['Daftar Aset']])->toContain('1.3.2.10.01.02.001 - Kursi')
        ->and((float) $m1[$h['Nilai Perolehan']])->toBe(3000.0)
        ->and($m1[$h['Status']])->toBe('Disetujui')
        ->and($m1[$h['Keterangan']])->toBe('Pengisian stok')
        ->and(meDate($m1[$h['Tanggal']]))->toBe('2026-08-10')
        ->and(meDate($m1[$h['Tanggal Diajukan']]))->toBe('2026-08-10')
        ->and(meDate($m1[$h['Tanggal Selesai']]))->toBe('2026-08-12')
        ->and((float) $m1[$h['Lama Proses (hari)']])->toBe(2.0);

    $pending = $rows[9];
    expect($pending[$h['Tanggal Selesai']])->toBeNull()
        ->and($pending[$h['Lama Proses (hari)']])->toBeNull();
});

it('writes both total rows and they match the recap', function () {
    $rows = meRows(meBuild($this->camat));
    $h = array_flip($rows[8]);
    $recap = app(MutationRecapService::class)->for($this->camat, []);

    expect($rows[11][1])->toBe('Total Semua Status')
        ->and((int) $rows[11][$h['Jumlah Aset']])->toBe(3)
        ->and((float) $rows[11][$h['Nilai Perolehan']])->toBe(6000.0)
        ->and($rows[12][1])->toBe('Total Disetujui')
        ->and((int) $rows[12][$h['Jumlah Aset']])->toBe($recap['ringkasan']['aset_berpindah'])
        ->and((float) $rows[12][$h['Nilai Perolehan']])->toBe($recap['ringkasan']['nilai_perolehan']);
});

it('keeps mutation numbers and special text as text, and limits rows to the user scope', function () {
    $rows = meRows(meBuild($this->adminA));

    expect(array_slice($rows, 9, 1)[0][1])->toBe('M-1')
        ->and($rows[10][1])->toBe('Total Semua Status');

    $other = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $secret = AssetMutation::create([
        'nomor_mutasi' => '=HYPERLINK("x")', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelA->id,
        'tanggal_mutasi' => '2026-10-20', 'status' => 'pending', 'created_by' => $this->camat->id,
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $secret->id, 'asset_id' => $other->id]);

    expect(meRows(meBuild($this->camat))[9][1])->toBe('=HYPERLINK("x")');
});

it('labels the filters in readable words', function () {
    $rows = meRows(meBuild($this->camat, [
        'jenis_mutasi' => 'kec_ke_kel', 'status' => 'approved', 'asal_id' => $this->kec->id, 'tujuan_id' => $this->kelA->id,
        'dari' => '2026-08-01', 'sampai' => '2026-10-31',
    ]));

    expect($rows[5][0])->toBe('Filter: Jenis Mutasi: Mutasi Kecamatan ke Kelurahan; Status: Disetujui; Unit Asal: '.$this->kec->name.'; Unit Tujuan: Kelurahan A; Dari: 2026-08-01; Sampai: 2026-10-31')
        ->and($rows[9][1])->toBe('M-1');
});
