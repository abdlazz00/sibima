<?php

namespace App\Http\Controllers;

use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Http\Requests\StoreBeritaAcaraRequest;
use App\Http\Requests\UpdateBeritaAcaraRequest;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use App\Support\ListSort;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PenerimaanAsetController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['tanggal_penerimaan', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['tanggal_penerimaan', 'asc'], ['id', 'asc']]],
    ];

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', BeritaAcaraPenerimaan::class);

        $user = $request->user();

        $query = BeritaAcaraPenerimaan::with(['unit', 'creator', 'items.category', 'approvalRequest'])
            ->when(! $user->hasRole('kasubag'), fn (Builder $q) => $q->whereIn('unit_id', $user->accessibleUnitIds() ?? []))
            ->when(! $user->hasRole('admin_kecamatan'), fn (Builder $q) => $q->where('status', BeritaAcaraStatus::Submitted))
            ->when($request->search, fn (Builder $q, $search) => $q->where(fn (Builder $q2) => $q2
                ->where('no_berita_acara', 'like', "%{$search}%")
                ->orWhereHas('items', fn (Builder $q3) => $q3->where('nama_aset', 'like', "%{$search}%"))
            ))
            ->when($request->status, fn (Builder $q, string $status) => $this->filterByStatus($q, $status))
            ->when($request->dari, fn (Builder $q, $dari) => $q->whereDate('tanggal_penerimaan', '>=', $dari))
            ->when($request->sampai, fn (Builder $q, $sampai) => $q->whereDate('tanggal_penerimaan', '<=', $sampai));

        ListSort::apply($query, self::SORTS, $request->input('urut'));

        return Inertia::render('Penerimaan/Index', [
            'items' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search', 'status', 'dari', 'sampai', 'urut'),
            'sortOptions' => ListSort::options(self::SORTS),
            'can' => ['create' => $user->can('create', BeritaAcaraPenerimaan::class)],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', BeritaAcaraPenerimaan::class);

        return Inertia::render('Penerimaan/Create', $this->formOptions());
    }

    public function store(StoreBeritaAcaraRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $ba = DB::transaction(function () use ($data, $user, $request) {
            $ba = BeritaAcaraPenerimaan::create([
                ...$this->headerFields($data),
                'unit_id' => $user->unit_id,
                'created_by' => $user->id,
            ]);

            $this->syncItemsAndDocuments($ba, $data, $request);
            $this->submitIfRequested($ba, $user);

            return $ba;
        });

        return redirect()->route('penerimaan-aset.show', $ba)
            ->with('success', $ba->status === BeritaAcaraStatus::Submitted
                ? 'Penerimaan aset berhasil diajukan.'
                : 'Draft berhasil disimpan.');
    }

    public function edit(BeritaAcaraPenerimaan $beritaAcara): Response
    {
        Gate::authorize('update', $beritaAcara);

        return Inertia::render('Penerimaan/Edit', [
            ...$this->formOptions(),
            'beritaAcara' => $beritaAcara->load(['items', 'photos']),
        ]);
    }

    public function update(UpdateBeritaAcaraRequest $request, BeritaAcaraPenerimaan $beritaAcara): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $request, $beritaAcara) {
            $beritaAcara->update($this->headerFields($data));
            $beritaAcara->items()->delete();

            $this->removeDocuments($beritaAcara, $data['hapus_dokumen'] ?? []);
            $this->syncItemsAndDocuments($beritaAcara, $data, $request);
            $this->submitIfRequested($beritaAcara, $request->user());
        });

        return redirect()->route('penerimaan-aset.show', $beritaAcara)
            ->with('success', $beritaAcara->fresh()->status === BeritaAcaraStatus::Submitted
                ? 'Penerimaan aset berhasil diajukan.'
                : 'Draft berhasil diperbarui.');
    }

    public function destroy(BeritaAcaraPenerimaan $beritaAcara): RedirectResponse
    {
        Gate::authorize('delete', $beritaAcara);

        DB::transaction(function () use ($beritaAcara) {
            $this->removeDocuments($beritaAcara, $beritaAcara->photos()->pluck('id')->all());
            $beritaAcara->items()->delete();
            $beritaAcara->delete();
        });

        return redirect()->route('penerimaan-aset.index')->with('success', 'Draft dihapus.');
    }

    public function show(Request $request, BeritaAcaraPenerimaan $beritaAcara): Response
    {
        Gate::authorize('view', $beritaAcara);

        $beritaAcara->load([
            'unit', 'creator', 'items.category',
            'approvalRequest.definition', 'approvalRequest.steps', 'approvalRequest.actions.user',
        ]);

        $approvalRequest = $beritaAcara->approvalRequest;
        $user = $request->user();

        return Inertia::render('Penerimaan/Show', [
            'beritaAcara' => $beritaAcara,
            'can' => [
                'act' => $approvalRequest !== null && $this->workflow->canAct($user, $approvalRequest),
                'cancel' => $approvalRequest !== null && $this->workflow->canCancel($user, $approvalRequest),
                'edit' => $user->can('update', $beritaAcara),
                'delete' => $user->can('delete', $beritaAcara),
                'reassign' => $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest),
            ],
            'reassignCandidates' => $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest)
                ? $this->workflow->reassignCandidates()
                : [],
        ]);
    }

    /** @return array<string, mixed> */
    private function formOptions(): array
    {
        return [
            'categories' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ];
    }

    /** @return array<string, mixed> */
    private function headerFields(array $data): array
    {
        return [
            'no_berita_acara' => $data['no_berita_acara'],
            'tanggal_penerimaan' => $data['tanggal_penerimaan'],
            'sumber_perolehan' => $data['sumber_perolehan'] ?? null,
            'no_kontrak_spk' => $data['no_kontrak_spk'],
            'vendor' => $data['vendor'] ?? null,
            'catatan' => $data['catatan'] ?? null,
            'status' => $data['status'],
        ];
    }

    private function syncItemsAndDocuments(BeritaAcaraPenerimaan $ba, array $data, Request $request): void
    {
        foreach ($data['items'] as $item) {
            $ba->items()->create($item);
        }

        foreach ($request->file('dokumen', []) as $file) {
            $ba->photos()->create(['path' => $file->store("berita-acara/{$ba->id}", 'public')]);
        }
    }

    /** @param  list<int>  $photoIds */
    private function removeDocuments(BeritaAcaraPenerimaan $ba, array $photoIds): void
    {
        foreach ($ba->photos()->whereIn('id', $photoIds)->get() as $photo) {
            Storage::disk('public')->delete($photo->path);
            $photo->delete();
        }
    }

    private function submitIfRequested(BeritaAcaraPenerimaan $ba, $user): void
    {
        if ($ba->status === BeritaAcaraStatus::Submitted && $ba->approvalRequest()->doesntExist()) {
            $this->workflow->submit($ba, 'penerimaan_aset', $user);
        }
    }

    private function filterByStatus(Builder $query, string $status): void
    {
        $request = fn (string $s) => fn (Builder $q) => $q->whereHas('approvalRequest', fn (Builder $r) => $r->where('status', $s));

        match ($status) {
            'draft' => $query->where('status', BeritaAcaraStatus::Draft),
            'diajukan' => $query->whereHas('approvalRequest', fn (Builder $r) => $r->where('status', 'pending')->where('current_step', '<', 2)),
            'diverifikasi' => $query->whereHas('approvalRequest', fn (Builder $r) => $r->where('status', 'pending')->where('current_step', '>=', 2)),
            'disetujui' => $request('approved')($query),
            'ditolak' => $request('rejected')($query),
            'dibatalkan' => $request('cancelled')($query),
            default => null,
        };
    }
}
