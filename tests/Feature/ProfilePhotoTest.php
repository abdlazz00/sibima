<?php

use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

test('a user can upload a profile photo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('saya.jpg')])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $path = $user->refresh()->foto_profile;

    expect($path)->toStartWith('profile-photos/');
    Storage::disk('public')->assertExists($path);
    expect($user->foto_profile_url)->not->toBeNull();
});

test('replacing the photo removes the previous file', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);
    $first = $user->refresh()->foto_profile;

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('b.png')]);
    $second = $user->refresh()->foto_profile;

    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing($first);
    Storage::disk('public')->assertExists($second);
});

test('the photo can be removed and leaves no file behind', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);
    $path = $user->refresh()->foto_profile;

    $this->actingAs($user)->delete('/profile/photo')->assertRedirect();

    expect($user->refresh()->foto_profile)->toBeNull();
    Storage::disk('public')->assertMissing($path);
});

test('a non-image, a wrong format, and an oversized file are rejected in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf')])
        ->assertSessionHasErrors('foto');

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('animasi.gif')])
        ->assertSessionHasErrors(['foto' => 'Foto harus berformat JPG, PNG, atau WEBP.']);

    $this->actingAs($user)
        ->post('/profile/photo', ['foto' => UploadedFile::fake()->image('besar.jpg')->size(3000)])
        ->assertSessionHasErrors(['foto' => 'Ukuran foto maksimal 2 MB.']);

    expect($user->refresh()->foto_profile)->toBeNull();
});

test('without an own photo the linked pegawai photo is the fallback', function () {
    $user = User::factory()->create();
    Pegawai::factory()->create(['user_id' => $user->id, 'foto_profile' => 'pegawai/foto.jpg']);

    expect($user->refresh()->foto_profile_url)->toContain('pegawai/foto.jpg');

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);

    expect($user->refresh()->foto_profile_url)->toContain('profile-photos/');
});

test('the profile props tell whether the user has an own photo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page->where('akun.punya_foto', false));

    $this->actingAs($user)->post('/profile/photo', ['foto' => UploadedFile::fake()->image('a.jpg')]);

    $this->actingAs($user)->get('/profile')->assertInertia(fn ($page) => $page->where('akun.punya_foto', true));
});
