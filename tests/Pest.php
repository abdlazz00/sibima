<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function userWithRole(string $role, ?\App\Models\Unit $unit = null): \App\Models\User
{
    \Spatie\Permission\Models\Role::findOrCreate($role);

    $user = \App\Models\User::factory()->create(['unit_id' => $unit?->id]);
    $user->assignRole($role);

    return $user;
}

function makeKecamatan(string $name = 'Kecamatan Sagulung'): \App\Models\Unit
{
    return \App\Models\Unit::create(['name' => $name, 'type' => 'kecamatan']);
}

function makeKelurahan(\App\Models\Unit $kecamatan, string $name): \App\Models\Unit
{
    return \App\Models\Unit::create(['name' => $name, 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);
}
