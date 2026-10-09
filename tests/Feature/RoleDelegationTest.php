<?php

use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;

function rdPayload(array $o = []): array
{
    return array_merge([
        'name' => 'operator_baru', 'display_name' => 'Operator Baru', 'unit_scope' => 'own',
        'description' => null, 'permissions' => ['aset.view'],
    ], $o);
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');
    $this->superAdmin = userWithRole('super-admin');
    $this->kasubag = userWithRole('kasubag');
    $this->manager = userWithRole('admin_kelurahan', $kel);
    $this->manager->givePermissionTo('pengaturan.role');
});

it('lets a role manager create a role within its own permissions and scope', function () {
    $this->actingAs($this->manager)->post(route('roles.store'), rdPayload())
        ->assertRedirect(route('roles.index'))->assertSessionHasNoErrors();

    expect(Role::where('name', 'operator_baru')->first()->hasPermissionTo('aset.view'))->toBeTrue();
});

it('refuses a new role with permissions or a unit scope beyond the manager own', function () {
    $this->actingAs($this->manager)->post(route('roles.store'), rdPayload(['permissions' => ['pengaturan.alur']]))
        ->assertSessionHasErrors('permissions');
    $this->actingAs($this->manager)->post(route('roles.store'), rdPayload(['name' => 'luas', 'unit_scope' => 'all']))
        ->assertSessionHasErrors('unit_scope');

    expect(Role::whereIn('name', ['operator_baru', 'luas'])->exists())->toBeFalse();
});

it('refuses to edit a role that is more powerful than the manager or to add permissions it lacks', function () {
    $this->actingAs($this->manager)
        ->put(route('roles.update', Role::where('name', 'camat')->first()), rdPayload(['name' => null, 'permissions' => ['aset.view']]))
        ->assertForbidden();

    $own = Role::create(['name' => 'operator_baru', 'display_name' => 'Operator', 'unit_scope' => 'own', 'is_system' => false]);
    $own->givePermissionTo('aset.view');

    $this->actingAs($this->manager)->put(route('roles.update', $own), rdPayload(['permissions' => ['aset.view', 'pengaturan.alur']]))
        ->assertSessionHasErrors('permissions');
    $this->actingAs($this->manager)->put(route('roles.update', $own), rdPayload(['permissions' => ['aset.view', 'aset.create']]))
        ->assertRedirect(route('roles.index'));

    expect($own->fresh()->hasPermissionTo('aset.create'))->toBeTrue();
});

it('forbids a unit-scoped manager from editing a role that users outside its scope also hold', function () {
    $kelB = makeKelurahan(Unit::find($this->manager->unit->parent_id), 'Kelurahan B');
    userWithRole('admin_kelurahan', $kelB);

    $this->actingAs($this->manager)
        ->put(route('roles.update', Role::where('name', 'admin_kelurahan')->first()), rdPayload(['name' => null, 'permissions' => ['aset.view']]))
        ->assertForbidden();

    $own = Role::create(['name' => 'operator_baru', 'display_name' => 'Operator', 'unit_scope' => 'own', 'is_system' => false]);
    $own->givePermissionTo('aset.view');
    $holder = User::factory()->create(['unit_id' => $this->manager->unit_id]);
    $holder->assignRole($own);

    $this->actingAs($this->manager)->put(route('roles.update', $own), rdPayload(['permissions' => ['aset.view']]))
        ->assertRedirect(route('roles.index'));

    $outsider = User::factory()->create(['unit_id' => $kelB->id]);
    $outsider->assignRole($own);

    $this->actingAs($this->manager)->put(route('roles.update', $own), rdPayload(['permissions' => ['aset.view']]))
        ->assertForbidden();
});

it('lets super-admin create and edit any role', function () {
    $this->actingAs($this->superAdmin)->post(route('roles.store'), rdPayload(['unit_scope' => 'all', 'permissions' => ['pengaturan.alur', 'aset.view']]))
        ->assertRedirect(route('roles.index'))->assertSessionHasNoErrors();
});

it('forbids kasubag without pengaturan.role from creating roles', function () {
    $this->actingAs($this->kasubag)->post(route('roles.store'), rdPayload(['unit_scope' => 'all', 'permissions' => ['aset.view']]))
        ->assertForbidden();
});
