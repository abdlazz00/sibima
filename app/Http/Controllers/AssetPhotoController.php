<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Services\AssetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class AssetPhotoController extends Controller
{
    public function __construct(private readonly AssetService $service) {}

    public function destroy(Asset $asset, AssetPhoto $photo): RedirectResponse
    {
        Gate::authorize('update', $asset);

        $this->service->deletePhoto($photo);

        return back()->with('success', 'Foto dihapus.');
    }
}
