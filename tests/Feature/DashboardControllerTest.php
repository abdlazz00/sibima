<?php

use App\Models\Asset;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    Asset::factory()->create(['unit_id' => $this->kelA->id]);
    Asset::factory()->count(2)->create(['unit_id' => $this->kelB->id]);
});

it('sends a guest to login', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

it('renders the dashboard for every role with scope-limited figures', function (string $role, ?string $unit, int $expected) {
    $user = userWithRole($role, $unit === null ? null : $this->{$unit});

    $this->actingAs($user)->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Dashboard')
            ->where('dashboard.totals.jumlah_aset', $expected)
            ->has('dashboard.per_kondisi')
            ->has('dashboard.antrean')
            ->has('dashboard.aktivitas'));
})->with([
    'kasubag' => ['kasubag', null, 3],
    'camat' => ['camat', 'kec', 3],
    'admin_kecamatan' => ['admin_kecamatan', 'kec', 0],
    'admin_kelurahan' => ['admin_kelurahan', 'kelA', 1],
    'lurah' => ['lurah', 'kelB', 2],
]);

it('passes the unit filter through and ignores a unit out of scope', function () {
    $camat = userWithRole('camat', $this->kec);

    $this->actingAs($camat)->get('/dashboard?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('dashboard.totals.jumlah_aset', 2)->where('dashboard.selected_unit_id', $this->kelB->id));

    $adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->actingAs($adminA)->get('/dashboard?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('dashboard.totals.jumlah_aset', 1)->where('dashboard.selected_unit_id', null));
});
