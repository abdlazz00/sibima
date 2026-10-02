<?php

use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
});

it('defaults is_active to true for newly created users', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);

    expect($user->is_active)->toBeTrue();
});

it('provides foto_profile_url accessor from associated pegawai', function () {
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $pegawai = Pegawai::factory()->create([
        'unit_id' => $this->unit->id,
        'user_id' => $user->id,
        'foto_profile' => 'pegawais/1/avatar.jpg',
    ]);

    expect($user->foto_profile_url)->toContain('pegawais/1/avatar.jpg');

    $userWithoutPhoto = User::factory()->create(['unit_id' => $this->unit->id]);
    expect($userWithoutPhoto->foto_profile_url)->toBeNull();
});

it('seeds all granular user management permissions and grants them to kasubag', function () {
    $expected = [
        'user.view',
        'user.manage-access',
        'user.reset-password',
        'user.toggle-status',
        'user.delete',
    ];

    foreach ($expected as $perm) {
        expect(Permission::where('name', $perm)->exists())->toBeTrue("Permission {$perm} not seeded");
    }

    $kasubag = Role::findByName('kasubag');
    foreach ($expected as $perm) {
        expect($kasubag->hasPermissionTo($perm))->toBeTrue("Kasubag lacks {$perm}");
    }
});
