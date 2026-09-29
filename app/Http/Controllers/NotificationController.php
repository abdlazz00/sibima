<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $found = $request->user()->unreadNotifications()->where('id', $notification)->first();
        $found?->markAsRead();

        $url = $found?->data['url'] ?? null;

        return $url ? redirect($url) : back();
    }
}
