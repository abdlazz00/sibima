<?php

require __DIR__.'/../vendor/autoload.php';

use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

ini_set('memory_limit', '1024M');

$sourceFile = 'docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx';
$targetFile = 'docs/DATA_ASET_KECAMATAN_SAGULUNG_SIAP_IMPOR.xlsx';

echo "Reading source file: {$sourceFile}...\n";
$reader = IOFactory::createReaderForFile($sourceFile);
$reader->setLoadSheetsOnly(['MASTER_ASET']);
$reader->setReadDataOnly(true);
$spreadsheetSource = $reader->load($sourceFile);
$sheetSource = $spreadsheetSource->getActiveSheet();
$highestRow = $sheetSource->getHighestRow();

// Employee mapping: Leader NIP by Unit
$leaderNips = [
    'kecamatan sagulung' => '199211042014061001', // M. ARFIE ERANOV. S, S.STP (Camat Sagulung)
    'kelurahan sungai lekop' => '199308172015071001', // BIDA AUGUSTA, S.STP, MH (Lurah)
    'kelurahan sungai pelunggut' => '198003082011011005', // BAHADMAWAND,SH.,MH (Lurah)
    'kelurahan sungai binti' => '199110252015071001', // RENDI IFANDILA, S.STP.,M.Ak (Lurah)
    'kelurahan sagulung kota' => '197607082012121001', // SABAR, S.H (Lurah)
    'kelurahan tembesi' => '199512012017081004', // M. DAYATUL TARMIZI, S.STP (Lurah)
    'kelurahan sungai langkai' => '197703252007011011', // ALPIZAR, SH (Lurah)
];

$headers = [
    'Kode Barang', 'No. Register', 'Nama Aset', 'Kategori', 'Subkategori', 'Merk/Tipe',
    'Tanggal Perolehan', 'Sumber Perolehan', 'Harga Perolehan', 'Nilai Buku', 'Kondisi',
    'Unit', 'Penanggung Jawab', 'No. Dokumen', 'Keterangan',
];

$spreadsheetTarget = new Spreadsheet;
$sheetTarget = $spreadsheetTarget->getActiveSheet();
$sheetTarget->setTitle('Sheet1');

// Write headers to Row 1
$colIdx = 1;
foreach ($headers as $header) {
    $colLetter = Coordinate::stringFromColumnIndex($colIdx);
    $sheetTarget->setCellValue("{$colLetter}1", $header);
    $colIdx++;
}

$targetRow = 2;
$processedCount = 0;

for ($r = 3; $r <= $highestRow; $r++) {
    $namaAset = trim((string) $sheetSource->getCell("F{$r}")->getValue());
    if ($namaAset === '') {
        continue;
    }

    $kodeBarang = trim((string) $sheetSource->getCell("D{$r}")->getValue());
    $noRegister = (int) trim((string) $sheetSource->getCell("E{$r}")->getValue());
    $kategori = trim((string) $sheetSource->getCell("G{$r}")->getValue());
    $subkategori = trim((string) $sheetSource->getCell("H{$r}")->getValue());
    $merk = trim((string) $sheetSource->getCell("I{$r}")->getValue());
    $rawDate = trim((string) $sheetSource->getCell("L{$r}")->getValue());
    $sumber = trim((string) $sheetSource->getCell("M{$r}")->getValue()) ?: 'Belanja Modal';
    $harga = (float) str_replace([',', ' '], '', (string) $sheetSource->getCell("N{$r}")->getValue());
    $buku = (float) str_replace([',', ' '], '', (string) $sheetSource->getCell("O{$r}")->getValue());
    $kondisiRaw = trim((string) $sheetSource->getCell("P{$r}")->getValue());
    $unit = trim((string) $sheetSource->getCell("S{$r}")->getValue());
    $pjRaw = trim((string) $sheetSource->getCell("T{$r}")->getValue());
    $dokumen = trim((string) $sheetSource->getCell("U{$r}")->getValue());
    $keterangan = trim((string) $sheetSource->getCell("W{$r}")->getValue());

    // Normalize date to dd-mm-yyyy
    $tanggalFormatted = '01-01-2023';
    if ($rawDate !== '') {
        try {
            $tanggalFormatted = Carbon::createFromFormat('d-m-Y', $rawDate)->format('d-m-Y');
        } catch (Throwable) {
            $parsed = strtotime($rawDate);
            $tanggalFormatted = $parsed ? date('d-m-Y', $parsed) : '01-01-2023';
        }
    }

    // Normalize condition
    $kondisi = match (strtolower($kondisiRaw)) {
        'rusak ringan', 'rusak_ringan' => 'Rusak Ringan',
        'rusak berat', 'rusak_berat' => 'Rusak Berat',
        'hilang' => 'Hilang',
        default => 'Baik',
    };

    // Resolve holder NIP if PJ is Camat or Lurah
    $unitKey = strtolower($unit);
    $holderNip = '';
    if ($pjRaw !== '' && isset($leaderNips[$unitKey])) {
        $holderNip = $leaderNips[$unitKey];
    }

    // Ensure Nilai Buku <= Harga Perolehan
    if ($buku > $harga) {
        $buku = $harga;
    }

    // Set values into target sheet
    $sheetTarget->setCellValue("A{$targetRow}", $kodeBarang);
    $sheetTarget->setCellValue("B{$targetRow}", $noRegister);
    $sheetTarget->setCellValue("C{$targetRow}", $namaAset);
    $sheetTarget->setCellValue("D{$targetRow}", $kategori);
    $sheetTarget->setCellValue("E{$targetRow}", $subkategori);
    $sheetTarget->setCellValue("F{$targetRow}", $merk);
    $sheetTarget->setCellValue("G{$targetRow}", $tanggalFormatted);
    $sheetTarget->setCellValue("H{$targetRow}", $sumber);
    $sheetTarget->setCellValue("I{$targetRow}", $harga);
    $sheetTarget->setCellValue("J{$targetRow}", $buku);
    $sheetTarget->setCellValue("K{$targetRow}", $kondisi);
    $sheetTarget->setCellValue("L{$targetRow}", $unit);
    $sheetTarget->setCellValue("M{$targetRow}", $holderNip);
    $sheetTarget->setCellValue("N{$targetRow}", $dokumen);
    $sheetTarget->setCellValue("O{$targetRow}", $keterangan);

    $targetRow++;
    $processedCount++;
}

// Styling
$lastCol = Coordinate::stringFromColumnIndex(count($headers));
$lastRow = $targetRow - 1;

// Header Style
$headerRange = "A1:{$lastCol}1";
$sheetTarget->getStyle($headerRange)->applyFromArray([
    'font' => [
        'bold' => true,
        'color' => ['rgb' => 'FFFFFF'],
        'size' => 11,
    ],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => '1E40AF'], // Tailwind blue-800
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
]);
$sheetTarget->getRowDimension(1)->setRowHeight(28);

// Content Style
$sheetTarget->getStyle("A2:{$lastCol}{$lastRow}")->applyFromArray([
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => 'CBD5E1'],
        ],
    ],
    'alignment' => [
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
]);

// Number formatting for prices
$sheetTarget->getStyle("I2:J{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');
$sheetTarget->getStyle("B2:B{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheetTarget->getStyle("G2:G{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheetTarget->getStyle("K2:K{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

// Auto-size columns
for ($c = 1; $c <= count($headers); $c++) {
    $colLetter = Coordinate::stringFromColumnIndex($c);
    $sheetTarget->getColumnDimension($colLetter)->setAutoSize(true);
}

// Save
$writer = IOFactory::createWriter($spreadsheetTarget, 'Xlsx');
$writer->save($targetFile);

echo "SUCCESS! Created {$targetFile} with {$processedCount} verified asset rows.\n";
