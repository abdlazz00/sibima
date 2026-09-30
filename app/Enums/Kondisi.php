<?php

namespace App\Enums;

enum Kondisi: string
{
    case Baik = 'baik';
    case RusakRingan = 'rusak_ringan';
    case RusakBerat = 'rusak_berat';
    case Hilang = 'hilang';

    public function label(): string
    {
        return match ($this) {
            self::Baik => 'Baik',
            self::RusakRingan => 'Rusak Ringan',
            self::RusakBerat => 'Rusak Berat',
            self::Hilang => 'Hilang',
        };
    }

    public function severity(): int
    {
        return match ($this) {
            self::Baik => 0,
            self::RusakRingan => 1,
            self::RusakBerat => 2,
            self::Hilang => 3,
        };
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $kondisi) => ['value' => $kondisi->value, 'label' => $kondisi->label()],
            self::cases(),
        );
    }
}
