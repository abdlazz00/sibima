<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Models\Asset;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Repositories\Contracts\UnitRepositoryInterface;
use App\Services\AssetService;
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
}
