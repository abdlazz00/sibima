<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Http\Requests\StoreAssetRequest;
use App\Http\Requests\UpdateAssetRequest;
use App\Models\Asset;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Repositories\Contracts\UnitRepositoryInterface;
use App\Services\AssetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AssetController extends Controller
{
    public function __construct(
        private readonly AssetService $service,
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetCategoryRepositoryInterface $categories,
        private readonly UnitRepositoryInterface $units,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Asset::class);

        $filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi']);

        return Inertia::render('Assets/Index', [
            'assets' => $this->assets->paginateVisibleTo($request->user(), $filters),
            'filters' => $filters,
            'categories' => $this->categories->tree(),
            'units' => $this->units->accessibleBy($request->user()),
            'kondisiOptions' => Kondisi::options(),
            'can' => ['create' => $request->user()->can('create', Asset::class)],
        ]);
    }

    public function show(Request $request, Asset $asset): Response
    {
        Gate::authorize('view', $asset);

        $asset->load(['category.parent', 'unit', 'currentHolder', 'photos', 'histories.user', 'histories.unit']);

        return Inertia::render('Assets/Show', [
            'asset' => $asset,
            'kondisiOptions' => Kondisi::options(),
            'can' => ['update' => $request->user()->can('update', $asset)],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Asset::class);

        return Inertia::render('Assets/Create', [
            'categories' => $this->categories->tree(),
            'kondisiOptions' => Kondisi::options(),
            'maxPhotos' => StoreAssetRequest::MAX_PHOTOS,
        ]);
    }

    public function store(StoreAssetRequest $request): RedirectResponse
    {
        $asset = $this->service->create(
            $request->safe()->except('photos'),
            $request->file('photos', []),
            $request->user(),
        );

        return redirect()->route('assets.show', $asset)->with('success', 'Aset berhasil dicatat.');
    }

    public function edit(Asset $asset): Response
    {
        Gate::authorize('update', $asset);

        return Inertia::render('Assets/Edit', [
            'asset' => $asset->load('photos'),
            'categories' => $this->categories->tree(),
            'maxPhotos' => StoreAssetRequest::MAX_PHOTOS,
        ]);
    }

    public function update(UpdateAssetRequest $request, Asset $asset): RedirectResponse
    {
        $this->service->update($asset, $request->safe()->except('photos'), $request->file('photos', []));

        return redirect()->route('assets.show', $asset)->with('success', 'Aset berhasil diperbarui.');
    }
}
