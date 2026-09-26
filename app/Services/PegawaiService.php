<?php

namespace App\Services;

use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

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
