<?php

use App\Models\Pegawai;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class]);
});

it('shares foto_profile_url and is_active in auth.user shared props', function () {
    $user = User::factory()->create(['name' => 'Budi Pegawai', 'is_active' => true]);
    $user->assignRole('admin_kecamatan');

    Pegawai::factory()->create([
        'user_id' => $user->id,
        'foto_profile' => 'pegawai/budi.jpg',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $user->id)
            ->where('auth.user.is_active', true)
            ->where('auth.user.foto_profile_url', fn ($url) => str_contains((string) $url, 'storage/pegawai/budi.jpg'))
        );
});

it('returns null for foto_profile_url when user has no pegawai photo', function () {
    $user = User::factory()->create(['name' => 'User Tanpa Foto', 'is_active' => true]);
    $user->assignRole('admin_kecamatan');

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $user->id)
            ->where('auth.user.foto_profile_url', null)
        );
});

it('includes user.view permission for super-admin and excludes it for kasubag in shared props', function () {
    $superAdmin = userWithRole('super-admin');
    $kasubag = userWithRole('kasubag');

    $responseAdmin = $this->actingAs($superAdmin)->get(route('dashboard'));
    $responseAdmin->assertOk();
    $adminProps = $responseAdmin->viewData('page')['props'];
    expect($adminProps['auth']['user']['permissions'])->toContain('user.view');

    $responseKasubag = $this->actingAs($kasubag)->get(route('dashboard'));
    $responseKasubag->assertOk();
    $kasubagProps = $responseKasubag->viewData('page')['props'];
    expect($kasubagProps['auth']['user']['permissions'])->not->toContain('user.view');
});
