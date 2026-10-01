<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetRecapWorkbook
{
    public function __construct(private readonly ReportSheetWriter $writer) {}

    /**
     * @param  array<string, mixed>  $recap
     * @param  array<string, mixed>  $filters
     */
    public function download(array $recap, Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($recap, $query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            'laporan-aset-'.now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to tens of thousands of rows.
     *
     * @param  array<string, mixed>  $recap
     * @param  array<string, mixed>  $filters
     */
    private function build(array $recap, Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $scope = $this->writer->scopeLabel($user, $filters);
        $filter = $this->writer->filterLabel($filters);

        $this->ringkasan($this->sheet($spreadsheet, 0, 'Ringkasan'), $recap, $scope, $filter);
        $this->daftar($this->sheet($spreadsheet, 1, 'Daftar Rinci'), $recap, $query, $scope, $filter);
        $this->rekapKategori($this->sheet($spreadsheet, 2, 'Rekap Kategori'), $recap, $scope, $filter);

        $next = 3;
        if ($recap['rekap_unit'] !== null) {
            $this->rekapUnit($this->sheet($spreadsheet, $next++, 'Rekap Unit'), $recap, $scope, $filter);
        }

        $this->tren($this->sheet($spreadsheet, $next, 'Tren Tahunan'), $recap, $scope, $filter);
        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }

    private function sheet(Spreadsheet $spreadsheet, int $index, string $name): Worksheet
    {
        $sheet = $index === 0 ? $spreadsheet->getActiveSheet() : $spreadsheet->createSheet();
        $sheet->setTitle($name);

        return $sheet;
    }

    /** @param  array<string, mixed>  $recap */
    private function ringkasan(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $start = $this->writer->kop($sheet, 'Ringkasan Laporan Aset', $scope, $filter, 4);
        $r = $recap['ringkasan'];

        $next = $this->writer->table($sheet, $start, [['Uraian', 'text'], ['Nilai', 'money']], [
            ['Jumlah Aset', $r['jumlah']],
            ['Total Nilai Perolehan', $r['nilai_perolehan']],
            ['Total Nilai Buku', $r['nilai_buku']],
        ]);

        $this->writer->table(
            $sheet,
            $next + 1,
            [['Kondisi', 'text'], ['Jumlah', 'int'], ['Persen (%)', 'percent']],
            array_map(fn (array $k) => [$k['label'], $k['jumlah'], $k['persen']], $recap['kondisi']),
            ['Total', $r['jumlah'], array_sum(array_column($recap['kondisi'], 'persen'))],
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function daftar(Worksheet $sheet, array $recap, Builder $query, string $scope, string $filter): void
    {
        $columns = [
            ['No', 'int'], ['Kode Barang', 'text'], ['No. Register', 'text'], ['Nama Aset', 'text'], ['Kategori', 'text'],
            ['Subkategori', 'text'], ['Merk/Tipe', 'text'], ['Unit', 'text'], ['Pemegang', 'text'], ['Kondisi', 'text'],
            ['Status', 'text'], ['Tanggal Perolehan', 'date'], ['Sumber Perolehan', 'text'], ['Nilai Perolehan', 'money'],
            ['Nilai Buku', 'money'], ['No. Dokumen', 'text'], ['Keterangan', 'wrap'],
        ];

        $rows = [];
        foreach ($query->get() as $index => $a) {
            /** @var Asset $a */
            $rows[] = [
                $index + 1, $a->kode_barang, $a->registerLabel(), $a->nama_aset,
                $a->category?->parent?->name ?? $a->category?->name,
                $a->category?->parent_id !== null ? $a->category->name : null,
                $a->merk_type, $a->unit?->name, $a->currentHolder?->nama, $a->kondisi->label(), $a->status->label(),
                $a->tanggal_perolehan, $a->sumber_perolehan, (float) $a->nilai_perolehan, (float) $a->nilai_buku,
                $a->no_dokumen, $a->keterangan,
            ];
        }

        $start = $this->writer->kop($sheet, 'Daftar Rinci Aset', $scope, $filter, count($columns));
        $total = array_fill(0, count($columns), null);
        $total[1] = 'TOTAL';
        $total[13] = $recap['ringkasan']['nilai_perolehan'];
        $total[14] = $recap['ringkasan']['nilai_buku'];

        $this->writer->table($sheet, $start, $columns, $rows, $total, [], true);
    }

    /** @param  array<string, mixed>  $recap */
    private function rekapKategori(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $rows = [];
        $bold = [];

        foreach ($recap['rekap_kategori']['grup'] as $group) {
            $bold[] = count($rows);
            $rows[] = [$group['nama'], null, $group['jumlah'], $group['nilai_perolehan'], $group['nilai_buku']];

            foreach ($group['anak'] as $child) {
                $rows[] = [null, $child['nama'], $child['jumlah'], $child['nilai_perolehan'], $child['nilai_buku']];
            }
        }

        $t = $recap['rekap_kategori']['total'];
        $start = $this->writer->kop($sheet, 'Rekap Aset per Kategori', $scope, $filter, 5);
        $this->writer->table(
            $sheet,
            $start,
            [['Kategori', 'text'], ['Subkategori', 'text'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            $rows,
            ['Total', null, $t['jumlah'], $t['nilai_perolehan'], $t['nilai_buku']],
            $bold,
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function rekapUnit(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $t = $recap['rekap_unit']['total'];
        $start = $this->writer->kop($sheet, 'Rekap Aset per Unit', $scope, $filter, 4);
        $this->writer->table(
            $sheet,
            $start,
            [['Unit', 'text'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            array_map(fn (array $u) => [$u['nama'], $u['jumlah'], $u['nilai_perolehan'], $u['nilai_buku']], $recap['rekap_unit']['baris']),
            ['Total', $t['jumlah'], $t['nilai_perolehan'], $t['nilai_buku']],
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function tren(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $r = $recap['ringkasan'];
        $start = $this->writer->kop($sheet, 'Tren Aset per Tahun Perolehan', $scope, $filter, 4);
        $this->writer->table(
            $sheet,
            $start,
            [['Tahun', 'year'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            array_map(fn (array $y) => [$y['tahun'], $y['jumlah'], $y['nilai_perolehan'], $y['nilai_buku']], $recap['tren']),
            ['Total', $r['jumlah'], $r['nilai_perolehan'], $r['nilai_buku']],
        );
    }
}
