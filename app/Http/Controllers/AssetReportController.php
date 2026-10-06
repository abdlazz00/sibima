<?php

namespace App\Http\Controllers;

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Http\Requests\StoreAssetReportRequest;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetReportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use App\Support\ListSort;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetReportController extends Controller
{
    public function __construct(
        private readonly AssetReportService $reports,
        private readonly ApprovalWorkflowService $workflow,
    ) {}

    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['tanggal_kejadian', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['tanggal_kejadian', 'asc'], ['id', 'asc']]],
    ];

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetReport::class);

        $user = $request->user();
        $unitIds = $user->accessibleUnitIds();

        $query = AssetReport::with(['asset', 'unit', 'creator', 'approvalRequest'])
            ->when($unitIds !== null, fn (Builder $q) => $q->whereIn('unit_id', $unitIds))
            ->when($request->status, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->jenis, fn (Builder $q, string $jenis) => $q->where('jenis', $jenis))
            ->when($request->search, fn (Builder $q, string $search) => $q->where(fn (Builder $q2) => $q2
                ->where('nomor_laporan', 'like', "%{$search}%")
                ->orWhereHas('asset', fn (Builder $q3) => $q3->where('nama_aset', 'like', "%{$search}%"))
            ));

        $items = ListSort::apply($query, self::SORTS, $request->input('urut'))->paginate(15)->withQueryString();

        return Inertia::render('AssetReports/Index', [
            'items' => $items,
            'filters' => $request->only('search', 'status', 'jenis', 'urut'),
            'sortOptions' => ListSort::options(self::SORTS),
            'can' => ['create' => $user->can('create', AssetReport::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetReport::class);

        $unitIds = $request->user()->accessibleUnitIds() ?? [];

        $assets = Asset::query()
            ->whereIn('unit_id', $unitIds)
            ->where('kondisi', '!=', Kondisi::Hilang)
            ->whereDoesntHave('reports', fn (Builder $q) => $q->where('status', AssetReportStatus::Pending))
            ->with('currentHolder')
            ->orderBy('nama_aset')
            ->get()
            ->map(fn (Asset $a) => [
                'id' => $a->id,
                'kode_barang' => $a->kode_barang,
                'nomor_register' => $a->nomor_register,
                'nama_aset' => $a->nama_aset,
                'merk_type' => $a->merk_type,
                'kondisi' => $a->kondisi->value,
                'holder' => $a->currentHolder?->nama,
            ])->values();

        return Inertia::render('AssetReports/Create', [
            'assets' => $assets,
            'kondisiOptions' => collect([Kondisi::RusakRingan, Kondisi::RusakBerat])
                ->map(fn (Kondisi $k) => ['value' => $k->value, 'label' => $k->label()])->values(),
        ]);
    }

    public function store(StoreAssetReportRequest $request): RedirectResponse
    {
        try {
            $report = $this->reports->create(
                $request->safe()->except('photos'),
                $request->file('photos', []),
                $request->user(),
            );
        } catch (InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('asset-reports.show', $report)
            ->with('success', "Laporan #{$report->nomor_laporan} berhasil diajukan.");
    }

    public function show(Request $request, AssetReport $assetReport): Response
    {
        Gate::authorize('view', $assetReport);

        $assetReport->load([
            'asset.category', 'unit', 'pegawai', 'creator', 'photos',
            'approvalRequest.definition', 'approvalRequest.steps', 'approvalRequest.actions.user',
        ]);

        $approvalRequest = $assetReport->approvalRequest;
        $user = $request->user();
        $canReassign = $approvalRequest !== null && $this->workflow->canReassign($user, $approvalRequest);

        return Inertia::render('AssetReports/Show', [
            'report' => $assetReport,
            'can' => [
                'act' => $approvalRequest !== null && $this->workflow->canAct($user, $approvalRequest),
                'cancel' => $approvalRequest !== null && $this->workflow->canCancel($user, $approvalRequest),
                'reassign' => $canReassign,
            ],
            'reassignCandidates' => $canReassign ? $this->workflow->reassignCandidates() : [],
        ]);
    }
}
