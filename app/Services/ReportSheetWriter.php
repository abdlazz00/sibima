<?php

namespace App\Services;

use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Enums\MutationType;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Letterhead, table helper and human labels shared by the Excel reports. */
class ReportSheetWriter
{
    public const FIRST_TABLE_ROW = 9;

    private const STATUS = [
        'pending' => 'Menunggu Persetujuan', 'approved' => 'Disetujui', 'rejected' => 'Ditolak', 'cancelled' => 'Dibatalkan',
    ];

    private const FORMATS = ['int' => '#,##0', 'money' => '#,##0', 'percent' => '0.0', 'decimal' => '0.0', 'year' => '0', 'date' => 'dd/mm/yyyy'];

    /** Writes the official letterhead and returns the first free row for the table header. */
    public function kop(Worksheet $sheet, string $title, string $scope, string $filter, int $columns): int
    {
        $last = Coordinate::stringFromColumnIndex(max($columns, 6));
        $logo = public_path('images/lambang-kota-batam.png');

        if (is_file($logo)) {
            $drawing = new Drawing;
            $drawing->setName('Lambang Kota Batam');
            $drawing->setPath($logo);
            $drawing->setHeight(58);
            $drawing->setCoordinates('A1');
            $drawing->setOffsetX(4);
            $drawing->setOffsetY(2);
            $drawing->setWorksheet($sheet);
        }

        foreach ([1 => ['PEMERINTAH KOTA BATAM', 12], 2 => ['KECAMATAN SAGULUNG', 12], 3 => [$title, 14]] as $row => [$text, $size]) {
            $sheet->mergeCells("B{$row}:{$last}{$row}");
            $sheet->setCellValueExplicit("B{$row}", $text, DataType::TYPE_STRING);
            $sheet->getStyle("B{$row}")->getFont()->setBold(true)->setSize($size);
            $sheet->getRowDimension($row)->setRowHeight(20);
        }

        foreach ([5 => "Cakupan: {$scope}", 6 => "Filter: {$filter}", 7 => 'Dicetak: '.now()->format('d/m/Y H:i')] as $row => $text) {
            $sheet->mergeCells("A{$row}:{$last}{$row}");
            $sheet->setCellValueExplicit("A{$row}", $text, DataType::TYPE_STRING);
        }

        return self::FIRST_TABLE_ROW;
    }

    /**
     * Writes a header, the rows and an optional totals row; returns the next free row.
     *
     * @param  list<array{0: string, 1: string}>  $columns  [heading, kind]; kind: text|wrap|int|money|percent|year|date
     * @param  list<list<mixed>>  $rows
     * @param  list<mixed>|null  $total
     * @param  list<int>  $boldRows  zero-based indexes into $rows
     */
    public function table(Worksheet $sheet, int $headerRow, array $columns, array $rows, ?array $total = null, array $boldRows = [], bool $freeze = false): int
    {
        $lastLetter = Coordinate::stringFromColumnIndex(count($columns));

        foreach ($columns as $i => [$heading]) {
            $sheet->setCellValueExplicit(Coordinate::stringFromColumnIndex($i + 1).$headerRow, $heading, DataType::TYPE_STRING);
        }
        $sheet->getStyle("A{$headerRow}:{$lastLetter}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
            'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $row = $headerRow;
        foreach ($rows as $index => $cells) {
            $row++;
            $this->writeRow($sheet, $row, $columns, $cells);
            if (in_array($index, $boldRows, true)) {
                $sheet->getStyle("A{$row}:{$lastLetter}{$row}")->getFont()->setBold(true);
            }
        }

        if ($total !== null) {
            $row++;
            $this->writeRow($sheet, $row, $columns, $total);
            $sheet->getStyle("A{$row}:{$lastLetter}{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'borders' => ['top' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        foreach ($columns as $i => [, $kind]) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);

            if ($kind === 'wrap') {
                $sheet->getColumnDimension($letter)->setWidth(45);
                if ($row > $headerRow) {
                    $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$row}")->getAlignment()->setWrapText(true)->setVertical('top');
                }
            } else {
                $sheet->getColumnDimension($letter)->setAutoSize(true);
            }

            if ($row > $headerRow && isset(self::FORMATS[$kind])) {
                $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$row}")->getNumberFormat()->setFormatCode(self::FORMATS[$kind]);
            }
        }

        if ($freeze) {
            $sheet->freezePane('A'.($headerRow + 1));
        }

        return $row + 1;
    }

    /** @param  array<string, mixed>  $filters */
    public function scopeLabel(User $user, array $filters): string
    {
        if (! empty($filters['unit_id'])) {
            return Unit::find($filters['unit_id'])?->name ?? '-';
        }

        $ids = $user->accessibleUnitIds();

        return $ids === null
            ? 'Seluruh unit'
            : Unit::whereIn('id', $ids)->orderBy('type')->orderBy('name')->pluck('name')->implode(', ');
    }

    /** @param  array<string, mixed>  $filters */
    public function filterLabel(array $filters): string
    {
        $parts = [];

        if (! empty($filters['category_id'])) {
            $parts[] = 'Kategori: '.(AssetCategory::find($filters['category_id'])?->name ?? $filters['category_id']);
        }
        if (! empty($filters['kondisi'])) {
            $parts[] = 'Kondisi: '.(Kondisi::tryFrom($filters['kondisi'])?->label() ?? $filters['kondisi']);
        }
        if (! empty($filters['jenis'])) {
            $parts[] = 'Jenis: '.(AssetReportType::tryFrom($filters['jenis'])?->label() ?? $filters['jenis']);
        }
        if (! empty($filters['jenis_mutasi'])) {
            $parts[] = 'Jenis Mutasi: '.(MutationType::tryFrom($filters['jenis_mutasi'])?->label() ?? $filters['jenis_mutasi']);
        }
        if (! empty($filters['status'])) {
            $parts[] = 'Status: '.(self::STATUS[$filters['status']] ?? $filters['status']);
        }
        foreach (['asal_id' => 'Unit Asal', 'tujuan_id' => 'Unit Tujuan'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: ".(Unit::find($filters[$key])?->name ?? $filters[$key]);
            }
        }
        foreach (['dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: {$filters[$key]}";
            }
        }

        return $parts === [] ? 'Tanpa filter' : implode('; ', $parts);
    }

    /**
     * @param  list<array{0: string, 1: string}>  $columns
     * @param  list<mixed>  $cells
     */
    private function writeRow(Worksheet $sheet, int $row, array $columns, array $cells): void
    {
        foreach ($columns as $i => [, $kind]) {
            $value = $cells[$i] ?? null;

            if ($value === null || $value === '') {
                continue;
            }

            $coordinate = Coordinate::stringFromColumnIndex($i + 1).$row;

            match ($kind) {
                'int', 'money', 'percent', 'decimal', 'year' => $sheet->setCellValue($coordinate, $value),
                'date' => $sheet->setCellValue($coordinate, Date::PHPToExcel($value)),
                default => $sheet->setCellValueExplicit($coordinate, (string) $value, DataType::TYPE_STRING),
            };
        }
    }
}
