<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProfileSessionController extends Controller
{
    public function destroy(Request $request, string $ref): RedirectResponse
    {
        $this->confirmPassword($request);

        $current = $request->session()->getId();

        $session = DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $current)
            ->get(['id'])
            ->first(fn ($row) => hash_equals(hash('sha256', $row->id), $ref));

        abort_if($session === null, 404);

        DB::table('sessions')->where('id', $session->id)->delete();
        $this->rotateRememberToken($request);

        return back()->with('success', 'Sesi dikeluarkan.');
    }

    public function destroyOthers(Request $request): RedirectResponse
    {
        $this->confirmPassword($request);

        DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();
        $this->rotateRememberToken($request);

        return back()->with('success', 'Semua perangkat lain telah dikeluarkan.');
    }

    /**
     * Satu token ingat-saya per pengguna: memutarnya membuat cookie ingat-saya di perangkat yang dikeluarkan
     * tidak bisa login kembali (sesi di tabel saja tidak cukup).
     */
    private function rotateRememberToken(Request $request): void
    {
        $request->user()->forceFill(['remember_token' => Str::random(60)])->saveQuietly();
    }

    private function confirmPassword(Request $request): void
    {
        $request->validate(
            ['current_password' => ['required', 'current_password']],
            [
                'current_password.required' => 'Sandi saat ini wajib diisi.',
                'current_password.current_password' => 'Sandi saat ini salah.',
            ],
        );
    }
}
