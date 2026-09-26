<?php

use App\Models\Pegawai;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
});

it('shows admin_kelurahan only pegawai in their own unit', function () {
    Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Di Kelurahan']);
    Pegawai::factory()->create(['unit_id' => $this->kec->id, 'nama' => 'Di Kecamatan']);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->get('/pegawais')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pegawai/Index')
            ->has('pegawais', 1)
            ->where('pegawais.0.nama', 'Di Kelurahan')
            ->where('can.create', true));
});

it('lets kasubag see every pegawai', function () {
    Pegawai::factory()->create(['unit_id' => $this->kel->id]);
    Pegawai::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs(userWithRole('kasubag'))
        ->get('/pegawais')
        ->assertInertia(fn (Assert $page) => $page->has('pegawais', 2));
});

it('lets admin_kelurahan create a pegawai forced into their own unit', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->post('/pegawais', [
            'nama' => 'Budi',
            'nip' => null,
            'pangkat_golongan' => null,
            'jabatan' => 'Staff',
            'status_kepegawaian' => 'pppk',
            'unit_id' => $this->kec->id,
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $pegawai = Pegawai::where('nama', 'Budi')->firstOrFail();
    expect($pegawai->unit_id)->toBe($this->kel->id);
});

it('rejects a duplicate nip with a validation error, not a 500', function () {
    Pegawai::factory()->create(['nip' => '198501012010011001']);

    $this->actingAs(userWithRole('kasubag'))
        ->post('/pegawais', [
            'nama' => 'Duplikat',
            'nip' => '198501012010011001',
            'jabatan' => 'Staff',
            'status_kepegawaian' => 'pns',
            'unit_id' => $this->kec->id,
        ])
        ->assertSessionHasErrors('nip');
});

it('forbids camat and lurah from creating, updating or deleting a pegawai', function (string $role) {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $user = userWithRole($role, $this->kec->id === $pegawai->unit_id ? $this->kec : $this->kel);

    $this->actingAs($user)->post('/pegawais', ['nama' => 'X'])->assertForbidden();
    $this->actingAs($user)->put("/pegawais/{$pegawai->id}", ['nama' => 'Y'])->assertForbidden();
    $this->actingAs($user)->delete("/pegawais/{$pegawai->id}")->assertForbidden();
})->with(['camat', 'lurah']);

it('lets an admin update a pegawai in their own unit', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'jabatan' => 'Staff']);

    $this->actingAs(userWithRole('admin_kelurahan', $this->kel))
        ->put("/pegawais/{$pegawai->id}", [
            'nama' => $pegawai->nama,
            'nip' => $pegawai->nip,
            'pangkat_golongan' => $pegawai->pangkat_golongan,
            'jabatan' => 'Kepala Seksi',
            'status_kepegawaian' => $pegawai->status_kepegawaian->value,
            'unit_id' => $pegawai->unit_id,
        ])
        ->assertSessionHasNoErrors();

    expect($pegawai->refresh()->jabatan)->toBe('Kepala Seksi');
});

it('deletes a pegawai as kasubag', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs(userWithRole('kasubag'))
        ->delete("/pegawais/{$pegawai->id}")
        ->assertSessionHas('success');

    expect(Pegawai::find($pegawai->id))->toBeNull();
});
