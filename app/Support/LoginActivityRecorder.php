<?php

namespace App\Support;

use App\Models\LoginLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

class LoginActivityRecorder
{
    public function login(Login $event): void
    {
        $this->record($event->user->getAuthIdentifier(), 'login');
    }

    public function failed(Failed $event): void
    {
        $this->record($event->user?->getAuthIdentifier(), 'gagal');
    }

    public function logout(Logout $event): void
    {
        if ($event->user !== null) {
            $this->record($event->user->getAuthIdentifier(), 'logout');
        }
    }

    private function record(int|string|null $userId, string $event): void
    {
        $request = request();

        LoginLog::create([
            'user_id' => $userId,
            'identifier' => (string) $request->input('email', ''),
            'event' => $event,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
