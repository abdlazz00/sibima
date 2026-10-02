<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahan = Unit::create(['name' => 'Kelurahan Sei Lekop', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);

    $this->kasubag = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $this->operator->assignRole('admin_kelurahan');
});

it('shares roles, permissionGroups, and manageAccess flag to pegawai index inertia page', function () {
    $pegawaiUser = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $pegawaiUser->assignRole('admin_kelurahan');
    $pegawaiUser->givePermissionTo('import-kategori');

    $pegawai = Pegawai::factory()->create([
        'unit_id' => $this->kelurahan->id,
        'user_id' => $pegawaiUser->id,
    ]);

    $this->actingAs($this->kasubag)
        ->get(route('pegawais.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Pegawai/Index')
            ->has('roles')
            ->has('permissionGroups')
            ->where('can.manageAccess', true)
            ->has('pegawais', fn (AssertableInertia $p) => $p
                ->where('0.id', $pegawai->id)
                ->where('0.user.id', $pegawaiUser->id)
                ->has('0.user.roles')
                ->has('0.user.permissions')
                ->etc()
            )
        );
});

it('disables manageAccess for users without pegawai.create-user or pengaturan.user', function () {
    $this->actingAs($this->operator)
        ->get(route('pegawais.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Pegawai/Index')
            ->where('can.manageAccess', false)
        );
});
