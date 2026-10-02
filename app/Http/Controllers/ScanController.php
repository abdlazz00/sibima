<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\AssetScanSummary;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class ScanController extends Controller
{
    public function __construct(private readonly AssetScanSummary $summary) {}

    public function index(): InertiaResponse
    {
        return Inertia::render('Scan/Index', ['summary' => null, 'canViewDetail' => false, 'notFound' => false]);
    }

    public function show(Request $request, string $token): InertiaResponse|SymfonyResponse
    {
        $asset = Asset::with(['category', 'unit', 'currentHolder', 'photos'])
            ->where('qr_token', $token)
            ->first();

        if ($asset === null) {
            return Inertia::render('Scan/Index', ['summary' => null, 'canViewDetail' => false, 'notFound' => true])
                ->toResponse($request)
                ->setStatusCode(404);
        }

        return Inertia::render('Scan/Index', [
            'summary' => $this->summary->for($asset),
            'canViewDetail' => $request->user()->can('view', $asset),
            'notFound' => false,
        ]);
    }
}
