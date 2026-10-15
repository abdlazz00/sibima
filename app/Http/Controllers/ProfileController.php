<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Support\SessionDevice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the account page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->loadMissing(['pegawai', 'unit', 'roles']);
        $role = $user->roles->first();

        return Inertia::render('Profile/Edit', [
            'akun' => [
                'nip' => $user->pegawai?->nip,
                'role' => $role?->display_name ?? $role?->name,
                'unit' => $user->unit?->name,
                'cakupan' => $user->resolveUnitScope(),
                'aktif' => (bool) $user->is_active,
                'sandi_diubah' => $user->password_changed_at?->toIso8601String(),
                'punya_foto' => filled($user->foto_profile),
            ],
            'sessions' => DB::table('sessions')
                ->where('user_id', $user->id)
                ->orderByDesc('last_activity')
                ->get()
                ->map(fn ($s) => [
                    'ref' => hash('sha256', $s->id),
                    'perangkat' => SessionDevice::label($s->user_agent),
                    'ip' => $s->ip_address,
                    'terakhir_aktif' => Carbon::createFromTimestamp($s->last_activity)->toIso8601String(),
                    'ini' => $s->id === $request->session()->getId(),
                ])
                ->values(),
        ]);
    }

    /**
     * Update the user's name and email.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $user->fill($request->safe()->only(['name', 'email']));

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return Redirect::route('profile.edit')->with('success', 'Profil diperbarui.');
    }
}
