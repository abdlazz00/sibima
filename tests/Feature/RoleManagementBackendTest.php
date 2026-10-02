<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create();
    $this->operator->assignRole('admin_kecamatan');
});

it('denies access to role management for users without pengaturan.role permission', function () {
    $this->actingAs($this->operator)
        ->get(route('roles.index'))
        ->assertForbidden();
});

it('allows kasubag to create a new custom role with permissions and unit scope', function () {
    $this->actingAs($this->kasubag)
        ->post(route('roles.store'), [
            'name' => 'auditor_aset',
            'display_name' => 'Auditor Aset BPKAD',
            'unit_scope' => 'all',
            'description' => 'Role audit khusus membaca seluruh aset',
            'permissions' => ['aset.view', 'export-aset', 'laporan.aset'],
        ])
        ->assertRedirect(route('roles.index'));

    $role = Role::findByName('auditor_aset');
    expect($role->display_name)->toBe('Auditor Aset BPKAD')
        ->and($role->is_system)->toBeFalse()
        ->and($role->unit_scope)->toBe('all')
        ->and($role->hasPermissionTo('aset.view'))->toBeTrue()
        ->and($role->hasPermissionTo('aset.create'))->toBeFalse();
});

it('prevents deleting system roles', function () {
    $kasubagRole = Role::findByName('kasubag');

    $this->actingAs($this->kasubag)
        ->delete(route('roles.destroy', $kasubagRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'kasubag')->exists())->toBeTrue();
});

it('prevents deleting custom roles that have active users assigned', function () {
    $customRole = Role::create(['name' => 'staff_khusus', 'unit_scope' => 'own']);
    $user = User::factory()->create();
    $user->assignRole($customRole);

    $this->actingAs($this->kasubag)
        ->delete(route('roles.destroy', $customRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'staff_khusus')->exists())->toBeTrue();
});
