<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Http\Requests\ReportRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Services\AssetRecapService;
use App\Services\AssetRecapWorkbook;
use App\Services\ReportQuery;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanAsetController extends Controller
{
    private const PER_PAGE = 25;

    public function index(ReportRequest $request, AssetRecapService $recap): Response
    {
        $user = $request->user();
        $filters = $request->filters();
        $sort = $request->sorting();
        $ids = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        $asets = (new ReportQuery($user))->build('aset', $filters)
            ->reorder($sort['urut'], $sort['arah'])
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Asset $a) => $this->row($a));

        return Inertia::render('LaporanAset/Index', [
            'filters' => $filters,
            'sort' => $sort,
            ...$recap->for($user, $filters),
            'asets' => $asets,
            'units' => $units->count() > 1 ? $units : [],
            'categories' => AssetCategory::whereNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ]);
    }

    public function unduh(ReportRequest $request, AssetRecapService $recap, AssetRecapWorkbook $workbook): StreamedResponse
    {
        $user = $request->user();
        $filters = $request->filters();
        $query = (new ReportQuery($user))->build('aset', $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $workbook->download($recap->for($user, $filters), $query, $filters, $user);
    }

    /** @return array<string, mixed> */
    private function row(Asset $a): array
    {
        return [
            'id' => $a->id,
            'kode_barang' => $a->kode_barang,
            'nomor_register' => $a->registerLabel(),
            'nama_aset' => $a->nama_aset,
            'merk_type' => $a->merk_type,
            'kategori' => $a->category?->parent?->name ?? $a->category?->name,
            'subkategori' => $a->category?->parent_id !== null ? $a->category->name : null,
            'unit' => $a->unit?->name,
            'tahun_perolehan' => $a->tanggal_perolehan?->format('Y'),
            'kondisi' => $a->kondisi->value,
            'nilai_perolehan' => (float) $a->nilai_perolehan,
            'nilai_buku' => (float) $a->nilai_buku,
            'detail' => [
                'pemegang' => $a->currentHolder?->nama,
                'status' => $a->status->value,
                'sumber_perolehan' => $a->sumber_perolehan,
                'no_dokumen' => $a->no_dokumen,
                'keterangan' => $a->keterangan,
            ],
        ];
    }
}
