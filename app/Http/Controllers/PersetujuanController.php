<?php

namespace App\Http\Controllers;

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
        abort_unless($request->user()->can('persetujuan.view'), 403);

        $user = $request->user();

        $pending = $this->workflow->pendingFor($user);

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
