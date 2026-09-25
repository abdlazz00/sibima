<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

it('seeds roles, units, and one demo user per role idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class); // must be safe to run twice

    expect(Unit::where('type', 'kecamatan')->count())->toBe(1)
        ->and(Unit::where('type', 'kelurahan')->count())->toBe(7)
        ->and(User::count())->toBe(6);

    $kasubag = User::where('email', 'kasubag@simaset.test')->firstOrFail();
    expect($kasubag->unit_id)->toBeNull()
        ->and($kasubag->hasRole('kasubag'))->toBeTrue();

    $lurah = User::where('email', 'lurah@simaset.test')->firstOrFail();
    expect($lurah->unit->isKelurahan())->toBeTrue()
        ->and($lurah->hasRole('lurah'))->toBeTrue();
});

it('does not seed demo user accounts outside local/testing environments', function () {
    app()->instance('env', 'production');

    try {
        app(DatabaseSeeder::class)->run();
    } finally {
        app()->instance('env', 'testing');
    }

    expect(Unit::where('type', 'kecamatan')->count())->toBe(1)
        ->and(User::count())->toBe(0);
});
