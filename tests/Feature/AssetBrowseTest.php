<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $this->pendingin = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $this->kategori->id]);
    $this->kantor = AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => AssetCategory::create(['name' => 'ALAT KANTOR'])->id]);

    $this->acKec = Asset::factory()->create(['nama_aset' => 'A.C. Split', 'unit_id' => $this->kec->id, 'category_id' => $this->pendingin->id]);
    $this->acKel = Asset::factory()->create(['nama_aset' => 'A.C. Split', 'unit_id' => $this->kelA->id, 'category_id' => $this->pendingin->id, 'no_dokumen' => 'M#GW04A268636-378-2023-0001']);
    $this->papan = Asset::factory()->create(['nama_aset' => 'Papan Pengumuman', 'kode_barang' => '1.3.2.05.01.05.077', 'unit_id' => $this->kelA->id, 'category_id' => $this->kantor->id, 'kondisi' => 'rusak_berat']);
    $this->other = Asset::factory()->create(['nama_aset' => 'Sedan', 'unit_id' => $this->otherKec->id, 'category_id' => $this->kantor->id]);
});

it('lists only in-scope assets for camat', function () {
    $this->actingAs(userWithRole('camat', $this->kec))
        ->get('/assets')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Index')
            ->has('assets.data', 3)
            ->has('kondisiOptions', 4)
            ->has('units', 2)
            ->where('can.create', false));
});

it('lists only its own kelurahan assets for admin_kelurahan', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get('/assets')
        ->assertInertia(fn (Assert $page) => $page
            ->has('assets.data', 2)
            ->has('units', 1)
            ->where('can.create', true));
});

it('forbids a user with no role from browsing assets', function () {
    $user = User::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs($user)->get('/assets')->assertForbidden();
});

it('searches by name, kode_barang and no_dokumen', function (string $term, int $expected) {
    $this->actingAs(userWithRole('kasubag'))
        ->get('/assets?search='.urlencode($term))
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', $expected));
})->with([
    ['papan', 1],
    ['1.3.2.05.01.05', 1],
    ['GW04A268636', 1],
    ['tidak-ada', 0],
]);

it('filters by kategori including its subkategori, and by kondisi', function () {
    $user = userWithRole('kasubag');

    $this->actingAs($user)->get("/assets?category_id={$this->kategori->id}")
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 2));
    $this->actingAs($user)->get('/assets?kondisi=rusak_berat')
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 1)->where('assets.data.0.id', $this->papan->id));
});

it('cannot widen scope with a unit filter', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get("/assets?unit_id={$this->otherKec->id}")
        ->assertInertia(fn (Assert $page) => $page->has('assets.data', 0));
});

it('shows an in-scope asset with its relations', function () {
    $this->acKel->histories()->create(['event' => 'dibuat', 'unit_id' => $this->kelA->id, 'kondisi' => 'baik']);

    $this->actingAs(userWithRole('lurah', $this->kelA))
        ->get("/assets/{$this->acKel->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Show')
            ->where('asset.id', $this->acKel->id)
            ->where('asset.unit.name', 'Kelurahan Tembesi')
            ->where('asset.category.parent.name', 'ALAT RUMAH TANGGA')
            ->has('asset.histories', 1)
            ->where('can.update', false));
});

it('returns 403 for an out-of-scope asset opened by URL', function () {
    $this->actingAs(userWithRole('admin_kelurahan', $this->kelA))
        ->get("/assets/{$this->acKec->id}")
        ->assertForbidden();
});

it('includes the asset photos in the index so the Foto column can render them', function () {
    $this->papan->photos()->create(['path' => 'assets/papan.jpg']);

    $this->actingAs(userWithRole('camat', $this->kec))
        ->get('/assets?search=Papan')
        ->assertInertia(fn (Assert $page) => $page
            ->has('assets.data', 1)
            ->where('assets.data.0.photos.0.url', fn (string $url) => str_ends_with($url, 'assets/papan.jpg')));
});
