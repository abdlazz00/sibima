<?php

namespace App\Http\Controllers;

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Http\Requests\ClosePermohonanRequest;
use App\Http\Requests\FulfillPermohonanRequest;
use App\Http\Requests\StorePermohonanRequest;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use App\Support\ListSort;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetRequestController extends Controller
{
    public function __construct(
        private readonly AssetRequestService $requests,
        private readonly ApprovalWorkflowService $workflow,
    ) {}

    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['id', 'asc']]],
    ];

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetRequest::class);

        $user = $request->user();
        $unitIds = $user->accessibleUnitIds();
        $canSeeBinaan = $user->unit?->isKecamatan() || in_array($user->resolveUnitScope(), ['binaan', 'all'], true);
        $binaanIds = $canSeeBinaan && $user->unit_id !== null
            ? Unit::where('parent_id', $user->unit_id)->pluck('id')->all()
            : [];

        $query = AssetRequest::with(['pegawai', 'unit', 'category', 'creator', 'approvalRequest'])
            ->when($unitIds !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereIn('unit_id', $unitIds)
                ->orWhere(fn (Builder $x) => $x->where('jenis', AssetRequestType::Unit)->whereIn('unit_id', $binaanIds))
            ))
            ->when($request->status, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->jenis, fn (Builder $q, string $jenis) => $q->where('jenis', $jenis))
            ->when($request->boolean('menunggu_pemenuhan'), fn (Builder $q) => $q->where('status', AssetRequestStatus::Approved)->whereNull('mutation_id'))
            ->when($request->search, fn (Builder $q, string $search) => $q->where(fn (Builder $q2) => $q2
                ->where('nomor_permohonan', 'like', "%{$search}%")
                ->orWhere('keterangan', 'like', "%{$search}%")
            ));

        $items = ListSort::apply($query, self::SORTS, $request->input('urut'))->paginate(15)->withQueryString();

        return Inertia::render('AssetRequests/Index', [
            'items' => $items,
            'filters' => $request->only('search', 'status', 'jenis', 'menunggu_pemenuhan', 'urut'),
            'sortOptions' => ListSort::options(self::SORTS),
            'can' => ['create' => $user->can('create', AssetRequest::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetRequest::class);

        $user = $request->user();

        return Inertia::render('AssetRequests/Create', [
            'pegawais' => Pegawai::whereIn('unit_id', $user->accessibleUnitIds() ?? [])
                ->orderBy('nama')->get(['id', 'nama', 'jabatan']),
            'categories' => AssetCategory::whereNotNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'canUnit' => $user->can('permohonan.create') && ($user->unit?->isKelurahan() ?? false),
        ]);
    }

    public function store(StorePermohonanRequest $request): RedirectResponse
    {
        try {
            $assetRequest = $this->requests->create($request->validated(), $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('asset-requests.show', $assetRequest)
            ->with('success', "Permohonan #{$assetRequest->nomor_permohonan} berhasil diajukan.");
    }

    public function show(Request $request, AssetRequest $assetRequest): Response
    {
        Gate::authorize('view', $assetRequest);

        $assetRequest->load([
            'pegawai', 'unit', 'category', 'creator', 'fulfiller', 'mutation', 'assets',
            'approvalRequest.definition', 'approvalRequest.steps', 'approvalRequest.actions.user',
        ]);

        $approval = $assetRequest->approvalRequest;
        $user = $request->user();
        $canReassign = $approval !== null && $this->workflow->canReassign($user, $approval);
        $canFulfill = $assetRequest->status === AssetRequestStatus::Approved
            && $assetRequest->mutation_id === null
            && $this->requests->canFulfill($user, $assetRequest);

        $canClose = $assetRequest->status === AssetRequestStatus::Approved
            && $assetRequest->mutation_id === null
            && $this->requests->canClose($user, $assetRequest);

        return Inertia::render('AssetRequests/Show', [
            'assetRequest' => $assetRequest,
            'can' => [
                'act' => $approval !== null && $this->workflow->canAct($user, $approval),
                'cancel' => $approval !== null && $this->workflow->canCancel($user, $approval),
                'reassign' => $canReassign,
                'fulfill' => $canFulfill,
                'close' => $canClose,
            ],
            'reassignCandidates' => $canReassign ? $this->workflow->reassignCandidates() : [],
            'eligibleAssets' => $canFulfill
                ? $this->requests->eligibleAssets($assetRequest)->map(fn ($a) => [
                    'id' => $a->id,
                    'kode_barang' => $a->kode_barang,
                    'nomor_register' => $a->nomor_register,
                    'nama_aset' => $a->nama_aset,
                    'merk_type' => $a->merk_type,
                    'kondisi' => $a->kondisi->value,
                ])->values()
                : [],
        ]);
    }

    public function fulfill(FulfillPermohonanRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        $ids = array_map('intval', $request->validated('asset_ids'));

        try {
            if ($assetRequest->jenis === AssetRequestType::Pegawai) {
                if (count($ids) !== 1) {
                    throw new InvalidArgumentException('Pilih tepat satu aset untuk permohonan pegawai.');
                }

                $this->requests->fulfillPegawai($assetRequest, $ids[0], $request->user());
                $message = 'Aset berhasil diserahkan kepada pegawai.';
            } else {
                $mutation = $this->requests->fulfillUnit($assetRequest, $ids, $request->user());
                $message = "Mutasi #{$mutation->nomor_mutasi} diajukan untuk memenuhi permohonan.";
            }
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $message);
    }

    public function close(ClosePermohonanRequest $request, AssetRequest $assetRequest): RedirectResponse
    {
        try {
            $this->requests->close($assetRequest, $request->validated('note'), $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Permohonan ditutup.');
    }
}
