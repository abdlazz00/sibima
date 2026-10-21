<?php

use App\Imports\AsetImporter;
use App\Imports\RowResult;
use App\Models\User;
use Database\Seeders\AssetCategorySeeder;
use Database\Seeders\PegawaiSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use PhpOffice\PhpSpreadsheet\IOFactory;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class, AssetCategorySeeder::class, PegawaiSeeder::class]);
});

it('validates every row in DATA_ASET_KECAMATAN_SAGULUNG_SIAP_IMPOR without errors', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super-admin');

    $file = base_path('docs/DATA_ASET_KECAMATAN_SAGULUNG_SIAP_IMPOR.xlsx');
    expect(file_exists($file))->toBeTrue();

    $importer = app(AsetImporter::class);
    $importer->begin($admin);

    $reader = IOFactory::createReaderForFile($file);
    $reader->setReadDataOnly(true);
    $spreadsheet = $reader->load($file);
    $sheet = $spreadsheet->getActiveSheet();

    $headerRow = [];
    foreach ($sheet->getRowIterator(1, 1)->current()->getCellIterator() as $cell) {
        $headerRow[] = trim((string) $cell->getValue());
    }

    expect($headerRow)->toBe($importer->headers());

    $highestRow = $sheet->getHighestRow();
    expect($highestRow)->toBe(332); // 1 header + 331 data rows

    $errorsFound = [];

    for ($r = 2; $r <= $highestRow; $r++) {
        $row = [];
        $colIdx = 0;
        foreach ($sheet->getRowIterator($r, $r)->current()->getCellIterator() as $cell) {
            $colName = $headerRow[$colIdx] ?? "Col_{$colIdx}";
            $row[$colName] = $cell->getValue();
            $colIdx++;
        }

        $res = $importer->validate($row);
        if ($res->status === RowResult::ERROR) {
            $errorsFound[$r] = $res->errors;
        }
    }

    expect($errorsFound)->toBeEmpty();
});
