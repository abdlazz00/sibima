<?php

namespace App\Http\Middleware;

use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'roles' => $request->user()->getRoleNames()->toArray(),
                    'unit' => $request->user()->unit ? [
                        'id' => $request->user()->unit->id,
                        'name' => $request->user()->unit->name,
                        'type' => $request->user()->unit->type,
                    ] : null,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'pending_approvals' => fn () => $request->user()
                ? app(ApprovalWorkflowService::class)->pendingFor($request->user())->count()
                : 0,
            'notifications' => $request->user() ? [
                'unread_count' => $request->user()->unreadNotifications()->count(),
                'items' => $request->user()->unreadNotifications()->latest()->take(5)->get()->map(fn ($n) => [
                    'id' => $n->id,
                    'message' => $n->data['message'],
                    'created_at' => $n->created_at->diffForHumans(),
                ]),
            ] : ['unread_count' => 0, 'items' => []],
        ];
    }
}
