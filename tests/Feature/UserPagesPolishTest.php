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

    $kec = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $kec->id]);
    $this->kelB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $kec->id]);

    $this->kasubag = User::factory()->create(['unit_id' => $kec->id]);
    $this->kasubag->assignRole('kasubag');
});

it('shows the pegawai phone number from no_hp on the user detail page', function () {
    $target = User::factory()->create(['unit_id' => $this->kelA->id]);
    $target->assignRole('admin_kelurahan');
    Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'user_id' => $target->id, 'no_hp' => '081234567890']);

    $this->actingAs($this->kasubag)->get(route('users.show', $target))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('user.pegawai.no_hp', '081234567890')
            ->missing('user.pegawai.telepon'));
});

it('lists effective permissions of a user on the detail page grouped by module', function () {
    $target = User::factory()->create(['unit_id' => $this->kelA->id]);
    $target->assignRole('lurah');
    $target->givePermissionTo('aset.create');

    $this->actingAs($this->kasubag)->get(route('users.show', $target))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('effectivePermissions.Data Aset', fn ($perms) => collect($perms)->contains('aset.create') && collect($perms)->contains('aset.view')));
});

it('only offers units inside the account scope in the user filter', function () {
    $manager = User::factory()->create(['unit_id' => $this->kelA->id]);
    $manager->assignRole('admin_kelurahan');
    $manager->givePermissionTo('user.view');

    $this->actingAs($manager)->get(route('users.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('units', fn ($units) => collect($units)->pluck('id')->all() === [$this->kelA->id]));

    $this->actingAs($this->kasubag)->get(route('users.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page->has('units', 3));
});
