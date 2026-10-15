<?php

use App\Models\Pegawai;
use App\Models\User;

beforeEach(function () {
    $this->unit = makeKecamatan();
});

test('profile page shows the account summary', function () {
    $user = userWithRole('admin_kecamatan', $this->unit);
    Pegawai::factory()->create(['user_id' => $user->id, 'unit_id' => $this->unit->id, 'nip' => '198001012005011001']);

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page
        ->component('Profile/Edit')
        ->where('akun.nip', '198001012005011001')
        ->where('akun.unit', 'Kecamatan Sagulung')
        ->where('akun.aktif', true)
        ->has('akun.role')
        ->has('akun.cakupan')
        ->has('akun.sandi_diubah'));
});

test('profile page opens for a minimal account without role, unit, or pegawai', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page
        ->where('akun.nip', null)
        ->where('akun.role', null)
        ->where('akun.unit', null));
});

test('the name can be changed without the current password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => 'Nama Baru', 'email' => $user->email])
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    expect($user->refresh()->name)->toBe('Nama Baru');
});

test('changing the email requires the current password', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini wajib diisi untuk mengubah email.']);

    expect($user->refresh()->email)->toBe('lama@example.com');
});

test('changing the email rejects a wrong current password', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com', 'current_password' => 'salah'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.']);

    expect($user->refresh()->email)->toBe('lama@example.com');
});

test('the email can be changed with the correct current password and loses its verification', function () {
    $user = User::factory()->create(['email' => 'lama@example.com']);

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'baru@example.com', 'current_password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    $user->refresh();

    expect($user->email)->toBe('baru@example.com')->and($user->email_verified_at)->toBeNull();
});

test('an email already used by another account is rejected in Indonesian', function () {
    User::factory()->create(['email' => 'dipakai@example.com']);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => $user->name, 'email' => 'dipakai@example.com', 'current_password' => 'password'])
        ->assertSessionHasErrors(['email' => 'Email sudah dipakai akun lain.']);
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', ['name' => 'Test User', 'email' => $user->email])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('password_changed_at only moves when the password changes', function () {
    $user = User::factory()->create();
    $first = $user->password_changed_at;

    expect($first)->not->toBeNull();

    $this->travel(2)->hours();
    $user->update(['name' => 'Nama Lain']);
    expect($user->refresh()->password_changed_at->equalTo($first))->toBeTrue();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'password', 'password' => 'sandi-baru-123', 'password_confirmation' => 'sandi-baru-123'])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->password_changed_at->greaterThan($first))->toBeTrue();
});

test('the password change rejects a wrong current password and a short new password in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'salah', 'password' => 'abc', 'password_confirmation' => 'abc'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.', 'password' => 'Sandi minimal 8 karakter.']);
});

test('the password change rejects a mismatched confirmation in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put('/password', ['current_password' => 'password', 'password' => 'sandi-baru-123', 'password_confirmation' => 'beda-123456'])
        ->assertSessionHasErrors(['password' => 'Konfirmasi sandi tidak cocok.']);
});

test('users cannot delete their own account', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->delete('/profile', ['password' => 'password'])->assertStatus(405);

    expect($user->fresh())->not->toBeNull();
});
