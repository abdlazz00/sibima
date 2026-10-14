<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');
    $this->superAdmin = userWithRole('super-admin');
    $this->operator = userWithRole('admin_kecamatan');
    $this->manager = userWithRole('admin_kelurahan', $kel);
    $this->manager->givePermissionTo('pengaturan.role');
});

it('shows the create page with the permission catalog to a role manager', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('roles.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Roles/Create')
            ->has('permissionGroups'));
});

it('denies the create and edit pages to users without pengaturan.role', function () {
    $role = Role::where('name', 'kasubag')->first();

    $this->actingAs($this->operator)->get(route('roles.create'))->assertForbidden();
    $this->actingAs($this->operator)->get(route('roles.edit', $role))->assertForbidden();
});

it('shows the edit page with the role and its permissions', function () {
    $custom = Role::create(['name' => 'auditor_aset', 'display_name' => 'Auditor Aset', 'unit_scope' => 'all', 'is_system' => false]);
    $custom->givePermissionTo(['aset.view', 'laporan.aset']);

    $this->actingAs($this->superAdmin)
        ->get(route('roles.edit', $custom))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Roles/Edit')
            ->where('role.id', $custom->id)
            ->where('role.name', 'auditor_aset')
            ->where('role.unit_scope', 'all')
            ->where('role.is_system', false)
            ->where('role.permissions', fn ($permissions) => collect($permissions)->sort()->values()->all() === ['aset.view', 'laporan.aset'])
            ->has('permissionGroups'));
});

it('flags a system role on its edit page', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('roles.edit', Role::where('name', 'kasubag')->first()))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('role.is_system', true));
});

it('refuses the edit page for a role more powerful than the manager before any form is filled', function () {
    $this->actingAs($this->manager)
        ->get(route('roles.edit', Role::where('name', 'camat')->first()))
        ->assertForbidden();
});

it('lets a manager open the edit page of a role within its own reach', function () {
    $own = Role::create(['name' => 'operator_baru', 'display_name' => 'Operator Baru', 'unit_scope' => 'own', 'is_system' => false]);
    $own->givePermissionTo('aset.view');

    $this->actingAs($this->manager)
        ->get(route('roles.edit', $own))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Roles/Edit'));
});

it('sends validation errors back to the form page instead of the list', function () {
    $this->actingAs($this->superAdmin)
        ->from(route('roles.create'))
        ->post(route('roles.store'), ['name' => 'Tidak Valid!', 'display_name' => '', 'unit_scope' => 'own'])
        ->assertRedirect(route('roles.create'))
        ->assertSessionHasErrors(['name', 'display_name']);

    $role = Role::create(['name' => 'role_lama', 'display_name' => 'Role Lama', 'unit_scope' => 'own', 'is_system' => false]);

    $this->actingAs($this->superAdmin)
        ->from(route('roles.edit', $role))
        ->put(route('roles.update', $role), ['name' => 'role_lama', 'display_name' => '', 'unit_scope' => 'own'])
        ->assertRedirect(route('roles.edit', $role))
        ->assertSessionHasErrors('display_name');
});
