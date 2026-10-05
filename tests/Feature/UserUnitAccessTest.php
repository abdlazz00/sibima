<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahanA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);
    $this->kelurahanB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);

    $this->otherKecamatan = Unit::create(['name' => 'Kecamatan Lain', 'type' => 'kecamatan']);
    $this->otherKelurahan = Unit::create(['name' => 'Kelurahan Lain', 'type' => 'kelurahan', 'parent_id' => $this->otherKecamatan->id]);
});

it('lets kasubag access any unit even with a null unit_id', function () {
    $user = User::factory()->create(['unit_id' => null]);
    $user->assignRole('kasubag');

    expect($user->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeTrue();
});

it('lets camat access their kecamatan and every kelurahan under it', function () {
    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole('camat');

    expect($user->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeTrue();
});

it('denies camat access to another kecamatan and its kelurahan', function () {
    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $user->assignRole('camat');

    expect($user->canAccessUnit($this->otherKecamatan))->toBeFalse()
        ->and($user->canAccessUnit($this->otherKelurahan))->toBeFalse();
});

it('denies a camat with a null unit_id access to any unit', function () {
    $user = User::factory()->create(['unit_id' => null]);
    $user->assignRole('camat');

    expect($user->canAccessUnit($this->kecamatan))->toBeFalse()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeFalse();
});

it('denies a user with no role access to any unit', function () {
    $user = User::factory()->create(['unit_id' => $this->kecamatan->id]);

    expect($user->canAccessUnit($this->kecamatan))->toBeFalse()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeFalse();
});

it('restricts admin_kelurahan to only their own kelurahan, not the parent kecamatan', function () {
    $user = User::factory()->create(['unit_id' => $this->kelurahanA->id]);
    $user->assignRole('admin_kelurahan');

    expect($user->canAccessUnit($this->kelurahanA))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanB))->toBeFalse()
        ->and($user->canAccessUnit($this->kecamatan))->toBeFalse();
});

it('restricts lurah to only their own kelurahan, not the parent kecamatan', function () {
    $user = User::factory()->create(['unit_id' => $this->kelurahanB->id]);
    $user->assignRole('lurah');

    expect($user->canAccessUnit($this->kelurahanB))->toBeTrue()
        ->and($user->canAccessUnit($this->kelurahanA))->toBeFalse()
        ->and($user->canAccessUnit($this->kecamatan))->toBeFalse();
});

it('restricts admin_kecamatan to exactly their own unit', function () {
    $adminKecamatan = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $adminKecamatan->assignRole('admin_kecamatan');

    expect($adminKecamatan->canAccessUnit($this->kecamatan))->toBeTrue()
        ->and($adminKecamatan->canAccessUnit($this->kelurahanA))->toBeFalse();
});
