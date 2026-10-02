<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->unit = Unit::create(['name' => 'Kelurahan Uji', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->category = AssetCategory::create(['name' => 'Elektronik']);
});

it('allows custom role with aset.create permission to create assets', function () {
    $customRole = Role::create(['name' => 'operator_khusus', 'unit_scope' => 'own']);
    $customRole->givePermissionTo('aset.create', 'aset.view');

    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', Asset::class))->toBeTrue();
});

it('denies user without aset.create permission even if in valid unit', function () {
    $customRole = Role::create(['name' => 'viewer_only', 'unit_scope' => 'own']);
    $customRole->givePermissionTo('aset.view');

    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', Asset::class))->toBeFalse();
});

it('allows user with direct permission override to manage categories', function () {
    $customRole = Role::create(['name' => 'staff_biasa', 'unit_scope' => 'own']);
    $user = User::factory()->create(['unit_id' => $this->unit->id]);
    $user->assignRole($customRole);

    expect($user->can('create', AssetCategory::class))->toBeFalse();

    // Beri izin langsung ke user (user override)
    $user->givePermissionTo('kategori.create');

    expect($user->can('create', AssetCategory::class))->toBeTrue();
});
