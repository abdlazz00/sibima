<?php

use App\Models\User;
use App\Support\ListSort;

const LS_SORTS = [
    'terbaru' => ['label' => 'Terbaru', 'order' => [['created_at', 'desc'], ['id', 'desc']]],
    'terlama' => ['label' => 'Terlama', 'order' => [['created_at', 'asc'], ['id', 'asc']]],
];

function lsSql($key): string
{
    return ListSort::apply(User::query(), LS_SORTS, $key)->toSql();
}

it('applies the chosen order with its tie-break', function () {
    expect(lsSql('terlama'))->toContain('order by "created_at" asc, "id" asc')
        ->and(lsSql('terbaru'))->toContain('order by "created_at" desc, "id" desc');
});

it('falls back to the first key for an unknown, empty, null or non-string value', function () {
    $default = 'order by "created_at" desc, "id" desc';

    foreach (['ngawur', '', null, ['terlama'], 5, 'created_at; drop table users'] as $key) {
        expect(lsSql($key))->toContain($default);
    }
});

it('lists the options with value and label in declaration order', function () {
    expect(ListSort::options(LS_SORTS))->toBe([
        ['value' => 'terbaru', 'label' => 'Terbaru'],
        ['value' => 'terlama', 'label' => 'Terlama'],
    ]);
});
