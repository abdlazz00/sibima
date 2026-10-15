<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            ],
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
