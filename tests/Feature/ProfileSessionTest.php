<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function insertSession(string $id, ?int $userId, string $ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', string $ip = '10.0.0.5', ?int $last = null): void
{
    DB::table('sessions')->insert([
        'id' => $id,
        'user_id' => $userId,
        'ip_address' => $ip,
        'user_agent' => $ua,
        'payload' => '',
        'last_activity' => $last ?? now()->timestamp,
    ]);
}

test('the profile lists only the sessions of the signed-in user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page
        ->has('sessions', 1)
        ->where('sessions.0.perangkat', 'Chrome di Windows')
        ->where('sessions.0.ip', '10.0.0.5')
        ->where('sessions.0.ini', false)
        ->where('sessions.0.ref', hash('sha256', 'mine-1')));
});

test('a single other session can be revoked with the correct password', function () {
    $user = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('mine-2', $user->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'mine-1'), ['current_password' => 'password'])
        ->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', 'mine-2')->exists())->toBeTrue();
});

test('a wrong password revokes nothing', function () {
    $user = User::factory()->create();
    insertSession('mine-1', $user->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'mine-1'), ['current_password' => 'salah'])
        ->assertSessionHasErrors(['current_password' => 'Sandi saat ini salah.']);

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeTrue();
});

test('a session of another user cannot be revoked', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)
        ->delete('/profile/sessions/'.hash('sha256', 'theirs-1'), ['current_password' => 'password'])
        ->assertNotFound();

    expect(DB::table('sessions')->where('id', 'theirs-1')->exists())->toBeTrue();
});

test('the running session is marked, excluded from revocation, and spared by revoke-all', function () {
    $user = User::factory()->create();
    $current = Str::random(40);
    $cookie = config('session.cookie');
    insertSession($current, $user->id);
    insertSession('mine-2', $user->id);

    $this->actingAs($user)->withCookie($cookie, $current)->get('/profile')->assertInertia(fn ($page) => $page
        ->where('sessions', fn ($sessions) => collect($sessions)->firstWhere('ref', hash('sha256', $current))['ini'] === true));

    $this->actingAs($user)->withCookie($cookie, $current)
        ->delete('/profile/sessions/'.hash('sha256', $current), ['current_password' => 'password'])
        ->assertNotFound();

    $this->actingAs($user)->withCookie($cookie, $current)
        ->delete('/profile/sessions', ['current_password' => 'password'])
        ->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', $current)->exists())->toBeTrue()
        ->and(DB::table('sessions')->where('id', 'mine-2')->exists())->toBeFalse();
});

test('revoking all other sessions requires the password and spares other users', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    insertSession('mine-1', $user->id);
    insertSession('theirs-1', $other->id);

    $this->actingAs($user)->delete('/profile/sessions', ['current_password' => 'salah'])->assertSessionHasErrors('current_password');
    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeTrue();

    $this->actingAs($user)->delete('/profile/sessions', ['current_password' => 'password'])->assertSessionHasNoErrors();

    expect(DB::table('sessions')->where('id', 'mine-1')->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', 'theirs-1')->exists())->toBeTrue();
});
