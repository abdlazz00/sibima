<?php

namespace App\Http\Controllers;

use App\Enums\ApproverType;
use App\Http\Requests\UpdateWorkflowRequest;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\WorkflowSettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkflowSettingsController extends Controller
{
    private const SCOPE_LABELS = [
        'none' => 'Tidak dibatasi unit', 'subject' => 'Unit pengaju',
        'origin' => 'Unit asal', 'destination' => 'Unit tujuan',
    ];

    public function __construct(private readonly WorkflowSettingsService $settings) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', WorkflowDefinition::class);

        $workflows = WorkflowDefinition::with('steps')
            ->withCount(['requests as pending_count' => fn ($q) => $q->where('status', 'pending')])
            ->withMax('changeLogs as last_changed_at', 'created_at')
            ->orderBy('name')
            ->get()
            ->map(fn (WorkflowDefinition $w) => [
                'id' => $w->id,
                'code' => $w->code,
                'name' => $w->name,
                'summary' => $w->steps->pluck('label')->implode(' → '),
                'step_count' => $w->steps->count(),
                'pending_count' => $w->pending_count,
                'last_changed_at' => $w->last_changed_at,
            ]);

        return Inertia::render('WorkflowSettings/Index', ['workflows' => $workflows]);
    }

    public function edit(WorkflowDefinition $workflow): Response
    {
        Gate::authorize('update', $workflow);

        $capability = config("workflow.capabilities.{$workflow->code}", 'none');
        $scopes = match ($capability) {
            'subject' => ['none', 'subject'],
            'origin_destination' => ['none', 'origin', 'destination'],
            default => ['none'],
        };

        return Inertia::render('WorkflowSettings/Edit', [
            'workflow' => [
                'id' => $workflow->id,
                'code' => $workflow->code,
                'name' => $workflow->name,
                'capability' => $capability,
                'steps' => $workflow->steps->map(fn ($s) => [
                    'label' => $s->label,
                    'approver_type' => $s->approver_type->value,
                    'approver_role' => $s->approver_role,
                    'approver_user_id' => $s->approver_user_id,
                    'unit_scope' => $s->unit_scope->value,
                ])->values(),
            ],
            'options' => [
                'roles' => Role::orderBy('name')->get()->map(fn ($r) => ['value' => $r->name, 'label' => $r->display_name ?? $r->name])->values(),
                'types' => collect(ApproverType::cases())
                    ->filter(fn ($t) => $t !== ApproverType::AtasanUnit || $capability === 'subject')
                    ->map(fn ($t) => ['value' => $t->value, 'label' => $t->label()])->values(),
                'scopes' => collect($scopes)->map(fn ($s) => ['value' => $s, 'label' => self::SCOPE_LABELS[$s]])->values(),
                'users' => User::whereHas('roles')->with(['roles', 'unit'])->orderBy('name')->get()->map(fn (User $u) => [
                    'id' => $u->id, 'name' => $u->name, 'role' => $u->getRoleNames()->first(), 'unit' => $u->unit?->name,
                ])->values(),
            ],
            'logs' => $workflow->changeLogs()->with('user')->limit(20)->get()->map(fn ($l) => [
                'id' => $l->id,
                'event' => $l->event,
                'user' => $l->user?->name,
                'created_at' => $l->created_at?->format('d M Y H:i'),
                'before' => collect($l->steps_before)->pluck('label')->implode(' → '),
                'after' => collect($l->steps_after)->pluck('label')->implode(' → '),
            ]),
        ]);
    }

    public function update(UpdateWorkflowRequest $request, WorkflowDefinition $workflow): RedirectResponse
    {
        $this->settings->update($workflow, $request->validated('steps'), $request->user());

        return back()->with('success', 'Alur persetujuan berhasil disimpan. Pengajuan yang sedang berjalan tidak terpengaruh.');
    }

    public function reset(Request $request, WorkflowDefinition $workflow): RedirectResponse
    {
        Gate::authorize('update', $workflow);

        $this->settings->reset($workflow, $request->user());

        return back()->with('success', 'Alur dikembalikan ke pengaturan default.');
    }
}
