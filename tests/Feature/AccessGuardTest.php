<?php

use App\Models\Role;
use App\Models\User;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
});

function pdKetua(string $name = 'ketua'): User
{
    $role = Role::create(['name' => $name, 'display_name' => ucfirst($name), 'unit_scope' => 'all', 'is_system' => false]);
    $role->givePermissionTo('pengaturan.role', 'user.manage-access', 'user.view');

    return User::factory()->create()->assignRole($role);
}

function pdUpdateSelf(User $user, string $role, array $extra = []): array
{
    return array_merge(['email' => $user->email, 'is_active' => true, 'role' => $role], $extra);
}

it('stops the only holder from taking the access roles away from themself', function () {
    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHas('error');

    expect($this->kasubag->fresh()->hasRole('kasubag'))->toBeTrue();
});

it('lets a holder change their own role when another active holder exists, whatever the role is called', function () {
    pdKetua();

    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHasNoErrors();

    expect($this->kasubag->fresh()->hasRole('admin_kecamatan'))->toBeTrue();
});

it('does not count an inactive user as a remaining holder', function () {
    $ketua = pdKetua();
    $ketua->update(['is_active' => false]);

    $this->actingAs($this->kasubag)->put(route('users.update', $this->kasubag), pdUpdateSelf($this->kasubag, 'admin_kecamatan'))
        ->assertSessionHas('error');
});

it('refuses to strip pengaturan.role from the only role that carries it', function () {
    $permissions = Role::findByName('kasubag')->permissions->pluck('name')->reject(fn ($p) => $p === 'pengaturan.role')->values()->all();

    $this->actingAs($this->kasubag)->put(route('roles.update', Role::findByName('kasubag')), [
        'display_name' => 'Kasubag', 'unit_scope' => 'all', 'permissions' => $permissions,
    ])->assertSessionHasErrors('permissions');

    expect(Role::findByName('kasubag')->hasPermissionTo('pengaturan.role'))->toBeTrue();
});

it('allows editing a role freely once another role keeps the access permissions', function () {
    pdKetua();
    $permissions = Role::findByName('kasubag')->permissions->pluck('name')->reject(fn ($p) => in_array($p, ['pengaturan.role', 'user.manage-access'], true))->values()->all();

    $this->actingAs($this->kasubag)->put(route('roles.update', Role::findByName('kasubag')), [
        'display_name' => 'Kasubag', 'unit_scope' => 'binaan', 'permissions' => $permissions,
    ])->assertSessionHasNoErrors();

    expect(Role::findByName('kasubag')->unit_scope)->toBe('binaan');
});

it('protects any role that is the last carrier, not only the one called kasubag', function () {
    $ketua = pdKetua();
    Role::findByName('kasubag')->syncPermissions(['dashboard.view']);

    $this->actingAs($ketua)->put(route('roles.update', Role::findByName('ketua')), [
        'name' => 'ketua', 'display_name' => 'Ketua', 'unit_scope' => 'all', 'permissions' => ['user.view'],
    ])->assertSessionHasErrors('permissions');
});

it('still lets a holder deactivate and delete another holder because canManage already requires equal rights', function () {
    $other = pdKetua('wakil');
    Role::findByName('wakil')->givePermissionTo('user.toggle-status', 'user.delete');

    $this->actingAs($this->kasubag)->patch(route('users.toggle-status', $other))->assertSessionHas('success');
    expect($other->fresh()->is_active)->toBeFalse();

    $this->actingAs($this->kasubag)->delete(route('users.destroy', $other))->assertSessionHas('success');
    expect(User::whereKey($other->id)->exists())->toBeFalse();
});

it('still refuses to deactivate or delete your own account', function () {
    $this->actingAs($this->kasubag)->patch(route('users.toggle-status', $this->kasubag))->assertSessionHas('error');
    $this->actingAs($this->kasubag)->delete(route('users.destroy', $this->kasubag))->assertSessionHas('error');
});
