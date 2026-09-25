<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssetCategoryRequest;
use App\Models\AssetCategory;
use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Services\AssetCategoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AssetCategoryController extends Controller
{
    public function __construct(
        private readonly AssetCategoryService $service,
        private readonly AssetCategoryRepositoryInterface $categories,
    ) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', AssetCategory::class);

        return Inertia::render('AssetCategories/Index', [
            'categories' => $this->categories->tree(),
        ]);
    }

    public function store(AssetCategoryRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(AssetCategoryRequest $request, AssetCategory $assetCategory): RedirectResponse
    {
        $this->service->update($assetCategory, $request->validated());

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    public function destroy(AssetCategory $assetCategory): RedirectResponse
    {
        Gate::authorize('delete', $assetCategory);

        $this->service->delete($assetCategory);

        return back()->with('success', 'Kategori berhasil dihapus.');
    }
}
