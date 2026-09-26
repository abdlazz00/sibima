<?php

namespace App\Services;

use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PegawaiService
{
    public const FIELDS = ['nama', 'nip', 'pangkat_golongan', 'jabatan', 'status_kepegawaian'];

    public function __construct(private readonly PegawaiRepositoryInterface $pegawais) {}

    /** @param array<string, mixed> $data */
    public function create(array $data, ?UploadedFile $foto, User $actor): Pegawai
    {
        $pegawai = $this->pegawais->create([
            ...Arr::only($data, self::FIELDS),
            'unit_id' => $actor->hasRole('kasubag') ? $data['unit_id'] : $actor->unit_id,
        ]);

        return $this->attachPhoto($pegawai, $foto);
    }

    /** @param array<string, mixed> $data */
    public function update(Pegawai $pegawai, array $data, ?UploadedFile $foto): Pegawai
    {
        $this->pegawais->update($pegawai, Arr::only($data, self::FIELDS));

        return $this->attachPhoto($pegawai, $foto);
    }

    public function delete(Pegawai $pegawai): void
    {
        $this->pegawais->delete($pegawai);
    }

    public function createLoginForPegawai(Pegawai $pegawai, string $email, string $password, string $role): User
    {
        if ($pegawai->user_id !== null) {
            throw ValidationException::withMessages(['email' => 'Pegawai ini sudah punya akun login.']);
        }

        return DB::transaction(function () use ($pegawai, $email, $password, $role) {
            $user = User::create([
                'name' => $pegawai->nama,
                'email' => $email,
                'password' => Hash::make($password),
                'unit_id' => $pegawai->unit_id,
                'email_verified_at' => now(),
            ]);

            $user->assignRole($role);
            $pegawai->update(['user_id' => $user->id]);

            return $user;
        });
    }

    private function attachPhoto(Pegawai $pegawai, ?UploadedFile $foto): Pegawai
    {
        if ($foto === null) {
            return $pegawai;
        }

        if ($pegawai->foto_profile) {
            Storage::disk('public')->delete($pegawai->foto_profile);
        }

        $pegawai->update(['foto_profile' => $foto->store("pegawais/{$pegawai->id}", 'public')]);

        return $pegawai;
    }
}
