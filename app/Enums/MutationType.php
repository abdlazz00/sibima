<?php

namespace App\Enums;

enum MutationType: string
{
    case KecKeKel = 'kec_ke_kel';
    case AntarKel = 'antar_kel';
    case ReturKelKeKec = 'retur_kel_ke_kec';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::KecKeKel => 'Mutasi Kecamatan ke Kelurahan',
            self::AntarKel => 'Mutasi Antar Kelurahan',
            self::ReturKelKeKec => 'Retur Kelurahan ke Kecamatan',
            self::Internal => 'Mutasi Internal',
        };
    }
}
