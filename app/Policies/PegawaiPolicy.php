<?php

namespace App\Policies;

use App\Models\Pegawai;
use App\Models\User;

class PegawaiPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('pegawai.view');
    }

    public function view(User $user, Pegawai $pegawai): bool
    {
        return $this->update($user, $pegawai) || $user->canAccessUnit($pegawai->unit);
    }

    public function create(User $user): bool
    {
        return $user->can('pegawai.create');
    }

    public function update(User $user, Pegawai $pegawai): bool
    {
        return $user->can('pegawai.update') && $user->canAccessUnit($pegawai->unit);
    }

    public function delete(User $user, Pegawai $pegawai): bool
    {
        return $user->can('pegawai.delete') && $user->canAccessUnit($pegawai->unit);
    }

    public function createUser(User $user, Pegawai $pegawai): bool
    {
        return $user->can('pegawai.create-user');
    }
}
