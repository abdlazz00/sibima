<?php

use App\Enums\StatusKepegawaian;
use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\QueryException;

it('casts status_kepegawaian and links to unit', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $pegawai = Pegawai::factory()->create(['unit_id' => $unit->id, 'status_kepegawaian' => 'pns']);

    expect($pegawai->status_kepegawaian)->toBe(StatusKepegawaian::Pns)
        ->and($pegawai->unit->is($unit))->toBeTrue()
        ->and($pegawai->user)->toBeNull();
});

it('enforces a unique nip when one is given', function () {
    Pegawai::factory()->create(['nip' => '198501012010011001']);

    Pegawai::factory()->create(['nip' => '198501012010011001']);
})->throws(QueryException::class);

it('allows multiple pegawai with a null nip', function () {
    Pegawai::factory()->create(['nip' => null]);
    Pegawai::factory()->create(['nip' => null]);

    expect(Pegawai::whereNull('nip')->count())->toBe(2);
});

it('scopes visibility the same way as accessibleUnitIds', function () {
    $kec = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $kel = Unit::create(['name' => 'Kelurahan Tembesi', 'type' => 'kelurahan', 'parent_id' => $kec->id]);
    $inKec = Pegawai::factory()->create(['unit_id' => $kec->id]);
    $inKel = Pegawai::factory()->create(['unit_id' => $kel->id]);

    $lurah = userWithRole('lurah', $kel);

    expect(Pegawai::query()->visibleTo($lurah)->pluck('id')->all())->toBe([$inKel->id]);
});
