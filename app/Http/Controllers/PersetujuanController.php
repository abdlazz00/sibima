<?php

namespace App\Http\Controllers;

use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PersetujuanController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $pending = ApprovalRequest::query()
            ->with(['definition', 'approvable', 'creator'])
            ->where('status', ApprovalStatus::Pending)
            ->get()
            ->filter(fn (ApprovalRequest $r) => $this->workflow->canAct($user, $r))
            ->values();

        return Inertia::render('Persetujuan/Index', [
            'items' => $pending->map(fn (ApprovalRequest $r) => [
                'id' => $r->id,
                'workflow_name' => $r->definition->name,
                'title' => $r->approvable->approvalTitle(),
                'submitted_by' => $r->creator->name,
                'current_step' => $r->current_step,
                'created_at' => $r->created_at->format('d M Y'),
                'show_url' => $r->approvable->approvalShowUrl(),
            ])->values(),
        ]);
    }
}
