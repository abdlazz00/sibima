<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->superAdmin = User::factory()->create();
    $this->superAdmin->assignRole('super-admin');

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create();
    $this->operator->assignRole('admin_kecamatan');
});

it('denies access to role management for users without pengaturan.role permission including kasubag', function () {
    $this->actingAs($this->operator)
        ->get(route('roles.index'))
        ->assertForbidden();

    $this->actingAs($this->kasubag)
        ->get(route('roles.index'))
        ->assertForbidden();
});

it('allows super-admin to create a new custom role with permissions and unit scope', function () {
    $this->actingAs($this->superAdmin)
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

    $this->actingAs($this->superAdmin)
        ->delete(route('roles.destroy', $kasubagRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'kasubag')->exists())->toBeTrue();
});

it('prevents deleting custom roles that have active users assigned', function () {
    $customRole = Role::create(['name' => 'staff_khusus', 'unit_scope' => 'own']);
    $user = User::factory()->create();
    $user->assignRole($customRole);

    $this->actingAs($this->superAdmin)
        ->delete(route('roles.destroy', $customRole))
        ->assertSessionHas('error');

    expect(Role::where('name', 'staff_khusus')->exists())->toBeTrue();
});

it('allows super-admin to update an existing role and its permissions', function () {
    $camatRole = Role::findByName('camat');

    $this->actingAs($this->superAdmin)
        ->put(route('roles.update', $camatRole), [
            'display_name' => 'Camat Sagulung Diperbarui',
            'unit_scope' => 'binaan',
            'unit_head_of' => 'kecamatan',
            'description' => 'Deskripsi camat baru',
            'permissions' => ['dashboard.view', 'aset.view', 'aset.create', 'laporan.aset'],
        ])
        ->assertRedirect(route('roles.index'))
        ->assertSessionHas('success');

    $fresh = $camatRole->fresh();
    expect($fresh->display_name)->toBe('Camat Sagulung Diperbarui')
        ->and($fresh->hasPermissionTo('aset.create'))->toBeTrue()
        ->and($fresh->hasPermissionTo('laporan.aset'))->toBeTrue()
        ->and($fresh->hasPermissionTo('export-aset'))->toBeFalse();
});

it('handles updating a role with empty permissions safely', function () {
    $role = Role::create([
        'name' => 'operator_kosong',
        'display_name' => 'Operator Kosong',
        'unit_scope' => 'own',
        'is_system' => false,
    ]);
    $role->givePermissionTo('aset.view');

    $this->actingAs($this->superAdmin)
        ->put(route('roles.update', $role), [
            'name' => 'operator_kosong',
            'display_name' => 'Operator Kosong Diperbarui',
            'unit_scope' => 'own',
            'permissions' => [],
        ])
        ->assertRedirect(route('roles.index'))
        ->assertSessionHas('success');

    expect($role->fresh()->permissions)->toBeEmpty();
});
