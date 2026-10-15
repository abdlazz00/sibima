<?php

namespace App\Support;

use Illuminate\Http\Request;

class PerPage
{
    /** Jumlah baris per halaman yang boleh dipilih pengguna. */
    public const OPTIONS = [10, 15, 25, 50, 100];

    public static function resolve(Request $request, int $default = 15): int
    {
        $value = (int) $request->input('per_page');

        return in_array($value, self::OPTIONS, true) ? $value : $default;
    }
}
