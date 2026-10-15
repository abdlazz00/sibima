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
        // Akun nonaktif lolos Auth::attempt lalu ditolak (LoginRequest); catat sebagai gagal, bukan berhasil.
        $this->record($event->user->getAuthIdentifier(), $event->user->is_active ? 'login' : 'gagal');
    }

    public function failed(Failed $event): void
    {
        $this->record($event->user?->getAuthIdentifier(), 'gagal');
    }

    public function logout(Logout $event): void
    {
        if ($event->user !== null && $event->user->is_active) {
            $this->record($event->user->getAuthIdentifier(), 'logout');
        }
    }

    /** Hanya email atau NIP yang disimpan; isian lain (mis. sandi yang salah ketik) tidak dicatat apa adanya. */
    private function identifier(string $input): string
    {
        $valid = filter_var($input, FILTER_VALIDATE_EMAIL) || preg_match('/^\d{8,20}$/', $input);

        return $valid ? mb_substr($input, 0, 255) : '[input tidak valid]';
    }

    private function record(int|string|null $userId, string $event): void
    {
        $request = request();

        LoginLog::create([
            'user_id' => $userId,
            'identifier' => $this->identifier((string) $request->input('email', '')),
            'event' => $event,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
