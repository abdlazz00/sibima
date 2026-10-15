<?php

namespace App\Http\Controllers;

use App\Support\PerPage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filter = $request->query('filter') === 'belum' ? 'belum' : 'semua';
        $perPage = PerPage::resolve($request);

        $query = $filter === 'belum' ? $user->unreadNotifications() : $user->notifications();

        return Inertia::render('Notifikasi/Index', [
            'items' => $query->latest()->paginate($perPage)->withQueryString()->through(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'message' => $n->data['message'] ?? '',
                'url' => $n->data['url'] ?? null,
                'dibaca' => $n->read_at !== null,
                'waktu' => $n->created_at->toIso8601String(),
                'relatif' => $n->created_at->diffForHumans(),
            ]),
            'filters' => ['filter' => $filter, 'per_page' => $perPage],
        ]);
    }

    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $found = $request->user()->unreadNotifications()->where('id', $notification)->first();
        $found?->markAsRead();

        $url = $found?->data['url'] ?? null;

        return $url ? redirect($url) : back();
    }

    public function mark(Request $request, string $notification): RedirectResponse
    {
        $data = $request->validate(['dibaca' => ['required', 'boolean']]);

        $found = $request->user()->notifications()->where('id', $notification)->firstOrFail();
        $data['dibaca'] ? $found->markAsRead() : $found->markAsUnread();

        return back();
    }

    public function markAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back()->with('success', 'Semua notifikasi ditandai sudah dibaca.');
    }
}
