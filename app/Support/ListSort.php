<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/** Urutan daftar yang dipilih pengguna lewat kunci; kolom hanya berasal dari daftar tetap, tidak pernah dari request. */
final class ListSort
{
    /** @param array<string, array{label: string, order: list<array{0: string, 1: string}>}> $sorts */
    public static function apply(Builder $query, array $sorts, mixed $key): Builder
    {
        $chosen = is_string($key) && isset($sorts[$key]) ? $sorts[$key] : reset($sorts);

        foreach ($chosen['order'] as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        return $query;
    }

    /**
     * @param  array<string, array{label: string, order: list<array{0: string, 1: string}>}>  $sorts
     * @return list<array{value: string, label: string}>
     */
    public static function options(array $sorts): array
    {
        return array_map(
            fn (string $key) => ['value' => $key, 'label' => $sorts[$key]['label']],
            array_keys($sorts),
        );
    }
}
