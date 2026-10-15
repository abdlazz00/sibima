<?php

use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function makeNotification(User $user, string $message, bool $read = false, ?string $url = '/persetujuan'): DatabaseNotification
{
    return DatabaseNotification::create([
        'id' => (string) Str::uuid(),
        'type' => 'App\\Notifications\\ApprovalStepNotification',
        'notifiable_type' => User::class,
        'notifiable_id' => $user->id,
        'data' => ['message' => $message, 'url' => $url],
        'read_at' => $read ? now() : null,
    ]);
}

test('the inbox lists only the own notifications and can filter unread ones', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    makeNotification($user, 'Belum dibaca A');
    makeNotification($user, 'Sudah dibaca B', true);
    makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->get('/notifikasi')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Notifikasi/Index')
        ->has('items.data', 2)
        ->where('filters.filter', 'semua')
        ->where('filters.per_page', 15));

    $this->actingAs($user)->get('/notifikasi?filter=belum')->assertInertia(fn (Assert $page) => $page
        ->has('items.data', 1)
        ->where('items.data.0.message', 'Belum dibaca A')
        ->where('items.data.0.dibaca', false));
});

test('the inbox paginates with a whitelisted page size', function () {
    $user = User::factory()->create();
    foreach (range(1, 12) as $i) {
        makeNotification($user, "Pesan {$i}");
    }

    $this->actingAs($user)->get('/notifikasi?per_page=10')->assertInertia(fn (Assert $page) => $page
        ->has('items.data', 10)
        ->where('items.total', 12)
        ->where('filters.per_page', 10));
});

test('a notification can be marked read and unread without being redirected to the document', function () {
    $user = User::factory()->create();
    $n = makeNotification($user, 'Pesan');

    $this->actingAs($user)->from('/notifikasi')->post("/notifications/{$n->id}/mark", ['dibaca' => true])->assertRedirect('/notifikasi');
    expect($n->fresh()->read_at)->not->toBeNull();

    $this->actingAs($user)->post("/notifications/{$n->id}/mark", ['dibaca' => false])->assertSessionHasNoErrors();
    expect($n->fresh()->read_at)->toBeNull();
});

test('marking requires the read flag and cannot touch notifications of another user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $mine = makeNotification($user, 'Milik saya');
    $theirs = makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->post("/notifications/{$mine->id}/mark", [])->assertSessionHasErrors('dibaca');
    $this->actingAs($user)->post("/notifications/{$theirs->id}/mark", ['dibaca' => true])->assertNotFound();

    expect($theirs->fresh()->read_at)->toBeNull();
});

test('mark all read affects only the own unread notifications', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $a = makeNotification($user, 'A');
    $b = makeNotification($user, 'B');
    $theirs = makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->post('/notifications/read-all')->assertSessionHas('success');

    expect($a->fresh()->read_at)->not->toBeNull()
        ->and($b->fresh()->read_at)->not->toBeNull()
        ->and($theirs->fresh()->read_at)->toBeNull();
});

test('a notification without a document link is listed with a null url', function () {
    $user = User::factory()->create();
    makeNotification($user, 'Tanpa tautan', false, null);

    $this->actingAs($user)->get('/notifikasi')->assertInertia(fn (Assert $page) => $page->where('items.data.0.url', null));
});
