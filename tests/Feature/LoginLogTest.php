<?php

use App\Models\LoginLog;
use App\Models\User;

test('a successful login, a failed attempt, and a logout are recorded', function () {
    $user = User::factory()->create(['email' => 'budi@example.com']);

    $this->post('/login', ['email' => 'budi@example.com', 'password' => 'password'])->assertRedirect();
    $this->post('/logout');
    $this->post('/login', ['email' => 'budi@example.com', 'password' => 'salah']);

    expect(LoginLog::where('user_id', $user->id)->pluck('event')->all())->toEqual(['login', 'logout', 'gagal']);
    expect(LoginLog::where('event', 'login')->first()->identifier)->toBe('budi@example.com')
        ->and(LoginLog::where('event', 'logout')->first()->identifier)->toBe('');
});

test('a failed attempt for an unknown account is recorded without a user', function () {
    $this->post('/login', ['email' => 'tidak-ada@example.com', 'password' => 'apa-saja']);

    $log = LoginLog::first();

    expect($log->user_id)->toBeNull()
        ->and($log->event)->toBe('gagal')
        ->and($log->identifier)->toBe('tidak-ada@example.com');
});

test('login logs older than 90 days are pruned', function () {
    $user = User::factory()->create();
    $old = LoginLog::create(['user_id' => $user->id, 'identifier' => 'x', 'event' => 'login', 'ip_address' => '1.1.1.1']);
    $old->forceFill(['created_at' => now()->subDays(91)])->save();
    $recent = LoginLog::create(['user_id' => $user->id, 'identifier' => 'x', 'event' => 'login', 'ip_address' => '1.1.1.1']);

    $this->artisan('model:prune', ['--model' => [LoginLog::class]])->assertSuccessful();

    expect(LoginLog::pluck('id')->all())->toEqual([$recent->id]);
});

test('an over-long login identifier is rejected by validation instead of failing at the database', function () {
    $this->post('/login', ['email' => str_repeat('a', 300), 'password' => 'x'])->assertSessionHasErrors('email');

    expect(LoginLog::count())->toBe(0);
});

test('an identifier that is neither an email nor a nip is not stored in plain text', function () {
    $this->post('/login', ['email' => 'rahasia-sandi-123', 'password' => 'x']);

    expect(LoginLog::first()->identifier)->toBe('[input tidak valid]');
});

test('a login refused because the account is inactive is logged as a failure only', function () {
    $user = User::factory()->create(['email' => 'nonaktif@example.com', 'is_active' => false]);

    $this->post('/login', ['email' => 'nonaktif@example.com', 'password' => 'password']);

    expect(LoginLog::where('user_id', $user->id)->pluck('event')->all())->toEqual(['gagal']);
});
