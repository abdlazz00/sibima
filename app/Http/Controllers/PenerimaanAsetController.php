<?php

namespace App\Http\Controllers;

use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Http\Requests\StoreBeritaAcaraRequest;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PenerimaanAsetController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', BeritaAcaraPenerimaan::class);

        $user = $request->user();

        $query = BeritaAcaraPenerimaan::with(['unit', 'creator', 'items', 'approvalRequest'])
            ->when(! $user->hasRole('kasubag'), fn (Builder $q) => $q->whereIn('unit_id', $user->accessibleUnitIds() ?? []))
            ->when($request->search, fn (Builder $q, $search) => $q->where(fn (Builder $q2) => $q2
                ->where('no_berita_acara', 'like', "%{$search}%")
                ->orWhereHas('items', fn (Builder $q3) => $q3->where('nama_aset', 'like', "%{$search}%"))
            ))
            ->latest('tanggal_penerimaan');

        return Inertia::render('Penerimaan/Index', [
            'items' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
            'can' => ['create' => $user->can('create', BeritaAcaraPenerimaan::class)],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', BeritaAcaraPenerimaan::class);

        return Inertia::render('Penerimaan/Create', [
            'categories' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ]);
    }

    public function store(StoreBeritaAcaraRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $ba = DB::transaction(function () use ($data, $user, $request) {
            $ba = BeritaAcaraPenerimaan::create([
                'no_berita_acara' => $data['no_berita_acara'],
                'tanggal_penerimaan' => $data['tanggal_penerimaan'],
                'sumber_perolehan' => $data['sumber_perolehan'] ?? null,
                'no_kontrak_spk' => $data['no_kontrak_spk'],
                'vendor' => $data['vendor'] ?? null,
                'catatan' => $data['catatan'] ?? null,
                'status' => $data['status'],
                'unit_id' => $user->unit_id,
                'created_by' => $user->id,
            ]);

            foreach ($data['items'] as $item) {
                $ba->items()->create($item);
            }

            foreach ($request->file('dokumen', []) as $file) {
                $ba->photos()->create(['path' => $file->store("berita-acara/{$ba->id}", 'public')]);
            }

            return $ba;
        });

        if ($ba->status === BeritaAcaraStatus::Submitted) {
            $this->workflow->submit($ba, 'penerimaan_aset', $user);
        }

        return redirect()->route('penerimaan-aset.show', $ba)
            ->with('success', $ba->status === BeritaAcaraStatus::Submitted
                ? 'Penerimaan aset berhasil diajukan.'
                : 'Draft berhasil disimpan.');
    }

    public function show(Request $request, BeritaAcaraPenerimaan $beritaAcara): Response
    {
        Gate::authorize('view', $beritaAcara);

        $beritaAcara->load([
            'unit', 'creator', 'items.category',
            'approvalRequest.definition.steps', 'approvalRequest.actions.user',
        ]);

        $approvalRequest = $beritaAcara->approvalRequest;

        return Inertia::render('Penerimaan/Show', [
            'beritaAcara' => $beritaAcara,
            'can' => [
                'act' => $approvalRequest !== null && $this->workflow->canAct($request->user(), $approvalRequest),
            ],
        ]);
    }
}
