<?php

namespace App\Http\Controllers;

use App\Services\ImportService;
use App\Support\TabularExcel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __invoke(Request $request, string $modul): StreamedResponse|RedirectResponse
    {
        abort_unless($request->user()->can("export-{$modul}"), 403);

        $importer = ImportService::importer($modul);
        $importer->begin($request->user());
        $filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi', 'urut']);

        if ($importer->exportCount($filters) > config('import.export_max')) {
            return back()->with('error', 'Data melebihi '.number_format(config('import.export_max'), 0, ',', '.').' baris. Persempit dengan filter lalu ekspor lagi.');
        }

        return TabularExcel::download(
            TabularExcel::build($importer->headers(), $importer->export($filters)),
            "data-{$modul}-".now()->format('Y-m-d').'.xlsx',
        );
    }
}
