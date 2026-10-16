<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;

it('creates an active verified super-admin with a generated password when password option is omitted', function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class]);

    $this->artisan('sibima:create-super-admin', [
        'email' => '  Admin@Sagulung.go.id ',
        'name' => 'Admin Utama',
    ])
        ->expectsOutputToContain('Super Admin berhasil dibuat.')
        ->expectsOutputToContain('Password Sementara:')
        ->assertSuccessful();

    $user = User::where('email', 'admin@sagulung.go.id')->first();

    expect($user)->not->toBeNull()
        ->and($user->name)->toBe('Admin Utama')
        ->and($user->unit_id)->toBeNull()
        ->and($user->is_active)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->hasRole('super-admin'))->toBeTrue();
});

it('creates a super-admin with an explicit password when password option is provided', function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class]);

    $this->artisan('sibima:create-super-admin', [
        'email' => 'root@sagulung.go.id',
        '--password' => 'SangatRahasia123!',
    ])->assertSuccessful();

    $user = User::where('email', 'root@sagulung.go.id')->firstOrFail();

    expect($user->name)->toBe('Super Admin')
        ->and(Hash::check('SangatRahasia123!', $user->password))->toBeTrue()
        ->and($user->hasRole('super-admin'))->toBeTrue();
});

it('fails when super-admin role has not been seeded', function () {
    Role::query()->delete();

    $this->artisan('sibima:create-super-admin', [
        'email' => 'admin@sagulung.go.id',
    ])
        ->expectsOutputToContain('Role super-admin belum ada')
        ->assertFailed();

    expect(User::where('email', 'admin@sagulung.go.id')->exists())->toBeFalse();
});

it('fails when email is already registered', function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class]);
    User::factory()->create(['email' => 'admin@sagulung.go.id']);

    $this->artisan('sibima:create-super-admin', [
        'email' => 'admin@sagulung.go.id',
    ])
        ->expectsOutputToContain('Email admin@sagulung.go.id sudah terdaftar.')
        ->assertFailed();
});
