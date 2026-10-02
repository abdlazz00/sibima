<?php

namespace App\Support;

use Generator;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;

/**
 * Membaca sheet pertama .xlsx per jendela baris agar memori tetap kecil
 * (satu berkas besar pernah menghabiskan 128 MB bila dimuat utuh).
 */
final class ExcelRows implements IReadFilter
{
    private int $from = 1;

    private int $to = 1;

    public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
    {
        return $row >= $this->from && $row <= $this->to;
    }

    /** Jumlah baris di bawah header (baris kosong ikut terhitung). */
    public static function totalRows(string $path): int
    {
        $info = (new Xlsx)->listWorksheetInfo($path)[0] ?? null;

        return max(0, ($info['totalRows'] ?? 0) - 1);
    }

    /** @return list<string> */
    public static function headers(string $path, int $count): array
    {
        return array_map(fn ($v) => trim((string) $v), (new self)->read($path, 1, 1, $count)[0] ?? []);
    }

    /**
     * @param  list<string>  $headers
     * @return Generator<int, array<int, array<string, mixed>>>
     */
    public static function chunks(string $path, array $headers, int $size): Generator
    {
        $reader = new self;
        $last = self::totalRows($path) + 1;

        for ($start = 2; $start <= $last; $start += $size) {
            $rows = [];

            foreach ($reader->read($path, $start, min($start + $size - 1, $last), count($headers)) as $i => $values) {
                $filled = array_filter($values, fn ($v) => $v !== null && trim((string) $v) !== '');

                if ($filled !== []) {
                    $rows[$start + $i] = array_combine($headers, $values);
                }
            }

            yield $rows;
        }
    }

    /** @return list<list<mixed>> */
    private function read(string $path, int $from, int $to, int $columns): array
    {
        $this->from = $from;
        $this->to = $to;

        $xlsx = new Xlsx;
        $xlsx->setReadDataOnly(true);
        $xlsx->setReadFilter($this);
        $xlsx->setLoadSheetsOnly([$xlsx->listWorksheetNames($path)[0]]);

        $book = $xlsx->load($path);
        $values = $book->getActiveSheet()->rangeToArray(
            'A'.$from.':'.Coordinate::stringFromColumnIndex($columns).$to,
            null, true, false, false,
        );
        $book->disconnectWorksheets();

        return $values;
    }
}
