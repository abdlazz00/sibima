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
     * @param  array<string, mixed>  $recap
     * @param  array<string, mixed>  $filters
     */
    private function build(array $recap, Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $scope = $this->writer->scopeLabel($user, $filters);
        $filter = $this->writer->filterLabel($filters);

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Daftar Aset');

        $this->daftar($sheet, $recap, $query, $scope, $filter);

        return $spreadsheet;
    }

    /** @param  array<string, mixed>  $recap */
    private function daftar(Worksheet $sheet, array $recap, Builder $query, string $scope, string $filter): void
    {
        $columns = [
            ['No', 'int'],
            ['ID Aset', 'text'],
            ['Kode Barang', 'text'],
            ['No. Register', 'text'],
            ['Nama Aset', 'text'],
            ['Kategori', 'text'],
            ['Subkategori', 'text'],
            ['Merk/Tipe', 'text'],
            ['Tahun Perolehan', 'year'],
            ['Tanggal Perolehan', 'date'],
            ['Sumber Perolehan', 'text'],
            ['Harga Perolehan', 'money'],
            ['Nilai Buku', 'money'],
            ['Kondisi', 'text'],
            ['Status Aset', 'text'],
            ['Unit Kerja', 'text'],
            ['Penanggung Jawab', 'text'],
            ['No. Dokumen', 'text'],
            ['Keterangan', 'wrap'],
        ];

        $rows = [];
        foreach ($query->get() as $index => $a) {
            /** @var Asset $a */
            $rows[] = [
                $index + 1,
                $a->category?->code ?? $a->category?->formatted_code ?? '-',
                $a->kode_barang,
                $a->registerLabel(),
                $a->nama_aset,
                $a->category?->parent?->name ?? $a->category?->name ?? '-',
                $a->category?->parent_id !== null ? $a->category->name : '-',
                $a->merk_type ?? '-',
                $a->tanggal_perolehan ? (int) $a->tanggal_perolehan->format('Y') : null,
                $a->tanggal_perolehan,
                $a->sumber_perolehan ?? '-',
                (float) $a->nilai_perolehan,
                (float) $a->nilai_buku,
                $a->kondisi->label(),
                $a->status->label(),
                $a->unit?->name ?? '-',
                $a->currentHolder?->nama ?? '-',
                $a->no_dokumen ?? '-',
                $a->keterangan ?? '-',
            ];
        }

        $start = $this->writer->kop($sheet, 'Daftar Aset', $scope, $filter, count($columns));
        $total = array_fill(0, count($columns), null);
        $total[1] = 'TOTAL';
        $total[11] = $recap['ringkasan']['nilai_perolehan'];
        $total[12] = $recap['ringkasan']['nilai_buku'];

        $this->writer->table($sheet, $start, $columns, $rows, $total, [], true);
    }
}
