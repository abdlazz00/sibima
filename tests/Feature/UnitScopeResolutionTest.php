<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->kelB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
});

it('resolves unit scope all correctly returning null for full access', function () {
    $role = Role::findByName('kasubag');
    $role->update(['unit_scope' => 'all']);

    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('all')
        ->and($user->accessibleUnitIds())->toBeNull();
});

it('resolves unit scope binaan returning parent and child units', function () {
    $role = Role::findByName('camat');
    $role->update(['unit_scope' => 'binaan']);

    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('binaan')
        ->and($user->accessibleUnitIds())->toEqualCanonicalizing([
            $this->kecamatan->id,
            $this->kelA->id,
            $this->kelB->id,
        ]);
});

it('resolves unit scope own returning only user unit', function () {
    $role = Role::findByName('admin_kelurahan');
    $role->update(['unit_scope' => 'own']);

    $user = User::factory()->create(['unit_id' => $this->kelA->id]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('own')
        ->and($user->accessibleUnitIds())->toBe([$this->kelA->id]);
});

it('allows user_scope_override to take precedence over role unit_scope', function () {
    $role = Role::findByName('admin_kelurahan');
    $role->update(['unit_scope' => 'own']);

    $user = User::factory()->create([
        'unit_id' => $this->kelA->id,
        'unit_scope_override' => 'all',
    ]);
    $user->assignRole($role);

    expect($user->resolveUnitScope())->toBe('all')
        ->and($user->accessibleUnitIds())->toBeNull();
});
