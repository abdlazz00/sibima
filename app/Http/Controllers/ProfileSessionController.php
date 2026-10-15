<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        return back()->with('success', 'Sesi dikeluarkan.');
    }

    public function destroyOthers(Request $request): RedirectResponse
    {
        $this->confirmPassword($request);

        DB::table('sessions')
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        return back()->with('success', 'Semua perangkat lain telah dikeluarkan.');
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
