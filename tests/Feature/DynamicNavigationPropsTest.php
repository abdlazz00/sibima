<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
});

it('shares accurate user permissions to inertia props', function () {
    $role = Role::create(['name' => 'operator_laporan', 'unit_scope' => 'own']);
    $role->givePermissionTo('dashboard.view', 'laporan.aset');

    $user = User::factory()->create();
    $user->assignRole($role);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('auth.user.permissions', 2)
            ->where('auth.user.permissions', fn ($perms) => in_array('dashboard.view', $perms->toArray()) && in_array('laporan.aset', $perms->toArray()))
        );
});
