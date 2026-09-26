<?php

namespace App\Policies;

use App\Models\Pegawai;
use App\Models\User;

class PegawaiPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->getRoleNames()->isNotEmpty();
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['kasubag', 'admin_kecamatan', 'admin_kelurahan']);
    }

    public function update(User $user, Pegawai $pegawai): bool
    {
        return $user->hasRole('kasubag')
            || ($user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->canAccessUnit($pegawai->unit));
    }

    public function delete(User $user, Pegawai $pegawai): bool
    {
        return $this->update($user, $pegawai);
    }
}
