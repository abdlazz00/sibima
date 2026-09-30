<?php

namespace App\Enums;

enum ApproverType: string
{
    case Role = 'role';
    case User = 'user';
    case AtasanUnit = 'atasan_unit';

    public function label(): string
    {
        return match ($this) {
            self::Role => 'Role',
            self::User => 'User tertentu',
            self::AtasanUnit => 'Atasan unit',
        };
    }
}
