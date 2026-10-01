<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReportRequest;
use App\Models\Unit;
use App\Services\ReportExporter;
use App\Services\ReportQuery;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(ReportRequest $request): Response
    {
        $user = $request->user();
        $kind = $request->input('laporan') ?: 'mutasi';
        $filters = $request->filters();
        $ids = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        return Inertia::render('Report/Index', [
            'laporan' => $kind,
            'filters' => $filters,
            'rowCount' => (new ReportQuery($user))->build($kind, $filters)->count(),
            'units' => $units->count() > 1 ? $units : [],
        ]);
    }

    public function download(ReportRequest $request, string $laporan, ReportExporter $exporter): StreamedResponse
    {
        $filters = $request->filters();
        $query = (new ReportQuery($request->user()))->build($laporan, $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $exporter->download($laporan, $query, $filters, $request->user());
    }
}
