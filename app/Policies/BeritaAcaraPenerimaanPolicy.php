<?php

namespace App\Policies;

use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;

class BeritaAcaraPenerimaanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['admin_kecamatan', 'kasubag', 'camat']);
    }

    public function view(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $user->hasRole('kasubag') || $user->canAccessUnit($beritaAcara->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasRole('admin_kecamatan') && $user->unit_id !== null;
    }
}
