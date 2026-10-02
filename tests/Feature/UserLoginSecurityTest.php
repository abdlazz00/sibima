<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
});

it('rejects login attempt for inactive users with informative error message', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'password' => 'secret1234',
        'is_active' => false,
    ]);
    $user->assignRole('admin_kecamatan');

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'secret1234',
    ]);

    $response->assertSessionHasErrors('email');
    expect(Auth::check())->toBeFalse();
    $errors = session('errors')->get('email');
    expect(implode(' ', $errors))->toContain('dinonaktifkan');
});

it('throttles excessive failed login attempts', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'password' => 'secret1234',
    ]);

    for ($i = 0; $i < 5; $i++) {
        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);
    }

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertSessionHasErrors('email');
    $errors = session('errors')->get('email');
    expect(implode(' ', $errors))->toMatch('/(Terlalu banyak|Too many)/');
});

it('logs out and redirects an active session if user is deactivated', function () {
    $user = User::factory()->create([
        'unit_id' => $this->unit->id,
        'is_active' => true,
    ]);

    $this->actingAs($user);
    $this->get('/dashboard')->assertOk();

    // Admin menonaktifkan akun
    $user->update(['is_active' => false]);

    // Request berikutnya harus tertendang
    $response = $this->get('/dashboard');
    $response->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();
});
