<?php

namespace App\Http\Controllers;

use App\Services\ThumbnailService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfilePhotoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate(
            ['foto' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']],
            [
                'foto.required' => 'Pilih foto terlebih dahulu.',
                'foto.image' => 'Berkas harus berupa gambar.',
                'foto.mimes' => 'Foto harus berformat JPG, PNG, atau WEBP.',
                'foto.max' => 'Ukuran foto maksimal 2 MB.',
                'foto.uploaded' => 'Foto gagal diunggah. Periksa ukuran dan formatnya.',
            ],
        );

        $user = $request->user();
        $old = $user->foto_profile;

        $path = $request->file('foto')->store('profile-photos', 'public');
        app(ThumbnailService::class)->generate($path);
        $user->update(['foto_profile' => $path]);

        if ($old) {
            app(ThumbnailService::class)->deleteThumbnails($old);
            Storage::disk('public')->delete($old);
        }

        return back()->with('success', 'Foto profil diperbarui.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->foto_profile) {
            app(ThumbnailService::class)->deleteThumbnails($user->foto_profile);
            Storage::disk('public')->delete($user->foto_profile);
            $user->update(['foto_profile' => null]);
        }

        return back()->with('success', 'Foto profil dihapus.');
    }
}
