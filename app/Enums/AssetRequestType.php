<?php

namespace App\Enums;

enum AssetRequestType: string
{
    case Pegawai = 'pegawai';
    case Unit = 'unit';

    public function label(): string
    {
        return match ($this) {
            self::Pegawai => 'Permohonan Pegawai',
            self::Unit => 'Permohonan Unit',
        };
    }
}
