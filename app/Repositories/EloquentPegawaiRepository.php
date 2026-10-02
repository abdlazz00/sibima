<?php

namespace App\Repositories;

use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use Illuminate\Support\Collection;

class EloquentPegawaiRepository implements PegawaiRepositoryInterface
{
    public function listVisibleTo(User $user): Collection
    {
        return Pegawai::query()
            ->visibleTo($user)
            ->with(['unit', 'user.roles', 'user.permissions'])
            ->orderBy('nama')
            ->get();
    }

    public function create(array $attributes): Pegawai
    {
        return Pegawai::create($attributes);
    }

    public function update(Pegawai $pegawai, array $attributes): Pegawai
    {
        $pegawai->update($attributes);

        return $pegawai;
    }

    public function delete(Pegawai $pegawai): void
    {
        $pegawai->delete();
    }
}
