<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kasubag = User::factory()->create();
    $this->kasubag->assignRole('kasubag');

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->unit = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->unit->id]);
});

it('allows kasubag to grant direct permissions to a specific user on top of base role', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole('admin_kelurahan');
    $this->pegawai->update(['user_id' => $user->id]);

    expect($user->can('import-kategori'))->toBeFalse();

    $this->actingAs($this->kasubag)
        ->post(route('pegawais.user-access', $this->pegawai), [
            'role' => 'admin_kelurahan',
            'direct_permissions' => ['import-kategori'],
            'unit_scope_override' => null,
        ])
        ->assertRedirect();

    $user->refresh();
    expect($user->hasRole('admin_kelurahan'))->toBeTrue()
        ->and($user->hasDirectPermission('import-kategori'))->toBeTrue()
        ->and($user->can('import-kategori'))->toBeTrue();
});
