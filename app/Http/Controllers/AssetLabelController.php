<?php

namespace App\Http\Controllers;

use App\Http\Requests\PrintAssetLabelsRequest;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Services\AssetLabelService;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class AssetLabelController extends Controller
{
    public function __construct(
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetLabelService $labels,
    ) {}

    public function show(PrintAssetLabelsRequest $request): Response
    {
        $assets = $this->assets->findMany(array_map('intval', $request->validated('ids')));

        foreach ($assets as $asset) {
            Gate::authorize('view', $asset);
        }

        return response($this->labels->pdf($assets, $request->validated('size')), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="label-aset.pdf"',
        ]);
    }
}
