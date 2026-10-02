<?php

use App\Support\ExcelRows;
use App\Support\TabularExcel;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

function impFlatten(iterable $chunks): array
{
    $all = [];
    foreach ($chunks as $chunk) {
        foreach ($chunk as $no => $row) {
            $all[$no] = $row;
        }
    }

    return $all;
}

it('reads every row exactly once across chunk boundaries', function (int $n) {
    $rows = array_map(fn ($i) => ["item-{$i}", $i], range(1, $n));
    $path = impXlsx(['Nama', 'Nomor'], $rows)->getPathname();

    $all = impFlatten(ExcelRows::chunks($path, ['Nama', 'Nomor'], 500));

    expect(ExcelRows::totalRows($path))->toBe($n)
        ->and($all)->toHaveCount($n)
        ->and(array_key_first($all))->toBe(2)
        ->and(array_key_last($all))->toBe($n + 1)
        ->and($all[$n + 1])->toEqual(['Nama' => "item-{$n}", 'Nomor' => $n]);
})->with([499, 500, 501]);

it('skips blank rows but keeps the original Excel row numbers', function () {
    $path = impXlsx(['A', 'B'], [['x', 1], [null, null], ['y', 2]])->getPathname();

    $all = impFlatten(ExcelRows::chunks($path, ['A', 'B'], 500));

    expect(array_keys($all))->toBe([2, 4])
        ->and($all[4])->toEqual(['A' => 'y', 'B' => 2]);
});

it('returns the trimmed header row', function () {
    $path = impXlsx(['  Nama ', 'Nomor'], [['x', 1]])->getPathname();

    expect(ExcelRows::headers($path, 2))->toBe(['Nama', 'Nomor']);
});

it('counts zero data rows for a header-only file', function () {
    $path = impXlsx(['A', 'B'], [])->getPathname();

    expect(ExcelRows::totalRows($path))->toBe(0)
        ->and(impFlatten(ExcelRows::chunks($path, ['A', 'B'], 500)))->toBe([]);
});

it('writes strings as text so formula-looking cells are never executed', function () {
    $book = TabularExcel::build(['Nama', 'Jumlah'], [['=SUM(1+1)', 5], ['@cmd', 7.5], ['0007', null]], ['Baris petunjuk']);
    $path = tempnam(sys_get_temp_dir(), 'tab').'.xlsx';
    (new Xlsx($book))->save($path);

    $loaded = IOFactory::load($path);
    $data = $loaded->getSheetByName('Data');

    expect($loaded->getSheetNames())->toBe(['Data', 'Petunjuk'])
        ->and($data->getCell('A2')->getDataType())->toBe(DataType::TYPE_STRING)
        ->and($data->getCell('A2')->getValue())->toBe('=SUM(1+1)')
        ->and($data->getCell('B2')->getValue())->toEqual(5)
        ->and($data->getCell('A4')->getValue())->toBe('0007')
        ->and($data->getCell('B4')->getValue())->toBeNull()
        ->and($loaded->getSheetByName('Petunjuk')->getCell('A1')->getValue())->toBe('Baris petunjuk');
});

it('has no Petunjuk sheet when none is given', function () {
    expect(TabularExcel::build(['A'], [['x']])->getSheetNames())->toBe(['Data']);
});
