<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\AssetReportStatus;
use App\Models\AssetReport;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetReportExcel
{
    public function __construct(private readonly ReportSheetWriter $writer) {}

    /** @param  array<string, mixed>  $filters */
    public function download(Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            'laporan-rusak-hilang-'.now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; safe for up to a few thousand reports.
     *
     * @param  array<string, mixed>  $filters
     */
    private function build(Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Daftar Rusak & Hilang');

        $columns = [
            ['No', 'int'],
            ['Nomor Laporan', 'text'],
            ['Tanggal Kejadian', 'date'],
            ['Kode Barang', 'text'],
            ['Nama Aset', 'text'],
            ['Merk / Tipe', 'text'],
            ['Kategori', 'text'],
            ['Unit Kerja', 'text'],
            ['Pemegang Aset', 'text'],
            ['Jenis Laporan', 'text'],
            ['Kondisi Dilaporkan', 'text'],
            ['Nilai Perolehan', 'money'],
            ['Nilai Buku', 'money'],
            ['Status', 'text'],
            ['Tanggal Selesai', 'date'],
            ['Lama Proses (hari)', 'decimal'],
            ['Kronologi', 'wrap'],
        ];

        $rows = [];
        $all = ['perolehan' => 0.0, 'buku' => 0.0];
        $approved = ['perolehan' => 0.0, 'buku' => 0.0];

        $reports = $query
            ->setEagerLoads([])
            ->with(['asset.category', 'unit', 'pegawai', 'approvalRequest.actions'])
            ->get();

        foreach ($reports as $index => $r) {
            /** @var AssetReport $r */
            $perolehan = (float) ($r->asset?->nilai_perolehan ?? 0.0);
            $buku = (float) ($r->asset?->nilai_buku ?? 0.0);
            $request = $r->approvalRequest;
            $diajukan = $request?->created_at;
            $selesai = $r->status === AssetReportStatus::Approved
                ? $request?->actions->where('action', ApprovalActionType::Approve)->max('created_at')
                : null;

            $all['perolehan'] += $perolehan;
            $all['buku'] += $buku;

            if ($r->status === AssetReportStatus::Approved) {
                $approved['perolehan'] += $perolehan;
                $approved['buku'] += $buku;
            }

            $rows[] = [
                $index + 1,
                $r->nomor_laporan,
                $r->tanggal_kejadian,
                $r->asset?->kode_barang ?? '-',
                $r->asset?->nama_aset ?? '-',
                $r->asset?->merk_type ?? '-',
                $r->asset?->category?->name ?? '-',
                $r->unit?->name ?? '-',
                $r->pegawai?->nama ?? '-',
                $r->jenis->label(),
                $r->kondisi_baru?->label() ?? $r->jenis->label(),
                $perolehan,
                $buku,
                $r->status->label(),
                $selesai,
                $diajukan !== null && $selesai !== null ? Days::between($diajukan, $selesai) : null,
                $r->kronologi,
            ];
        }

        $rows[] = [
            null, 'Total Semua Status', null, null, null, null, null, null, null, null, null,
            $all['perolehan'], $all['buku'],
        ];
        $boldRows = [count($rows) - 1];

        $total = [
            null, 'Total Disetujui', null, null, null, null, null, null, null, null, null,
            $approved['perolehan'], $approved['buku'],
        ];

        $start = $this->writer->kop(
            $sheet,
            'Laporan Aset Rusak & Hilang',
            $this->writer->scopeLabel($user, $filters),
            $this->writer->filterLabel($filters),
            count($columns),
        );

        $this->writer->table($sheet, $start, $columns, $rows, $total, $boldRows, true);

        return $spreadsheet;
    }
}
