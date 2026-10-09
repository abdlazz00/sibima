<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->superAdmin = User::factory()->create();
    $this->superAdmin->assignRole('super-admin');
    $this->superAdminRole = Role::where('name', 'super-admin')->first();
    $this->all = Permission::pluck('name')->all();
});

function rsgPayload(array $o = []): array
{
    return array_merge(['display_name' => 'Super Admin', 'unit_scope' => 'all', 'description' => null], $o);
}

it('refuses to strip the permissions that keep super-admin able to manage access', function () {
    $without = fn (string $p) => array_values(array_diff($this->all, [$p]));

    foreach (['pengaturan.role', 'user.manage-access'] as $key) {
        $this->actingAs($this->superAdmin)
            ->put(route('roles.update', $this->superAdminRole), rsgPayload(['permissions' => $without($key)]))
            ->assertSessionHasErrors('permissions');
    }

    expect($this->superAdminRole->fresh()->hasPermissionTo('pengaturan.role'))->toBeTrue();
});

it('lets the super-admin unit scope be narrowed because the scope is not what keeps access manageable', function () {
    $this->actingAs($this->superAdmin)
        ->put(route('roles.update', $this->superAdminRole), rsgPayload(['unit_scope' => 'binaan', 'permissions' => $this->all]))
        ->assertSessionHasNoErrors();

    expect($this->superAdminRole->fresh()->unit_scope)->toBe('binaan');
});

it('still lets super-admin edit other permissions of the super-admin role', function () {
    $this->actingAs($this->superAdmin)
        ->put(route('roles.update', $this->superAdminRole), rsgPayload(['description' => 'Admin utama', 'permissions' => $this->all]))
        ->assertRedirect(route('roles.index'));

    expect($this->superAdminRole->fresh()->description)->toBe('Admin utama');
});
