<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->seed(DatabaseSeeder::class));

it('shares role and unit info with the dashboard for every seeded role', function (string $email, string $role) {
    $user = User::where('email', $email)->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('auth.user.roles', fn ($roles) => $roles->contains($role))
        );
})->with([
    ['kasubag@simaset.test', 'kasubag'],
    ['camat@simaset.test', 'camat'],
    ['admin.kecamatan@simaset.test', 'admin_kecamatan'],
    ['admin.kelurahan@simaset.test', 'admin_kelurahan'],
    ['lurah@simaset.test', 'lurah'],
    ['pegawai@simaset.test', 'pegawai'],
]);

it('shares a null unit for the kasubag global account', function () {
    $user = User::where('email', 'kasubag@simaset.test')->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.unit', null));
});

it('shares the unit name and type for a unit-bound account', function () {
    $user = User::where('email', 'lurah@simaset.test')->firstOrFail();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.unit.type', 'kelurahan')
            ->has('auth.user.unit.name')
        );
});
