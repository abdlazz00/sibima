<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');
    $this->kasubagRole = Role::where('name', 'kasubag')->first();
    $this->all = Permission::pluck('name')->all();
});

function rsgPayload(array $o = []): array
{
    return array_merge(['display_name' => 'Kasubag', 'unit_scope' => 'all', 'description' => null], $o);
}

it('refuses to strip the permissions that keep kasubag able to manage access', function () {
    $without = fn (string $p) => array_values(array_diff($this->all, [$p]));

    foreach (['pengaturan.role', 'user.manage-access'] as $key) {
        $this->actingAs($this->kasubag)
            ->put(route('roles.update', $this->kasubagRole), rsgPayload(['permissions' => $without($key)]))
            ->assertSessionHasErrors('permissions');
    }

    expect($this->kasubagRole->fresh()->hasPermissionTo('pengaturan.role'))->toBeTrue();
});

it('lets the kasubag unit scope be narrowed because the scope is not what keeps access manageable', function () {
    $this->actingAs($this->kasubag)
        ->put(route('roles.update', $this->kasubagRole), rsgPayload(['unit_scope' => 'binaan', 'permissions' => $this->all]))
        ->assertSessionHasNoErrors();

    expect($this->kasubagRole->fresh()->unit_scope)->toBe('binaan');
});

it('still lets kasubag edit other permissions of the kasubag role', function () {
    $this->actingAs($this->kasubag)
        ->put(route('roles.update', $this->kasubagRole), rsgPayload(['description' => 'Admin utama', 'permissions' => $this->all]))
        ->assertRedirect(route('roles.index'));

    expect($this->kasubagRole->fresh()->description)->toBe('Admin utama');
});
