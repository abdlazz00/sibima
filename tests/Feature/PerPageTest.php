<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $kategori->id]);
    Asset::factory()->count(12)->create(['unit_id' => $this->kec->id, 'category_id' => $sub->id]);
    $this->user = userWithRole('camat', $this->kec);
});

test('the asset list honors a whitelisted page size and exposes it in the filters', function () {
    $this->actingAs($this->user)->get('/assets?per_page=10')->assertInertia(fn (Assert $page) => $page
        ->has('assets.data', 10)
        ->where('assets.per_page', 10)
        ->where('filters.per_page', 10));

    $this->actingAs($this->user)->get('/assets?per_page=7')->assertInertia(fn (Assert $page) => $page
        ->has('assets.data', 12)
        ->where('assets.per_page', 15)
        ->where('filters.per_page', 15));
});

test('the asset report detail honors the page size and keeps the default of 25', function () {
    $this->actingAs($this->user)->get('/laporan-aset?per_page=10')->assertInertia(fn (Assert $page) => $page->where('asets.per_page', 10));
    $this->actingAs($this->user)->get('/laporan-aset')->assertInertia(fn (Assert $page) => $page->where('asets.per_page', 25));
});
