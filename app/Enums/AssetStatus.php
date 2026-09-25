<?php

namespace App\Enums;

enum AssetStatus: string
{
    case Aktif = 'aktif';
    case DalamProses = 'dalam_proses';

    public function label(): string
    {
        return match ($this) {
            self::Aktif => 'Aktif',
            self::DalamProses => 'Dalam Proses',
        };
    }
}
