<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahan = Unit::create(['name' => 'Kelurahan Sei Lekop', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);

    $this->superAdmin = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $this->superAdmin->assignRole('super-admin');

    $this->targetUser = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $this->targetUser->assignRole('admin_kelurahan');
    $this->pegawai = Pegawai::factory()->create([
        'user_id' => $this->targetUser->id,
        'unit_id' => $this->kelurahan->id,
        'nama' => 'Ahmad Operator',
        'nip' => '199001012020011001',
        'foto_profile' => 'pegawai/ahmad.jpg',
    ]);
});

it('renders Users/Index page with users list, roles, units, filters and can props', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Index')
            ->has('users.data')
            ->has('roles')
            ->has('units')
            ->has('filters')
            ->has('can.manageAccess')
            ->has('can.toggleStatus')
            ->has('can.delete')
        );
});

it('renders Users/Show page with user details and effective permissions matrix', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('users.show', $this->targetUser))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Show')
            ->where('user.id', $this->targetUser->id)
            ->where('user.pegawai.nama', 'Ahmad Operator')
            ->has('effectivePermissions')
            ->has('can.manageAccess')
        );
});

it('renders Users/Edit page with roles, permission groups and initial values', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('users.edit', $this->targetUser))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Edit')
            ->where('user.id', $this->targetUser->id)
            ->where('user.role', 'admin_kelurahan')
            ->has('roles')
            ->has('permissionGroups')
        );
});
