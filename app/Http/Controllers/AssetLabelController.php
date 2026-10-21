<?php

namespace App\Http\Controllers;

use App\Http\Requests\PrintAssetLabelsRequest;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Services\AssetLabelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class AssetLabelController extends Controller
{
    public function __construct(
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetLabelService $labels,
    ) {}

    public function prepare(PrintAssetLabelsRequest $request): JsonResponse
    {
        $ids = array_map('intval', $request->validated('ids'));
        $assets = $this->assets->findMany($ids);

        foreach ($assets as $asset) {
            Gate::authorize('view', $asset);
        }

        $ticket = Str::random(16);
        Cache::put("label_ticket_{$ticket}", [
            'ids' => $ids,
            'size' => $request->validated('size'),
            'user_id' => $request->user()->id,
        ], now()->addMinutes(15));

        return response()->json([
            'ticket' => $ticket,
            'url' => route('assets.labels.print', ['ticket' => $ticket]),
        ]);
    }

    public function printTicket(string $ticket, Request $request): Response
    {
        $payload = Cache::get("label_ticket_{$ticket}");
        abort_if(! $payload || $payload['user_id'] !== $request->user()->id, 404);

        $assets = $this->assets->findMany($payload['ids']);

        foreach ($assets as $asset) {
            Gate::authorize('view', $asset);
        }

        return response($this->labels->pdf($assets, $payload['size']), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="label-aset.pdf"',
        ]);
    }

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
