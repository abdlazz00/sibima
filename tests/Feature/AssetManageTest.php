<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->kategori = AssetCategory::create(['name' => 'ALAT RUMAH TANGGA']);
    $this->sub = AssetCategory::create(['name' => 'ALAT PENDINGIN', 'parent_id' => $this->kategori->id]);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);

    $this->payload = fn (array $overrides = []) => array_merge([
        'kode_barang' => '1.3.2.05.02.04.004',
        'nama_aset' => 'A.C. Split',
        'category_id' => $this->sub->id,
        'merk_type' => 'PANASONIC',
        'kondisi' => 'baik',
        'tanggal_perolehan' => '2023-06-14',
        'nilai_perolehan' => 5000000,
        'nilai_buku' => 1250000,
        'no_dokumen' => 'M#GW04A268636-378-2023-0001',
    ], $overrides);
});

function jpg(string $name = 'foto.jpg', int $kb = 200): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, 'image/jpeg');
}

it('shows the create form to an admin', function () {
    $this->actingAs($this->adminKel)->get('/assets/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Assets/Create')
            ->has('categories', 1)
            ->has('kondisiOptions', 4)
            ->where('maxPhotos', 10));
});

it('records an asset with photos in the admin unit', function () {
    $response = $this->actingAs($this->adminKel)->post('/assets', [
        ...($this->payload)(),
        'photos' => [jpg('depan.jpg'), jpg('belakang.jpg')],
    ]);

    $asset = Asset::firstOrFail();

    $response->assertRedirect("/assets/{$asset->id}")->assertSessionHas('success');
    expect($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->nomor_register)->toBe(1)
        ->and($asset->photos)->toHaveCount(2)
        ->and($asset->histories()->count())->toBe(1);
});

it('ignores unit, status and holder fields tampered into the request', function () {
    $this->actingAs($this->adminKel)->post('/assets', [
        ...($this->payload)(),
        'unit_id' => $this->kec->id,
        'status' => 'dalam_proses',
        'current_holder_id' => $this->adminKel->id,
    ])->assertSessionHasNoErrors();

    $asset = Asset::firstOrFail();

    expect($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->current_holder_id)->toBeNull();
});

it('forbids non-admin roles from recording assets', function (string $role) {
    $user = userWithRole($role, $role === 'kasubag' ? null : $this->kec);

    $this->actingAs($user)->get('/assets/create')->assertForbidden();
    $this->actingAs($user)->post('/assets', ($this->payload)())->assertForbidden();
    expect(Asset::count())->toBe(0);
})->with(['kasubag', 'camat', 'lurah']);

it('forbids a user with no role from recording assets', function () {
    $user = \App\Models\User::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs($user)->get('/assets/create')->assertForbidden();
    $this->actingAs($user)->post('/assets', ($this->payload)())->assertForbidden();
    expect(Asset::count())->toBe(0);
});

it('validates asset fields', function (array $overrides, string $field) {
    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)($overrides))
        ->assertSessionHasErrors($field);
    expect(Asset::count())->toBe(0);
})->with([
    'top-level kategori' => [['category_id' => 'KATEGORI'], 'category_id'],
    'bad kode_barang' => [['kode_barang' => 'AC-001'], 'kode_barang'],
    'nilai_buku above perolehan' => [['nilai_buku' => 6000000], 'nilai_buku'],
    'future tanggal' => [['tanggal_perolehan' => '2999-01-01'], 'tanggal_perolehan'],
    'unknown kondisi' => [['kondisi' => 'lumayan'], 'kondisi'],
    'missing nama' => [['nama_aset' => ''], 'nama_aset'],
]);

it('rejects a top-level kategori id', function () {
    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)(['category_id' => $this->kategori->id]))
        ->assertSessionHasErrors('category_id');
});

it('rejects a duplicate no_dokumen', function () {
    Asset::factory()->create(['no_dokumen' => 'M#GW04A268636-378-2023-0001', 'category_id' => $this->sub->id, 'unit_id' => $this->kel->id]);

    $this->actingAs($this->adminKel)->post('/assets', ($this->payload)())
        ->assertSessionHasErrors('no_dokumen');
});

it('rejects non-images, oversized photos and more than 10 photos', function () {
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => [UploadedFile::fake()->create('scan.pdf', 100, 'application/pdf')]])
        ->assertSessionHasErrors('photos.0');
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => [jpg('besar.jpg', 6000)]])
        ->assertSessionHasErrors('photos.0');
    $this->actingAs($this->adminKel)->post('/assets', [...($this->payload)(), 'photos' => array_map(fn ($i) => jpg("f{$i}.jpg", 10), range(1, 11))])
        ->assertSessionHasErrors('photos');

    expect(Asset::count())->toBe(0);
});

it('edits descriptive fields and ignores kondisi and unit', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id, 'kondisi' => 'baik']);

    $this->actingAs($this->adminKel)->get("/assets/{$asset->id}/edit")
        ->assertInertia(fn (Assert $page) => $page->component('Assets/Edit')->where('asset.id', $asset->id));

    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", [
        ...($this->payload)(['nama_aset' => 'AC Split 1 PK', 'no_dokumen' => null]),
        'kondisi' => 'hilang',
        'unit_id' => $this->kec->id,
        'photos' => [jpg()],
    ])->assertRedirect("/assets/{$asset->id}");

    $asset->refresh();
    expect($asset->nama_aset)->toBe('AC Split 1 PK')
        ->and($asset->kondisi)->toBe(Kondisi::Baik)
        ->and($asset->unit_id)->toBe($this->kel->id)
        ->and($asset->photos()->count())->toBe(1);
});

it('keeps an asset under 10 photos across edits', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    foreach (range(1, 9) as $i) {
        $asset->photos()->create(['path' => "assets/{$asset->id}/{$i}.jpg"]);
    }

    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", [...($this->payload)(['no_dokumen' => null]), 'photos' => [jpg('a.jpg'), jpg('b.jpg')]])
        ->assertSessionHasErrors('photos');

    expect($asset->photos()->count())->toBe(9);
});

it('forbids editing an asset of another unit', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);

    $this->actingAs($this->adminKel)->get("/assets/{$asset->id}/edit")->assertForbidden();
    $this->actingAs($this->adminKel)->put("/assets/{$asset->id}", ($this->payload)(['no_dokumen' => null]))->assertForbidden();
});

it('deletes a photo only through its own asset', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    $other = Asset::factory()->create(['unit_id' => $this->kel->id, 'category_id' => $this->sub->id]);
    Storage::disk('public')->put("assets/{$asset->id}/a.jpg", 'x');
    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    $this->actingAs($this->adminKel)->delete("/assets/{$other->id}/photos/{$photo->id}")->assertNotFound();

    $this->actingAs($this->adminKel)->delete("/assets/{$asset->id}/photos/{$photo->id}")->assertSessionHas('success');

    Storage::disk('public')->assertMissing("assets/{$asset->id}/a.jpg");
    expect($asset->photos()->count())->toBe(0);
});

it('forbids deleting a photo of another unit asset', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->sub->id]);
    $photo = $asset->photos()->create(['path' => "assets/{$asset->id}/a.jpg"]);

    $this->actingAs($this->adminKel)->delete("/assets/{$asset->id}/photos/{$photo->id}")->assertForbidden();
});
