<?php

use App\Models\User;

it('ensures legacy /laporan routes return 404', function () {
    $kec = makeKecamatan();
    $camat = userWithRole('camat', $kec);

    $this->actingAs($camat)->get('/laporan')->assertNotFound();
    $this->actingAs($camat)->get('/laporan/rusak-hilang/unduh')->assertNotFound();
    $this->actingAs($camat)->get('/laporan/mutasi/unduh')->assertNotFound();
    $this->actingAs($camat)->get('/laporan/aset/unduh')->assertNotFound();
});
