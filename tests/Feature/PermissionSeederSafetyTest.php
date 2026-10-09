<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;

function pdSeed(): void
{
    test()->seed(RoleSeeder::class);
    test()->seed(PermissionSeeder::class);
}

it('gives the defaults to brand new system roles', function () {
    pdSeed();

    $camat = Role::findByName('camat');
    $kasubag = Role::findByName('kasubag');
    $superAdmin = Role::findByName('super-admin');

    expect($camat->unit_scope)->toBe('binaan')
        ->and($camat->is_system)->toBeTrue()
        ->and($camat->hasPermissionTo('persetujuan.view'))->toBeTrue()
        ->and($superAdmin->permissions()->count())->toBe(Permission::count())
        ->and($kasubag->hasPermissionTo('pengaturan.role'))->toBeFalse()
        ->and($kasubag->hasPermissionTo('user.manage-access'))->toBeFalse()
        ->and($kasubag->hasPermissionTo('aset.view'))->toBeTrue()
        ->and($kasubag->permissions()->count())->toBe(Permission::count() - count(PermissionSeeder::PERMISSION_GROUPS['Pengaturan']));
});

it('never overwrites what was changed from the role menu when seeded again', function () {
    pdSeed();

    Role::findByName('camat')->update(['display_name' => 'Camat Kustom', 'unit_scope' => 'all', 'description' => 'diubah']);
    Role::findByName('camat')->syncPermissions(['dashboard.view']);
    Role::findByName('admin_kecamatan')->revokePermissionTo('aset.delete');

    pdSeed();

    $camat = Role::findByName('camat');

    expect($camat->display_name)->toBe('Camat Kustom')
        ->and($camat->unit_scope)->toBe('all')
        ->and($camat->description)->toBe('diubah')
        ->and($camat->is_system)->toBeTrue()
        ->and($camat->permissions->pluck('name')->all())->toBe(['dashboard.view'])
        ->and(Role::findByName('admin_kecamatan')->hasPermissionTo('aset.delete'))->toBeFalse();
});

it('still creates a permission that is missing from the database without touching existing roles', function () {
    pdSeed();
    Permission::where('name', 'laporan.aset')->delete();
    Role::findByName('lurah')->syncPermissions(['dashboard.view']);

    pdSeed();

    expect(Permission::where('name', 'laporan.aset')->exists())->toBeTrue()
        ->and(Role::findByName('lurah')->permissions->pluck('name')->all())->toBe(['dashboard.view']);
});

it('adopts a bare role with a system name that was created before seeding, but never an initialised one', function () {
    Role::findOrCreate('lurah');

    test()->seed(RoleSeeder::class);

    $lurah = Role::findByName('lurah');

    expect($lurah->is_system)->toBeTrue()
        ->and($lurah->unit_head_of)->toBe('kelurahan')
        ->and($lurah->display_name)->toBe('Lurah');

    $lurah->update(['display_name' => 'Lurah Kustom', 'unit_head_of' => null]);

    test()->seed(RoleSeeder::class);

    expect($lurah->fresh()->display_name)->toBe('Lurah Kustom')->and($lurah->fresh()->unit_head_of)->toBeNull();
});
