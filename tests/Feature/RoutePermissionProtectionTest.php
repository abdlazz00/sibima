<?php

use App\Models\Asset;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->kec = makeKecamatan();
});

test('user tanpa izin dashboard.view ditolak 403 saat mengakses dashboard', function () {
    $role = Role::create(['name' => 'tanpa_dashboard', 'guard_name' => 'web']);
    $user = userWithRole('tanpa_dashboard', $this->kec);

    $this->actingAs($user)->get('/dashboard')->assertForbidden();
});

test('user tanpa izin persetujuan.view ditolak 403 saat mengakses persetujuan', function () {
    $role = Role::create(['name' => 'tanpa_persetujuan', 'guard_name' => 'web']);
    $user = userWithRole('tanpa_persetujuan', $this->kec);

    $this->actingAs($user)->get('/persetujuan')->assertForbidden();
});

test('user tanpa izin scan.view ditolak 403 saat mengakses scan', function () {
    $role = Role::create(['name' => 'tanpa_scan', 'guard_name' => 'web']);
    $user = userWithRole('tanpa_scan', $this->kec);

    $this->actingAs($user)->get('/scan')->assertForbidden();

    $asset = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $this->actingAs($user)->get("/scan/{$asset->qr_token}")->assertForbidden();
});
