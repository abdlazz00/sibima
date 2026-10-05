<?php

namespace App\Policies;

use App\Enums\BeritaAcaraStatus;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;

class BeritaAcaraPenerimaanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('penerimaan.view');
    }

    public function view(User $user, BeritaAcaraPenerimaan $beritaAcara): bool
    {
        if ($beritaAcara->status === BeritaAcaraStatus::Draft) {
            return $this->manages($user, $beritaAcara);
        }

        return $user->canAccessUnit($beritaAcara->unit);
    }

    public function create(User $user): bool
    {
        return $user->can('penerimaan.create') && $user->unit_id !== null;
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
        // Draft hanya milik unit pembuatnya; cakupan luas (kasubag/camat) tidak otomatis boleh mengelola draft.
        return $user->can('penerimaan.update') && $user->unit_id === $beritaAcara->unit_id;
    }
}
