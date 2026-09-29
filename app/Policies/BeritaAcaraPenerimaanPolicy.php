<?php

namespace App\Policies;

use App\Enums\BeritaAcaraStatus;
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
        if ($beritaAcara->status === BeritaAcaraStatus::Draft) {
            return $this->manages($user, $beritaAcara);
        }

        return $user->hasRole('kasubag') || $user->canAccessUnit($beritaAcara->unit);
    }

    public function create(User $user): bool
    {
        return $user->hasRole('admin_kecamatan') && $user->unit_id !== null;
    }

    public function update(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $beritaAcara->status === BeritaAcaraStatus::Draft && $this->manages($user, $beritaAcara);
    }

    public function delete(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $this->update($user, $beritaAcara);
    }

    private function manages(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        return $user->hasRole('admin_kecamatan') && $user->canAccessUnit($beritaAcara->unit);
    }
}
