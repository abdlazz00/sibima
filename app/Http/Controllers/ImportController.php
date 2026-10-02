<?php

namespace App\Http\Controllers;

use App\Models\ImportBatch;
use App\Services\ImportService;
use App\Support\TabularExcel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    private const LABEL = ['kategori' => 'Kategori Aset', 'pegawai' => 'Pegawai', 'aset' => 'Data Aset'];

    private const BATCH_FIELDS = [
        'id', 'nama_berkas', 'status', 'total_baris', 'jumlah_baru', 'jumlah_duplikat',
        'jumlah_error', 'jumlah_masuk', 'progres', 'pesan',
    ];

    public function __construct(private readonly ImportService $imports) {}

    public function show(Request $request, string $modul): Response
    {
        $this->authorizeModul($request, $modul);

        $riwayat = $this->visibleBatches($request, $modul)->with('user')->latest('id')->limit(20)->get();
        $batch = $request->filled('batch')
            ? $riwayat->firstWhere('id', $request->integer('batch'))
            : $riwayat->first(fn (ImportBatch $b) => in_array($b->status, [ImportBatch::MEMERIKSA, ImportBatch::SIAP, ImportBatch::MEMPROSES], true));
        $showPreview = $batch !== null && in_array($batch->status, [ImportBatch::SIAP, ImportBatch::SELESAI], true);

        return Inertia::render('Import/Index', [
            'modul' => $modul,
            'label' => self::LABEL[$modul],
            'batch' => $batch?->only(self::BATCH_FIELDS),
            'preview' => $showPreview ? $this->imports->preview($batch) : ['errors' => [], 'peringatan' => []],
            'riwayat' => $riwayat->map(fn (ImportBatch $b) => $b->only([
                'id', 'nama_berkas', 'status', 'jumlah_baru', 'jumlah_duplikat', 'jumlah_error', 'jumlah_masuk', 'created_at',
            ]) + ['pengunggah' => $b->user?->name])->values(),
            'maxKb' => config('import.max_kb'),
            'maxRows' => config('import.max_rows'),
        ]);
    }

    public function store(Request $request, string $modul): RedirectResponse
    {
        $this->authorizeModul($request, $modul);

        $request->validate(
            ['berkas' => ['required', 'file', 'extensions:xlsx', 'max:'.config('import.max_kb')]],
            [
                'berkas.required' => 'Pilih berkas Excel (.xlsx).',
                'berkas.extensions' => 'Berkas harus berformat .xlsx.',
                'berkas.max' => 'Ukuran berkas maksimal '.(config('import.max_kb') / 1024).' MB.',
            ],
        );

        $batch = $this->imports->upload($modul, $request->file('berkas'), $request->user());

        return redirect()->route('import.show', ['modul' => $modul, 'batch' => $batch->id]);
    }

    public function confirm(Request $request, string $modul, ImportBatch $batch): RedirectResponse
    {
        $this->authorizeBatch($request, $modul, $batch);

        $started = $this->imports->confirm($batch);

        return redirect()->route('import.show', ['modul' => $modul, 'batch' => $batch->id])->with(
            $started ? 'success' : 'error',
            $started ? 'Impor dimulai.' : 'Batch ini tidak bisa dikonfirmasi (sudah diproses atau tidak ada baris baru).',
        );
    }

    public function errors(Request $request, string $modul, ImportBatch $batch): StreamedResponse
    {
        $this->authorizeBatch($request, $modul, $batch);

        return TabularExcel::download($this->imports->errorReport($batch), "laporan-error-{$modul}-{$batch->id}.xlsx");
    }

    public function template(Request $request, string $modul): StreamedResponse
    {
        $this->authorizeModul($request, $modul);

        $importer = ImportService::importer($modul);

        return TabularExcel::download(
            TabularExcel::build($importer->headers(), [$importer->contoh()], $importer->petunjuk()),
            "template-impor-{$modul}.xlsx",
        );
    }

    private function authorizeModul(Request $request, string $modul): void
    {
        abort_unless($request->user()->can("import-{$modul}"), 403);
    }

    private function authorizeBatch(Request $request, string $modul, ImportBatch $batch): void
    {
        $this->authorizeModul($request, $modul);

        abort_unless($batch->modul === $modul && $this->canSee($request, $batch), 404);
    }

    private function canSee(Request $request, ImportBatch $batch): bool
    {
        return $request->user()->accessibleUnitIds() === null || $batch->user_id === $request->user()->id;
    }

    /** @return Builder<ImportBatch> */
    private function visibleBatches(Request $request, string $modul): Builder
    {
        return ImportBatch::query()->where('modul', $modul)
            ->when($request->user()->accessibleUnitIds() !== null, fn (Builder $q) => $q->where('user_id', $request->user()->id));
    }
}
