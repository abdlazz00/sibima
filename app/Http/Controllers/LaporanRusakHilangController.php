<?php

namespace App\Http\Controllers;

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Http\Requests\LaporanRusakHilangRequest;
use App\Models\AssetCategory;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Services\AssetReportExcel;
use App\Services\AssetReportRecapService;
use App\Services\ReportQuery;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanRusakHilangController extends Controller
{
    private const PER_PAGE = 25;

    /** Fixed map: user input only picks a key, it never becomes raw SQL. */
    private const SORT_COLUMNS = [
        'nomor_laporan' => 'asset_reports.nomor_laporan',
        'tanggal_kejadian' => 'asset_reports.tanggal_kejadian',
        'nama_aset' => 'a.nama_aset',
        'kondisi_baru' => 'asset_reports.kondisi_baru',
        'nilai_perolehan' => 'a.nilai_perolehan',
        'nilai_buku' => 'a.nilai_buku',
        'status' => 'asset_reports.status',
    ];

    public function index(LaporanRusakHilangRequest $request, AssetReportRecapService $recap): Response
    {
        $user = $request->user();
        $filters = $request->filters();
        $sort = $request->sorting();
        $query = new ReportQuery($user);

        $reports = $query->build('rusak-hilang', $filters)
            ->leftJoin('assets as a', 'a.id', '=', 'asset_reports.asset_id')
            ->select('asset_reports.*')
            ->reorder(self::SORT_COLUMNS[$sort['urut']] ?? 'asset_reports.tanggal_kejadian', $sort['arah'])
            ->orderByDesc('asset_reports.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (AssetReport $r) => $this->row($r));

        $ids = $user->accessibleUnitIds();
        $units = Unit::query()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        return Inertia::render('LaporanRusakHilang/Index', [
            'filters' => $filters,
            'sort' => $sort,
            ...$recap->for($user, $filters),
            'reports' => $reports,
            'unitOptions' => $units,
            'categoryOptions' => AssetCategory::whereNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => array_map(
                fn (Kondisi $c) => ['value' => $c->value, 'label' => $c->label()],
                [Kondisi::RusakRingan, Kondisi::RusakBerat, Kondisi::Hilang],
            ),
            'statusOptions' => array_map(
                fn (AssetReportStatus $c) => ['value' => $c->value, 'label' => $c->label()],
                AssetReportStatus::cases(),
            ),
        ]);
    }

    public function unduh(LaporanRusakHilangRequest $request, AssetReportExcel $excel): StreamedResponse
    {
        $filters = $request->filters();
        $query = (new ReportQuery($request->user()))->build('rusak-hilang', $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $excel->download($query, $filters, $request->user());
    }

    /** @return array<string, mixed> */
    private function row(AssetReport $r): array
    {
        $steps = $r->approvalRequest?->steps ?? collect();
        $actions = $r->approvalRequest?->actions ?? collect();

        return [
            'id' => $r->id,
            'nomor_laporan' => $r->nomor_laporan,
            'tanggal_kejadian' => $r->tanggal_kejadian?->format('Y-m-d'),
            'nama_aset' => $r->asset?->nama_aset,
            'kode_barang' => $r->asset?->kode_barang,
            'merk_type' => $r->asset?->merk_type,
            'kategori' => $r->asset?->category?->parent?->name ?? $r->asset?->category?->name,
            'unit' => $r->unit?->name,
            'pemegang' => $r->pegawai?->nama,
            'jenis' => $r->jenis?->value,
            'jenis_label' => $r->jenis?->label(),
            'kondisi_baru' => $r->kondisi_baru?->value,
            'kondisi_label' => $r->kondisi_baru?->label(),
            'nilai_perolehan' => (float) ($r->asset?->nilai_perolehan ?? 0),
            'nilai_buku' => (float) ($r->asset?->nilai_buku ?? 0),
            'status' => $r->status?->value,
            'status_label' => $r->status?->label(),
            'pengaju' => $r->creator?->name,
            'detail' => [
                'kronologi' => $r->kronologi,
                'photos' => $r->photos->map(fn ($p) => [
                    'id' => $p->id,
                    'url' => $p->url,
                ]),
                'alur_persetujuan' => $steps->map(fn ($s) => [
                    'step_order' => $s->step_order,
                    'label' => $s->label,
                    'role' => $s->approver_role,
                    'tipe' => $s->approver_type?->value,
                ]),
                'riwayat_persetujuan' => $actions->map(fn ($a) => [
                    'id' => $a->id,
                    'step_order' => $a->step_order,
                    'user' => $a->user?->name,
                    'action' => $a->action->value,
                    'action_label' => $a->action->label(),
                    'note' => $a->note,
                    'created_at' => $a->created_at?->format('Y-m-d H:i'),
                ]),
            ],
        ];
    }
}
