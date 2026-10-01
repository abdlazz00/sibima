<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExporter
{
    private const HEADER_ROW = 6;

    private const TITLES = [
        'aset' => 'Laporan Daftar Aset',
        'mutasi' => 'Laporan Riwayat Mutasi',
        'rusak-hilang' => 'Laporan Aset Rusak dan Hilang',
    ];

    /** @param  array<string, mixed>  $filters */
    public function download(string $kind, Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($kind, $query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            "laporan-{$kind}-".now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to tens of thousands of rows,
     * beyond that switch to a streaming writer (chunked query + OpenSpout).
     *
     * @param  array<string, mixed>  $filters
     */
    private function build(string $kind, Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Laporan');

        $sheet->setCellValueExplicit('A1', self::TITLES[$kind], DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A2', 'Cakupan: '.$this->scopeLabel($user, $filters), DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A3', 'Filter: '.$this->filterLabel($filters), DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A4', 'Dicetak: '.now()->format('d/m/Y H:i'), DataType::TYPE_STRING);
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        $columns = $this->columns($kind);
        $headerRow = self::HEADER_ROW;

        foreach ($columns as $i => $column) {
            $sheet->setCellValueExplicit(Coordinate::stringFromColumnIndex($i + 1).$headerRow, $column[0], DataType::TYPE_STRING);
        }

        $row = $headerRow;
        foreach ($query->get() as $index => $model) {
            $row++;
            foreach ($columns as $i => $column) {
                $coordinate = Coordinate::stringFromColumnIndex($i + 1).$row;
                $value = $column[1]($model, $index);
                $type = $column[2] ?? 'text';

                if ($type === 'date' && $value !== null) {
                    $sheet->setCellValue($coordinate, Date::PHPToExcel($value));
                } elseif (in_array($type, ['money', 'number'], true) && $value !== null) {
                    $sheet->setCellValue($coordinate, $value);
                } else {
                    $sheet->setCellValueExplicit($coordinate, (string) ($value ?? ''), DataType::TYPE_STRING);
                }
            }
        }

        $this->style($sheet, $columns, $headerRow, $row);

        return $spreadsheet;
    }

    /** @param  list<array<int, mixed>>  $columns */
    private function style(Worksheet $sheet, array $columns, int $headerRow, int $lastRow): void
    {
        $lastColumn = Coordinate::stringFromColumnIndex(count($columns));

        $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
        ]);
        $sheet->freezePane('A'.($headerRow + 1));

        foreach ($columns as $i => $column) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);
            $type = $column[2] ?? 'text';
            $range = $letter.($headerRow + 1).':'.$letter.$lastRow;

            if ($type === 'wrap') {
                $sheet->getColumnDimension($letter)->setWidth(45);
                if ($lastRow > $headerRow) {
                    $sheet->getStyle($range)->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
                }
            } else {
                $sheet->getColumnDimension($letter)->setAutoSize(true);
            }

            if ($lastRow > $headerRow && in_array($type, ['money', 'date'], true)) {
                $sheet->getStyle($range)->getNumberFormat()->setFormatCode($type === 'money' ? '#,##0' : 'dd/mm/yyyy');
            }
        }
    }

    /** @return list<array{0: string, 1: callable, 2?: string}> */
    private function columns(string $kind): array
    {
        return match ($kind) {
            'aset' => [
                ['No', fn (Asset $a, int $i) => $i + 1, 'number'],
                ['Kode Barang', fn (Asset $a) => $a->kode_barang],
                ['No. Register', fn (Asset $a) => $a->registerLabel()],
                ['Nama Aset', fn (Asset $a) => $a->nama_aset],
                ['Kategori', fn (Asset $a) => $a->category?->parent?->name ?? $a->category?->name],
                ['Subkategori', fn (Asset $a) => $a->category?->parent_id !== null ? $a->category->name : null],
                ['Merk/Tipe', fn (Asset $a) => $a->merk_type],
                ['Unit', fn (Asset $a) => $a->unit?->name],
                ['Pemegang', fn (Asset $a) => $a->currentHolder?->nama],
                ['Kondisi', fn (Asset $a) => $a->kondisi->label()],
                ['Status', fn (Asset $a) => $a->status->label()],
                ['Tanggal Perolehan', fn (Asset $a) => $a->tanggal_perolehan, 'date'],
                ['Sumber Perolehan', fn (Asset $a) => $a->sumber_perolehan],
                ['Nilai Perolehan', fn (Asset $a) => (float) $a->nilai_perolehan, 'money'],
                ['Nilai Buku', fn (Asset $a) => (float) $a->nilai_buku, 'money'],
                ['No. Dokumen', fn (Asset $a) => $a->no_dokumen],
                ['Keterangan', fn (Asset $a) => $a->keterangan, 'wrap'],
            ],
            'mutasi' => [
                ['No', fn (AssetMutation $m, int $i) => $i + 1, 'number'],
                ['Nomor Mutasi', fn (AssetMutation $m) => $m->nomor_mutasi],
                ['Jenis', fn (AssetMutation $m) => $m->jenis_mutasi->label()],
                ['Unit Asal', fn (AssetMutation $m) => $m->originUnit?->name],
                ['Unit Tujuan', fn (AssetMutation $m) => $m->destinationUnit?->name],
                ['Tanggal', fn (AssetMutation $m) => $m->tanggal_mutasi, 'date'],
                ['Status', fn (AssetMutation $m) => $m->status->label()],
                ['Jumlah Aset', fn (AssetMutation $m) => $m->items->count(), 'number'],
                ['Daftar Aset', fn (AssetMutation $m) => $m->items->map(fn ($item) => ($item->asset?->kode_barang ?? '-').' - '.($item->asset?->nama_aset ?? '-'))->implode("\n"), 'wrap'],
                ['Diajukan Oleh', fn (AssetMutation $m) => $m->creator?->name],
                ['Keterangan', fn (AssetMutation $m) => $m->keterangan, 'wrap'],
            ],
            'rusak-hilang' => [
                ['No', fn (AssetReport $r, int $i) => $i + 1, 'number'],
                ['Nomor Laporan', fn (AssetReport $r) => $r->nomor_laporan],
                ['Aset', fn (AssetReport $r) => $r->asset?->nama_aset],
                ['Kode Barang', fn (AssetReport $r) => $r->asset?->kode_barang],
                ['Unit', fn (AssetReport $r) => $r->unit?->name],
                ['Jenis', fn (AssetReport $r) => $r->jenis->label()],
                ['Kondisi Baru', fn (AssetReport $r) => $r->kondisi_baru->label()],
                ['Tanggal Kejadian', fn (AssetReport $r) => $r->tanggal_kejadian, 'date'],
                ['Status', fn (AssetReport $r) => $r->status->label()],
                ['Pelapor', fn (AssetReport $r) => $r->creator?->name],
                ['Pemegang', fn (AssetReport $r) => $r->pegawai?->nama],
                ['Kronologi', fn (AssetReport $r) => $r->kronologi, 'wrap'],
            ],
        };
    }

    /** @param  array<string, mixed>  $filters */
    private function scopeLabel(User $user, array $filters): string
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
    private function filterLabel(array $filters): string
    {
        $parts = [];

        if (! empty($filters['category_id'])) {
            $parts[] = 'Kategori: '.(AssetCategory::find($filters['category_id'])?->name ?? $filters['category_id']);
        }

        foreach (['kondisi' => 'Kondisi', 'status' => 'Status', 'jenis' => 'Jenis', 'dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: {$filters[$key]}";
            }
        }

        return $parts === [] ? 'Tanpa filter' : implode('; ', $parts);
    }
}
