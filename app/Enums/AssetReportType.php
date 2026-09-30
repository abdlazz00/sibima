<?php

namespace App\Enums;

enum AssetReportType: string
{
    case Rusak = 'rusak';
    case Hilang = 'hilang';

    public function label(): string
    {
        return match ($this) {
            self::Rusak => 'Rusak',
            self::Hilang => 'Hilang',
        };
    }
}
