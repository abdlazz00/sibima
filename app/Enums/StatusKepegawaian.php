<?php

namespace App\Enums;

enum StatusKepegawaian: string
{
    case Pns = 'pns';
    case Pppk = 'pppk';

    public function label(): string
    {
        return match ($this) {
            self::Pns => 'PNS',
            self::Pppk => 'PPPK',
        };
    }
}
