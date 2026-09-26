<?php

use App\Models\Pegawai;
use App\Services\PegawaiService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->service = app(PegawaiService::class);

    $this->data = fn (array $overrides = []) => array_merge([
        'nama' => 'Ahmad Fauzi',
        'nip' => '198501012010011001',
        'pangkat_golongan' => 'Penata Muda / III.a',
        'jabatan' => 'Staff',
        'status_kepegawaian' => 'pns',
        'unit_id' => $this->kel->id,
    ], $overrides);
});

it('forces unit_id to the admin unit actor unit, ignoring a smuggled unit_id', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);

    $pegawai = $this->service->create(($this->data)(['unit_id' => $this->kec->id]), null, $admin);

    expect($pegawai->unit_id)->toBe($this->kel->id);
});

it('lets kasubag pick any unit', function () {
    $kasubag = userWithRole('kasubag');

    $pegawai = $this->service->create(($this->data)(['unit_id' => $this->kec->id]), null, $kasubag);

    expect($pegawai->unit_id)->toBe($this->kec->id);
});

it('stores an uploaded profile photo on the public disk', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);

    $pegawai = $this->service->create(($this->data)(), UploadedFile::fake()->image('foto.jpg'), $admin);

    expect($pegawai->foto_profile)->not->toBeNull();
    Storage::disk('public')->assertExists($pegawai->foto_profile);
});

it('replaces the old photo file when updated with a new one', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), UploadedFile::fake()->image('lama.jpg'), $admin);
    $oldPath = $pegawai->foto_profile;

    $this->service->update($pegawai, ($this->data)(), UploadedFile::fake()->image('baru.jpg'));

    Storage::disk('public')->assertMissing($oldPath);
    Storage::disk('public')->assertExists($pegawai->refresh()->foto_profile);
});

it('never moves unit_id on update', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), null, $admin);

    $this->service->update($pegawai, ($this->data)(['unit_id' => $this->kec->id, 'nama' => 'Ahmad F.']), null);

    expect($pegawai->refresh()->unit_id)->toBe($this->kel->id)
        ->and($pegawai->nama)->toBe('Ahmad F.');
});

it('deletes a pegawai', function () {
    $admin = userWithRole('admin_kelurahan', $this->kel);
    $pegawai = $this->service->create(($this->data)(), null, $admin);

    $this->service->delete($pegawai);

    expect(Pegawai::find($pegawai->id))->toBeNull();
});
