<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\MutationStatus;
use App\Models\AssetMutation;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MutationExcel
{
    public function __construct(private readonly ReportSheetWriter $writer) {}

    /** @param  array<string, mixed>  $filters */
    public function download(Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            'laporan-mutasi-'.now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to a few thousand mutations, beyond that use a streaming writer.
     *
     * @param  array<string, mixed>  $filters
     */
    private function build(Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Daftar Mutasi');

        $columns = [
            ['No', 'int'], ['Nomor Mutasi', 'text'], ['Tanggal', 'date'], ['Jenis', 'text'], ['Unit Asal', 'text'],
            ['Unit Tujuan', 'text'], ['Jumlah Aset', 'int'], ['Daftar Aset', 'wrap'], ['Nilai Perolehan', 'money'],
            ['Status', 'text'], ['Diajukan Oleh', 'text'], ['Tanggal Diajukan', 'date'], ['Tanggal Selesai', 'date'],
            ['Lama Proses (hari)', 'decimal'], ['Keterangan', 'wrap'],
        ];

        $rows = [];
        $all = ['aset' => 0, 'nilai' => 0.0];
        $approved = ['aset' => 0, 'nilai' => 0.0];

        foreach ($query->get() as $index => $m) {
            /** @var AssetMutation $m */
            $jumlah = $m->items->count();
            $nilai = (float) $m->items->sum(fn ($item) => (float) ($item->asset?->nilai_perolehan ?? 0));
            $request = $m->approvalRequest;
            $diajukan = $request?->created_at;
            $selesai = $m->status === MutationStatus::Approved
                ? $request?->actions->where('action', ApprovalActionType::Approve)->max('created_at')
                : null;

            $all['aset'] += $jumlah;
            $all['nilai'] += $nilai;
            if ($m->status === MutationStatus::Approved) {
                $approved['aset'] += $jumlah;
                $approved['nilai'] += $nilai;
            }

            $rows[] = [
                $index + 1, $m->nomor_mutasi, $m->tanggal_mutasi, $m->jenis_mutasi->label(),
                $m->originUnit?->name, $m->destinationUnit?->name, $jumlah,
                $m->items->map(fn ($item) => ($item->asset?->kode_barang ?? '-').' - '.($item->asset?->nama_aset ?? '-'))->implode("\n"),
                $nilai, $m->status->label(), $m->creator?->name, $diajukan, $selesai,
                $diajukan !== null && $selesai !== null ? Days::between($diajukan, $selesai) : null,
                $m->keterangan,
            ];
        }

        $rows[] = [null, 'Total Semua Status', null, null, null, null, $all['aset'], null, $all['nilai']];
        $boldRows = [count($rows) - 1];
        $total = [null, 'Total Disetujui', null, null, null, null, $approved['aset'], null, $approved['nilai']];

        $start = $this->writer->kop(
            $sheet,
            'Laporan Mutasi Aset',
            $this->writer->scopeLabel($user, []),
            $this->writer->filterLabel($filters),
            count($columns),
        );
        $this->writer->table($sheet, $start, $columns, $rows, $total, $boldRows, true);

        return $spreadsheet;
    }
}
