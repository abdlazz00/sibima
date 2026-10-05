<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

test('reset password link screen can be rendered', function () {
    $response = $this->get('/forgot-password');

    $response->assertStatus(200);
});

test('reset password link can be requested', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class);
});

test('reset password screen can be rendered', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) {
        $response = $this->get('/reset-password/'.$notification->token);

        $response->assertStatus(200);

        return true;
    });
});

test('password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
        $response = $this->post('/reset-password', [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        return true;
    });
});

test('the answer is the same for a registered and an unknown email', function () {
    Notification::fake();
    $user = User::factory()->create();

    $known = $this->from('/forgot-password')->post('/forgot-password', ['email' => $user->email]);
    $unknown = $this->from('/forgot-password')->post('/forgot-password', ['email' => 'tidak.ada@example.com']);

    $known->assertSessionHasNoErrors();
    $unknown->assertSessionHasNoErrors();
    expect(session('status'))->toBe('Jika email terdaftar, tautan reset password telah dikirim.');
    Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
    Notification::assertCount(1);
});

test('an inactive account is not sent a reset link and gets the same answer', function () {
    Notification::fake();
    $user = User::factory()->create(['is_active' => false]);

    $this->post('/forgot-password', ['email' => $user->email])->assertSessionHasNoErrors();

    Notification::assertNothingSent();
    expect(session('status'))->toBe('Jika email terdaftar, tautan reset password telah dikirim.');
});

test('the reset email is queued and written in Indonesian', function () {
    Queue::fake();
    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Queue::assertPushed(SendQueuedNotifications::class);

    $notification = new ResetPasswordNotification('token-123');
    $mail = $notification->toMail($user);

    expect($notification)->toBeInstanceOf(ShouldQueue::class)
        ->and($mail->subject)->toBe('Atur Ulang Password SIBIMA')
        ->and($mail->actionText)->toBe('Atur Ulang Password')
        ->and($mail->actionUrl)->toContain('reset-password/token-123');
});

test('requesting a reset link is throttled per client', function () {
    Notification::fake();

    foreach (range(1, 6) as $i) {
        $this->post('/forgot-password', ['email' => "x{$i}@example.com"])->assertSessionHasNoErrors();
    }

    $this->post('/forgot-password', ['email' => 'x7@example.com'])->assertStatus(429);
});

test('an invalid or expired reset token shows a clear Indonesian message', function () {
    $user = User::factory()->create();

    $this->post('/reset-password', [
        'token' => 'token-salah', 'email' => $user->email,
        'password' => 'password-baru-123', 'password_confirmation' => 'password-baru-123',
    ])->assertSessionHasErrors(['email' => 'Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.']);
});
