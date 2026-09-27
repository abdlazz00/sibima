<?php

namespace App\Http\Controllers;

use App\Http\Requests\RejectApprovalRequest;
use App\Models\ApprovalRequest;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class ApprovalActionController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $workflow) {}

    public function approve(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canAct($request->user(), $approvalRequest), 403);

        try {
            $this->workflow->approve($approvalRequest, $request->user());
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Persetujuan berhasil dicatat.');
    }

    public function reject(RejectApprovalRequest $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canAct($request->user(), $approvalRequest), 403);

        try {
            $this->workflow->reject($approvalRequest, $request->user(), $request->validated('note'));
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Pengajuan ditolak.');
    }
}
