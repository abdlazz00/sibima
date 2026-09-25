<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
});

it('shows kasubag the category tree', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'MEUBELAIR', 'parent_id' => $kategori->id]);
    AssetCategory::create(['name' => 'ALAT DAPUR', 'parent_id' => $kategori->id]);

    $this->actingAs($this->kasubag)
        ->get('/asset-categories')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('AssetCategories/Index')
            ->has('categories', 1)
            ->where('categories.0.name', 'ALAT RUMAH TANGGA')
            ->has('categories.0.children', 2)
            ->where('categories.0.children.0.name', 'ALAT DAPUR'));
});

it('forbids every other role from managing categories', function (string $role) {
    $user = userWithRole($role, $this->kec);

    $this->actingAs($user)->get('/asset-categories')->assertForbidden();
    $this->actingAs($user)->post('/asset-categories', ['name' => 'X'])->assertForbidden();
})->with(['camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai']);

it('lets kasubag create a kategori and a subkategori', function () {
    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'ALAT KANTOR'])
        ->assertRedirect()
        ->assertSessionHas('success');

    $kategori = AssetCategory::where('name', 'ALAT KANTOR')->firstOrFail();

    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'ALAT KANTOR LAINNYA', 'parent_id' => $kategori->id])
        ->assertSessionHasNoErrors();

    expect($kategori->children()->pluck('name')->all())->toBe(['ALAT KANTOR LAINNYA']);
});

it('rejects a duplicate name at the same level but allows it under another kategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $a->id]);

    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'ALAT KANTOR'])
        ->assertSessionHasErrors('name');
    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'LAINNYA', 'parent_id' => $a->id])
        ->assertSessionHasErrors('name');
    $this->actingAs($this->kasubag)->post('/asset-categories', ['name' => 'LAINNYA', 'parent_id' => $b->id])
        ->assertSessionHasNoErrors();
});

it('only accepts a top-level kategori as parent', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $kategori->id]);

    $this->actingAs($this->kasubag)
        ->post('/asset-categories', ['name' => 'CUCU', 'parent_id' => $sub->id])
        ->assertSessionHasErrors('parent_id');
});

it('renames a category and refuses to demote a kategori that has subkategori', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR']);
    AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $a->id]);
    $b = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);

    $this->actingAs($this->kasubag)->put("/asset-categories/{$a->id}", ['name' => 'PERALATAN KANTOR'])
        ->assertSessionHasNoErrors();
    expect($a->refresh()->name)->toBe('PERALATAN KANTOR');

    $this->actingAs($this->kasubag)->put("/asset-categories/{$a->id}", ['name' => 'PERALATAN KANTOR', 'parent_id' => $b->id])
        ->assertSessionHasErrors('parent_id');
    expect($a->refresh()->parent_id)->toBeNull();
});

it('refuses to delete a category that still has subkategori or assets, with a message', function () {
    $kategori = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $sub = AssetCategory::create(['name' => 'LAINNYA', 'parent_id' => $kategori->id]);
    Asset::factory()->create(['category_id' => $sub->id, 'unit_id' => $this->kec->id]);

    $this->actingAs($this->kasubag)->delete("/asset-categories/{$kategori->id}")
        ->assertSessionHasErrors('category');
    $this->actingAs($this->kasubag)->delete("/asset-categories/{$sub->id}")
        ->assertSessionHasErrors('category');

    expect(AssetCategory::count())->toBe(2);
});

it('deletes an unused category', function () {
    $kategori = AssetCategory::create(['name' => 'KOSONG']);

    $this->actingAs($this->kasubag)->delete("/asset-categories/{$kategori->id}")
        ->assertSessionHas('success');

    expect(AssetCategory::count())->toBe(0);
});

it('redirects guests to login', function () {
    $this->get('/asset-categories')->assertRedirect('/login');
});
