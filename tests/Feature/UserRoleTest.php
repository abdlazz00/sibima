<?php

use App\Models\Unit;
use App\Models\User;
use Spatie\Permission\Models\Role;

it('assigns a role to a user and links it to a unit', function () {
    Role::findOrCreate('camat');

    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $user = User::factory()->create(['unit_id' => $unit->id]);
    $user->assignRole('camat');

    expect($user->hasRole('camat'))->toBeTrue()
        ->and($user->unit->name)->toBe('Kecamatan Sagulung');
});

it('allows unit_id to be null for global-scope accounts', function () {
    $user = User::factory()->create(['unit_id' => null]);

    expect($user->unit_id)->toBeNull()
        ->and($user->unit)->toBeNull();
});
