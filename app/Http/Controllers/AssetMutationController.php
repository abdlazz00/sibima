<?php

namespace App\Http\Controllers;

use App\Enums\AssetStatus;
use App\Http\Requests\StoreAssetMutationRequest;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AssetMutationController extends Controller
{
    public function __construct(
        private readonly AssetMutationRepositoryInterface $repository,
        private readonly AssetMutationService $service
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AssetMutation::class);

        $mutations = $this->repository->paginateForUser($request->user(), 15);

        return Inertia::render('AssetMutations/Index', [
            'mutations' => $mutations,
            'can' => [
                'create' => $request->user()->can('create', AssetMutation::class),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', AssetMutation::class);

        $user = $request->user();
        $accessibleUnitIds = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($accessibleUnitIds !== null, fn ($q) => $q->whereIn('id', $accessibleUnitIds))
            ->get();

        $allUnits = Unit::all();

        $assets = Asset::query()
            ->where('status', AssetStatus::Aktif)
            ->when($accessibleUnitIds !== null, fn ($q) => $q->whereIn('unit_id', $accessibleUnitIds))
            ->with(['category', 'currentHolder'])
            ->get();

        $pegawais = Pegawai::query()
            ->select(['id', 'nama', 'jabatan', 'unit_id'])
            ->get();

        return Inertia::render('AssetMutations/Create', [
            'units' => $units,
            'allUnits' => $allUnits,
            'assets' => $assets,
            'pegawais' => $pegawais,
        ]);
    }

    public function store(StoreAssetMutationRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $items = $validated['items'];
        unset($validated['items']);

        try {
            $mutation = $this->service->submit($validated, $items, $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('asset-mutations.index')->with('success', "Mutasi aset #{$mutation->nomor_mutasi} berhasil diajukan.");
    }

    public function show(Request $request, AssetMutation $assetMutation): Response
    {
        Gate::authorize('view', $assetMutation);

        $assetMutation->load([
            'originUnit',
            'destinationUnit',
            'creator',
            'items.asset.category',
            'items.asset.currentHolder',
            'items.targetHolder',
            'approvalRequest.definition.steps',
            'approvalRequest.actions.user',
            'photos',
        ]);

        $approvalRequest = $assetMutation->approvalRequest;

        return Inertia::render('AssetMutations/Show', [
            'mutation' => $assetMutation,
            'can' => [
                'act' => $approvalRequest !== null && app(ApprovalWorkflowService::class)->canAct($request->user(), $approvalRequest),
                'cancel' => $approvalRequest !== null && app(ApprovalWorkflowService::class)->canCancel($request->user(), $approvalRequest),
            ],
        ]);
    }
}
