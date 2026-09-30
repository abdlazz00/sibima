<?php

namespace App\Http\Controllers;

use App\Http\Requests\CancelApprovalRequest;
use App\Http\Requests\ReassignApprovalRequest;
use App\Http\Requests\RejectApprovalRequest;
use App\Models\ApprovalRequest;
use App\Models\User;
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

    public function cancel(CancelApprovalRequest $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canCancel($request->user(), $approvalRequest), 403);

        try {
            $this->workflow->cancel($approvalRequest, $request->user(), $request->validated('note'));
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Pengajuan dibatalkan.');
    }

    public function reassign(ReassignApprovalRequest $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless($this->workflow->canReassign($request->user(), $approvalRequest), 403);

        try {
            $this->workflow->reassign(
                $approvalRequest,
                $request->user(),
                User::findOrFail($request->validated('user_id')),
                $request->validated('note'),
            );
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Approver berhasil dialihkan.');
    }
}
