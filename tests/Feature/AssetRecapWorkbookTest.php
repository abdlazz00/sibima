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

function wbRows(Spreadsheet $spreadsheet, string $sheet = 'Daftar Aset'): array
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
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR', 'code' => '1.3.2.05']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id, 'code' => '1.3.2.05.02.04']);
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK', 'code' => '1.3.2.10']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id, 'code' => '1.3.2.10.02.03']);

    Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->meja->id,
        'kondisi' => 'baik',
        'nilai_perolehan' => 1000,
        'nilai_buku' => 800,
        'tanggal_perolehan' => '2022-03-01',
        'nomor_register' => 7,
        'nama_aset' => '=SUM(1+1)',
        'kode_barang' => '1.3.2.05.02.04.004',
        'merk_type' => 'Informa',
        'no_dokumen' => 'DOC-001',
        'keterangan' => 'Inventaris ruang camat',
    ]);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik', 'nilai_perolehan' => 2000, 'nilai_buku' => 1500, 'tanggal_perolehan' => '2022-07-15']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->laptop->id, 'kondisi' => 'rusak_berat', 'nilai_perolehan' => 3000, 'nilai_buku' => 1000, 'tanggal_perolehan' => '2024-01-10']);
    Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->laptop->id, 'kondisi' => 'hilang', 'nilai_perolehan' => 500, 'nilai_buku' => 100, 'tanggal_perolehan' => '2024-05-05']);

    $this->camat = userWithRole('camat', $this->kec);
});

it('writes a single sheet titled Daftar Aset with the letterhead, scope, filter and print date', function () {
    $book = wbBuild($this->camat);

    expect($book->getSheetNames())->toBe(['Daftar Aset']);

    $sheet = $book->getSheetByName('Daftar Aset');
    $rows = wbRows($book, 'Daftar Aset');

    expect($rows[0][1])->toBe('PEMERINTAH KOTA BATAM')
        ->and($rows[1][1])->toBe('KECAMATAN SAGULUNG')
        ->and($rows[2][1])->toBe('Daftar Aset')
        ->and($rows[4][0])->toStartWith('Cakupan: ')
        ->and($rows[5][0])->toBe('Filter: Tanpa filter')
        ->and($rows[6][0])->toStartWith('Dicetak: ')
        ->and($sheet->getDrawingCollection())->toHaveCount(1);
});

it('lists every asset on Daftar Aset with 19 standardized columns and a totals row', function () {
    $rows = wbRows(wbBuild($this->camat), 'Daftar Aset');

    $expectedHeaders = [
        'No', 'ID Aset', 'Kode Barang', 'No. Register', 'Nama Aset',
        'Kategori', 'Subkategori', 'Merk/Tipe', 'Tahun Perolehan', 'Tanggal Perolehan',
        'Sumber Perolehan', 'Harga Perolehan', 'Nilai Buku', 'Kondisi', 'Status Aset',
        'Unit Kerja', 'Penanggung Jawab', 'No. Dokumen', 'Keterangan',
    ];

    expect($rows[8])->toBe($expectedHeaders)
        ->and(count($rows[8]))->toBe(19);

    $heading = array_flip($rows[8]);
    $data = array_slice($rows, 9, 4);

    $special = collect($data)->first(fn ($r) => $r[$heading['Nama Aset']] === '=SUM(1+1)');
    expect($special)->not->toBeNull()
        ->and($special[$heading['No. Register']])->toBe('0007')
        ->and($special[$heading['ID Aset']])->toBe('1.3.2.05.02.04')
        ->and($special[$heading['Kode Barang']])->toBe('1.3.2.05.02.04.004')
        ->and($special[$heading['Merk/Tipe']])->toBe('Informa')
        ->and($special[$heading['Tahun Perolehan']])->toEqual(2022)
        ->and($special[$heading['Harga Perolehan']])->toEqual(1000)
        ->and($special[$heading['Nilai Buku']])->toEqual(800)
        ->and($special[$heading['No. Dokumen']])->toBe('DOC-001')
        ->and($special[$heading['Keterangan']])->toBe('Inventaris ruang camat');

    $total = wbFind($rows, 'TOTAL');
    expect($total)->not->toBeNull()
        ->and($total[$heading['Harga Perolehan']])->toEqual(6500)
        ->and($total[$heading['Nilai Buku']])->toEqual(3400);
});

it('labels the filters on the Daftar Aset sheet', function () {
    $book = wbBuild($this->camat, ['category_id' => $this->alat->id, 'kondisi' => 'baik']);
    $rows = wbRows($book, 'Daftar Aset');

    expect($rows[5][0])->toBe('Filter: Kategori: ALAT KANTOR; Kondisi: Baik');
});
