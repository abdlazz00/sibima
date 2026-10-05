<?php

use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');
    $this->admin = userWithRole('admin_kelurahan', $this->kel);
});

it('revokes access when a permission is removed from a system role', function () {
    $this->actingAs($this->admin)->get('/assets/create')->assertOk();
    $this->actingAs($this->admin)->get('/pegawais/create')->assertOk();

    Role::findByName('admin_kelurahan')->revokePermissionTo(['aset.create', 'pegawai.create']);
    $this->admin->unsetRelation('roles')->unsetRelation('permissions');
    app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

    $this->actingAs($this->admin->fresh())->get('/assets/create')->assertForbidden();
    $this->actingAs($this->admin->fresh())->get('/pegawais/create')->assertForbidden();
});

it('treats a role without view permissions as unable to list modules', function () {
    $role = Role::findOrCreate('tamu');
    $guest = \App\Models\User::factory()->create(['unit_id' => $this->kel->id]);
    $guest->assignRole($role);

    foreach (['/assets', '/pegawais', '/asset-mutations', '/asset-requests', '/asset-reports'] as $url) {
        $this->actingAs($guest)->get($url)->assertForbidden();
    }
});
