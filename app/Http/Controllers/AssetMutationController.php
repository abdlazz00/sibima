<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAssetMutationRequest;
use App\Models\AssetMutation;
use App\Models\Unit;
use App\Repositories\Contracts\AssetMutationRepositoryInterface;
use App\Services\AssetMutationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

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

        return Inertia::render('AssetMutations/Create', [
            'units' => $units,
            'allUnits' => $allUnits,
        ]);
    }

    public function store(StoreAssetMutationRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $items = $validated['items'];
        unset($validated['items']);

        $mutation = $this->service->submit($validated, $items, $request->user());

        return redirect()->route('asset-mutations.index')->with('success', "Mutasi aset #{$mutation->nomor_mutasi} berhasil diajukan.");
    }

    public function show(AssetMutation $assetMutation): Response
    {
        Gate::authorize('view', $assetMutation);

        $assetMutation->load([
            'originUnit',
            'destinationUnit',
            'creator',
            'items.asset.category',
            'items.targetHolder',
            'approvalRequest.definition.steps',
            'approvalRequest.actions.user',
            'photos',
        ]);

        return Inertia::render('AssetMutations/Show', [
            'mutation' => $assetMutation,
        ]);
    }
}
