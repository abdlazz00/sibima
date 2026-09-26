<?php

use App\Models\Pegawai;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('admin_kelurahan');
    $this->kel = makeKelurahan(makeKecamatan(), 'Kelurahan Tembesi');
    $this->pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Budi Santoso']);
});

it('lets kasubag create a login account for a pegawai', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $user = User::where('email', 'budi@simaset.test')->firstOrFail();

    expect($user->hasRole('admin_kelurahan'))->toBeTrue()
        ->and($user->unit_id)->toBe($this->kel->id)
        ->and($this->pegawai->refresh()->user_id)->toBe($user->id);
});

it('rejects creating a second login for an already-linked pegawai', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ]);

    $this->actingAs(userWithRole('kasubag'))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi2@simaset.test',
            'password' => 'password123',
            'role' => 'lurah',
        ])
        ->assertSessionHasErrors('email');

    expect(User::where('email', 'budi2@simaset.test')->exists())->toBeFalse();
});

it('forbids admin_kelurahan from creating a login account', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post("/pegawais/{$this->pegawai->id}/user", [
            'email' => 'budi@simaset.test',
            'password' => 'password123',
            'role' => 'admin_kelurahan',
        ])
        ->assertForbidden();
});
