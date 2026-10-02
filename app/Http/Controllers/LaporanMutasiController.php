<?php

namespace App\Http\Controllers;

use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Http\Requests\LaporanMutasiRequest;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Unit;
use App\Services\MutationExcel;
use App\Services\MutationRecapService;
use App\Services\ReportQuery;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanMutasiController extends Controller
{
    private const PER_PAGE = 25;

    /** Fixed map: user input only picks a key, it never becomes SQL. */
    private const SORT_COLUMNS = [
        'nomor_mutasi' => 'asset_mutations.nomor_mutasi',
        'tanggal_mutasi' => 'asset_mutations.tanggal_mutasi',
        'jumlah_aset' => 'jumlah_aset',
        'nilai' => 'nilai',
        'status' => 'asset_mutations.status',
    ];

    public function index(LaporanMutasiRequest $request, MutationRecapService $recap): Response
    {
        $user = $request->user();
        $filters = $request->filters();
        $sort = $request->sorting();
        $query = new ReportQuery($user);

        $mutasis = $query->build('mutasi', $filters)
            ->select('asset_mutations.*')
            ->selectSub(
                AssetMutationItem::query()->selectRaw('COUNT(*)')->whereColumn('asset_mutation_items.asset_mutation_id', 'asset_mutations.id'),
                'jumlah_aset',
            )
            ->selectSub(
                DB::table('asset_mutation_items as mi')->join('assets as ma', 'ma.id', '=', 'mi.asset_id')
                    ->selectRaw('COALESCE(SUM(ma.nilai_perolehan), 0)')->whereColumn('mi.asset_mutation_id', 'asset_mutations.id'),
                'nilai',
            )
            ->reorder(self::SORT_COLUMNS[$sort['urut']], $sort['arah'])
            ->orderByDesc('asset_mutations.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (AssetMutation $m) => $this->row($m));

        $visible = fn () => $query->build('mutasi', [])->reorder()->toBase()->distinct();
        $unitIds = $visible()->pluck('asset_mutations.origin_unit_id')->merge($visible()->pluck('asset_mutations.destination_unit_id'))->unique();

        return Inertia::render('LaporanMutasi/Index', [
            'filters' => $filters,
            'sort' => $sort,
            ...$recap->for($user, $filters),
            'mutasis' => $mutasis,
            'unitOptions' => Unit::whereIn('id', $unitIds)->orderBy('type')->orderBy('name')->get(['id', 'name', 'type']),
            'jenisOptions' => array_map(fn (MutationType $c) => ['value' => $c->value, 'label' => $c->label()], MutationType::cases()),
            'statusOptions' => array_map(fn (MutationStatus $c) => ['value' => $c->value, 'label' => $c->label()], MutationStatus::cases()),
        ]);
    }

    public function unduh(LaporanMutasiRequest $request, MutationExcel $excel): StreamedResponse
    {
        $filters = $request->filters();
        $query = (new ReportQuery($request->user()))->build('mutasi', $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $excel->download($query, $filters, $request->user());
    }

    /** @return array<string, mixed> */
    private function row(AssetMutation $m): array
    {
        $steps = $m->approvalRequest?->steps ?? collect();

        return [
            'id' => $m->id,
            'nomor_mutasi' => $m->nomor_mutasi,
            'tanggal_mutasi' => $m->tanggal_mutasi?->format('Y-m-d'),
            'jenis' => $m->jenis_mutasi->value,
            'jenis_label' => $m->jenis_mutasi->label(),
            'asal' => $m->originUnit?->name,
            'tujuan' => $m->destinationUnit?->name,
            'jumlah_aset' => (int) $m->getAttribute('jumlah_aset'),
            'nilai' => (float) $m->getAttribute('nilai'),
            'status' => $m->status->value,
            'pengaju' => $m->creator?->name,
            'detail' => [
                'keterangan' => $m->keterangan,
                'aset' => $m->items->map(fn ($item) => [
                    'kode_barang' => $item->asset?->kode_barang,
                    'nama_aset' => $item->asset?->nama_aset,
                    'kategori' => $item->asset?->category?->parent?->name ?? $item->asset?->category?->name,
                    'kondisi' => $item->asset?->kondisi->value,
                    'nilai_perolehan' => (float) ($item->asset?->nilai_perolehan ?? 0),
                    'pemegang_tujuan' => $item->targetHolder?->nama,
                    'catatan' => $item->catatan,
                ])->values()->all(),
                'persetujuan' => ($m->approvalRequest?->actions ?? collect())->sortBy('id')->map(fn ($a) => [
                    'langkah' => $steps->firstWhere('step_order', $a->step_order)?->label,
                    'aksi' => $a->action->value,
                    'oleh' => $a->user?->name,
                    'waktu' => $a->created_at?->toIso8601String(),
                    'catatan' => $a->note,
                ])->values()->all(),
            ],
        ];
    }
}
