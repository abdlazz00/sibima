<?php

use App\Support\PerPage;
use Illuminate\Http\Request;

test('it accepts only whitelisted page sizes and falls back to the default', function (mixed $input, int $expected) {
    expect(PerPage::resolve(Request::create('/x', 'GET', ['per_page' => $input])))->toBe($expected);
})->with([
    'allowed int' => [25, 25],
    'allowed string' => ['50', 50],
    'not whitelisted' => [7, 15],
    'negative' => [-1, 15],
    'garbage' => ['abc', 15],
    'too large' => [1000, 15],
]);

test('it uses the given default and ignores a missing parameter', function () {
    expect(PerPage::resolve(Request::create('/x'), 25))->toBe(25)
        ->and(PerPage::resolve(Request::create('/x', 'GET', ['per_page' => 10]), 25))->toBe(10);
});
