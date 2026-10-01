<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Services\AssetRecapService;
use App\Services\AssetRecapWorkbook;
use App\Services\ReportQuery;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

function wbBuild($user, array $filters = []): Spreadsheet
{
    $recap = app(AssetRecapService::class)->for($user, $filters);
    $query = (new ReportQuery($user))->build('aset', $filters);
    $response = app(AssetRecapWorkbook::class)->download($recap, $query, $filters, $user);

    ob_start();
    $response->sendContent();
    $content = ob_get_clean();

    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $content);
    $spreadsheet = IOFactory::load($path);
    unlink($path);

    return $spreadsheet;
}

function wbRows(Spreadsheet $spreadsheet, string $sheet): array
{
    return $spreadsheet->getSheetByName($sheet)->toArray(null, true, false, false);
}

function wbFind(array $rows, string $label): ?array
{
    foreach ($rows as $row) {
        if (($row[0] ?? null) === $label || ($row[1] ?? null) === $label) {
            return $row;
        }
    }

    return null;
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);

    Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik', 'nilai_perolehan' => 1000, 'nilai_buku' => 800, 'tanggal_perolehan' => '2022-03-01', 'nomor_register' => 7, 'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik', 'nilai_perolehan' => 2000, 'nilai_buku' => 1500, 'tanggal_perolehan' => '2022-07-15']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->laptop->id, 'kondisi' => 'rusak_berat', 'nilai_perolehan' => 3000, 'nilai_buku' => 1000, 'tanggal_perolehan' => '2024-01-10']);
    Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->laptop->id, 'kondisi' => 'hilang', 'nilai_perolehan' => 500, 'nilai_buku' => 100, 'tanggal_perolehan' => '2024-05-05']);

    $this->camat = userWithRole('camat', $this->kec);
});

it('writes five sheets, each with the letterhead, scope, filter and print date', function () {
    $book = wbBuild($this->camat);

    expect($book->getSheetNames())->toBe(['Ringkasan', 'Daftar Rinci', 'Rekap Kategori', 'Rekap Unit', 'Tren Tahunan']);

    foreach ($book->getSheetNames() as $name) {
        $rows = wbRows($book, $name);
        expect($rows[0][1])->toBe('PEMERINTAH KOTA BATAM')
            ->and($rows[1][1])->toBe('KECAMATAN SAGULUNG')
            ->and($rows[2][1])->not->toBeEmpty()
            ->and($rows[4][0])->toStartWith('Cakupan: ')
            ->and($rows[5][0])->toBe('Filter: Tanpa filter')
            ->and($rows[6][0])->toStartWith('Dicetak: ')
            ->and($book->getSheetByName($name)->getDrawingCollection())->toHaveCount(1);
    }
});

it('summarises totals and conditions on the Ringkasan sheet', function () {
    $rows = wbRows(wbBuild($this->camat), 'Ringkasan');

    expect($rows[2][1])->toBe('Ringkasan Laporan Aset')
        ->and(wbFind($rows, 'Jumlah Aset')[1])->toEqual(4)
        ->and(wbFind($rows, 'Total Nilai Perolehan')[1])->toEqual(6500)
        ->and(wbFind($rows, 'Total Nilai Buku')[1])->toEqual(3400)
        ->and(wbFind($rows, 'Baik')[1])->toEqual(2)
        ->and(wbFind($rows, 'Baik')[2])->toEqual(50.0)
        ->and(wbFind($rows, 'Total')[1])->toEqual(4);
});

it('lists every asset on Daftar Rinci with text kept as text and a totals row', function () {
    $rows = wbRows(wbBuild($this->camat), 'Daftar Rinci');

    expect($rows[8])->toContain('Kode Barang', 'No. Register', 'Nama Aset', 'Nilai Perolehan', 'Nilai Buku', 'Keterangan')
        ->and(count($rows[8]))->toBe(17);

    $heading = array_flip($rows[8]);
    $data = array_slice($rows, 9, 4);
    $special = collect($data)->first(fn ($r) => $r[$heading['Nama Aset']] === '=SUM(1+1)');

    expect($special)->not->toBeNull()
        ->and($special[$heading['No. Register']])->toBe('0007')
        ->and($special[$heading['Kode Barang']])->toBe('1.3.2.05.02.04.004');

    $total = wbFind($rows, 'TOTAL');
    expect($total[$heading['Nilai Perolehan']])->toEqual(6500)
        ->and($total[$heading['Nilai Buku']])->toEqual(3400);
});

it('recaps categories, units and the yearly trend with matching totals', function () {
    $book = wbBuild($this->camat);

    $kategori = wbRows($book, 'Rekap Kategori');
    expect(array_slice($kategori[8], 0, 5))->toBe(['Kategori', 'Subkategori', 'Jumlah', 'Nilai Perolehan', 'Nilai Buku'])
        ->and(wbFind($kategori, 'ALAT KANTOR')[2])->toEqual(2)
        ->and(wbFind($kategori, 'LAPTOP')[2])->toEqual(2)
        ->and(wbFind($kategori, 'Total')[3])->toEqual(6500);

    $unit = wbRows($book, 'Rekap Unit');
    expect(wbFind($unit, 'Kelurahan A')[1])->toEqual(2)
        ->and(wbFind($unit, 'Total')[1])->toEqual(4);

    $tren = wbRows($book, 'Tren Tahunan');
    expect(wbFind($tren, 'Total')[2])->toEqual(6500)
        ->and(collect($tren)->pluck(0)->filter(fn ($v) => $v === 2023 || $v === 2023.0)->count())->toBe(1);
});

it('drops the Rekap Unit sheet for a single-unit user', function () {
    $book = wbBuild(userWithRole('admin_kelurahan', $this->kelA));

    expect($book->getSheetNames())->toBe(['Ringkasan', 'Daftar Rinci', 'Rekap Kategori', 'Tren Tahunan']);
});

it('labels the filters on every sheet', function () {
    $book = wbBuild($this->camat, ['category_id' => $this->alat->id, 'kondisi' => 'baik']);

    expect(wbRows($book, 'Ringkasan')[5][0])->toBe('Filter: Kategori: ALAT KANTOR; Kondisi: Baik')
        ->and(wbRows($book, 'Daftar Rinci')[5][0])->toBe('Filter: Kategori: ALAT KANTOR; Kondisi: Baik');
});
