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
            ->where('can.create', true)
            ->where('can.createUser', false));
});

it('only exposes can.createUser as true for kasubag', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->get('/pegawais')
        ->assertInertia(fn (Assert $page) => $page->where('can.createUser', true));
});

it('exposes can.create as false for camat and lurah, who may only approve not edit pegawai data', function (string $role) {
    $this->actingAs(userWithRole($role, $this->kec))
        ->get('/pegawais')
        ->assertInertia(fn (Assert $page) => $page->where('can.create', false));
})->with(['camat', 'lurah']);

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

    $this->actingAs($user)->get('/pegawais/create')->assertForbidden();
    $this->actingAs($user)->post('/pegawais', ['nama' => 'X'])->assertForbidden();
    $this->actingAs($user)->put("/pegawais/{$pegawai->id}", ['nama' => 'Y'])->assertForbidden();
    $this->actingAs($user)->delete("/pegawais/{$pegawai->id}")->assertForbidden();
})->with(['camat', 'lurah']);

it('shows kasubag the create pegawai page with units', function () {
    $this->actingAs(userWithRole('kasubag'))
        ->get('/pegawais/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pegawai/Create')
            ->has('units'));
});

it('shows kasubag the show pegawai page with relations', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Budi Santoso']);

    $this->actingAs(userWithRole('kasubag'))
        ->get("/pegawais/{$pegawai->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pegawai/Show')
            ->where('pegawai.id', $pegawai->id)
            ->where('pegawai.nama', 'Budi Santoso')
            ->where('can.update', true)
            ->where('can.createUser', true));
});

it('shows kasubag the edit pegawai page with units', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kel->id, 'nama' => 'Budi Santoso']);

    $this->actingAs(userWithRole('kasubag'))
        ->get("/pegawais/{$pegawai->id}/edit")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pegawai/Edit')
            ->where('pegawai.id', $pegawai->id)
            ->where('pegawai.nama', 'Budi Santoso')
            ->has('units'));
});

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
