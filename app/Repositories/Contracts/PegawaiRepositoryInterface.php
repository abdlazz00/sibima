<?php

namespace App\Repositories\Contracts;

use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Support\Collection;

interface PegawaiRepositoryInterface
{
    /** @return Collection<int, Pegawai> */
    public function listVisibleTo(User $user): Collection;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Pegawai;

    /** @param array<string, mixed> $attributes */
    public function update(Pegawai $pegawai, array $attributes): Pegawai;

    public function delete(Pegawai $pegawai): void;
}
