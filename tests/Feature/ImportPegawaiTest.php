<?php

use App\Imports\PegawaiImporter;
use App\Models\Pegawai;

function impPeg(array $o = []): array
{
    return array_merge([
        'Nama' => 'Budi Santoso', 'NIP' => '198001012005011001', 'Pangkat/Golongan' => 'III/a',
        'Jabatan' => 'Staf', 'Status Kepegawaian' => 'PNS', 'Unit' => 'Kelurahan A',
        'No. HP' => '0812', 'Email Dinas' => 'budi@batam.go.id',
    ], $o);
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->importer = app(PegawaiImporter::class);
    $this->importer->begin(userWithRole('kasubag'));
});

it('accepts a valid row and normalises the status', function () {
    $r = $this->importer->validate(impPeg(['Status Kepegawaian' => ' pppk ']));

    expect($r->status)->toBe('baru')
        ->and($r->data)->toMatchArray(['nama' => 'Budi Santoso', 'status' => 'pppk', 'unit_id' => $this->kelA->id]);
});

it('rejects missing required columns, bad status and unknown units', function () {
    $r = $this->importer->validate(impPeg(['Nama' => null, 'Jabatan' => '', 'Status Kepegawaian' => 'Honorer', 'Unit' => 'Kelurahan Z']));

    expect($r->status)->toBe('error')
        ->and(collect($r->errors)->pluck('kolom')->sort()->values()->all())
        ->toBe(['Jabatan', 'Nama', 'Status Kepegawaian', 'Unit']);
});

it('rejects a unit outside the importing account scope', function () {
    $importer = app(PegawaiImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));

    expect($importer->validate(impPeg(['Unit' => 'Kelurahan A']))->status)->toBe('baru')
        ->and($importer->validate(impPeg(['NIP' => '2', 'Unit' => 'Kelurahan B']))->errors[0]['alasan'])->toContain('di luar cakupan');
});

it('treats an existing NIP as a duplicate, in the database and within the file', function () {
    Pegawai::create(['nama' => 'Lama', 'nip' => '198001012005011001', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    expect($this->importer->validate(impPeg())->status)->toBe('duplikat')
        ->and($this->importer->validate(impPeg(['NIP' => '555']))->status)->toBe('baru')
        ->and($this->importer->validate(impPeg(['NIP' => '555', 'Nama' => 'Lain']))->status)->toBe('duplikat');
});

it('falls back to name plus unit when the NIP is empty', function () {
    Pegawai::create(['nama' => 'Siti', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    expect($this->importer->validate(impPeg(['NIP' => null, 'Nama' => 'siti ']))->status)->toBe('duplikat')
        ->and($this->importer->validate(impPeg(['NIP' => null, 'Nama' => 'Siti', 'Unit' => 'Kelurahan B']))->status)->toBe('baru');
});

it('reads a NIP typed as a number as its full digits', function () {
    $r = $this->importer->validate(impPeg(['NIP' => 198001012005.0]));

    expect($r->data['nip'])->toBe('198001012005');
});

it('saves the pegawai with the resolved unit and nullable optional fields', function () {
    $this->importer->save($this->importer->validate(impPeg(['NIP' => null, 'No. HP' => null, 'Email Dinas' => null]))->data);

    $p = Pegawai::first();

    expect($p->nama)->toBe('Budi Santoso')
        ->and($p->unit_id)->toBe($this->kelA->id)
        ->and($p->status_kepegawaian->value)->toBe('pns')
        ->and($p->nip)->toBeNull();
});

it('exports only pegawai visible to the actor, in template column order', function () {
    Pegawai::create(['nama' => 'A', 'nip' => '1', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pppk', 'unit_id' => $this->kelA->id]);
    Pegawai::create(['nama' => 'B', 'nip' => '2', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelB->id]);

    $importer = app(PegawaiImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));
    $rows = iterator_to_array($importer->export([]), false);

    expect($importer->headers())->toBe(['Nama', 'NIP', 'Pangkat/Golongan', 'Jabatan', 'Status Kepegawaian', 'Unit', 'No. HP', 'Email Dinas'])
        ->and($rows)->toBe([['A', '1', null, 'Staf', 'PPPK', 'Kelurahan A', null, null]])
        ->and($importer->exportCount([]))->toBe(1);
});
