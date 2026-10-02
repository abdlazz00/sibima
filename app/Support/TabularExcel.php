<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Penulis tabular polos untuk template, ekspor, dan laporan error import. */
final class TabularExcel
{
    /**
     * ponytail: dibangun di memori oleh PhpSpreadsheet; aman sampai batas ekspor 10.000 baris,
     * di atas itu perlu penulis streaming.
     *
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     * @param  list<string>  $petunjuk
     */
    public static function build(array $headers, iterable $rows, array $petunjuk = []): Spreadsheet
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Data');

        $write = function (int $r, array $row) use ($sheet) {
            foreach (array_values($row) as $c => $value) {
                if ($value === null || $value === '') {
                    continue;
                }

                $cell = Coordinate::stringFromColumnIndex($c + 1).$r;
                is_string($value)
                    ? $sheet->setCellValueExplicit($cell, $value, DataType::TYPE_STRING)
                    : $sheet->setCellValue($cell, $value);
            }
        };

        $write(1, $headers);
        $r = 2;
        foreach ($rows as $row) {
            $write($r++, $row);
        }

        $sheet->getStyle('A1:'.Coordinate::stringFromColumnIndex(count($headers)).'1')->getFont()->setBold(true);
        $sheet->freezePane('A2');
        foreach (range(1, count($headers)) as $i) {
            $sheet->getColumnDimensionByColumn($i)->setWidth(18);
        }

        if ($petunjuk !== []) {
            $help = $book->createSheet()->setTitle('Petunjuk');
            foreach ($petunjuk as $i => $line) {
                $help->setCellValueExplicit('A'.($i + 1), $line, DataType::TYPE_STRING);
            }
            $help->getColumnDimension('A')->setWidth(110);
        }

        $book->setActiveSheetIndex(0);

        return $book;
    }

    public static function download(Spreadsheet $book, string $filename): StreamedResponse
    {
        return response()->streamDownload(
            fn () => (new Xlsx($book))->save('php://output'),
            $filename,
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }
}
