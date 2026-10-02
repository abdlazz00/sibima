<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $parent = AssetCategory::create(['name' => 'Peralatan dan Mesin', 'code' => '02']);
    $this->category = AssetCategory::create([
        'name' => 'Peralatan',
        'code' => '02.06.01.02.001',
        'parent_id' => $parent->id,
    ]);

    $this->user = User::factory()->create(['unit_id' => $this->unit->id]);
    $this->user->assignRole('admin_kecamatan');

    $this->asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 99,
        'nama_aset' => 'Komputer Server',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 20000000,
        'nilai_buku' => 20000000,
    ]);
});

it('finds and displays asset summary by its qr_token', function () {
    $this->actingAs($this->user)
        ->get(route('scan.show', ['token' => $this->asset->qr_token]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Scan/Index')
            ->where('notFound', false)
            ->where('summary.nama_aset', 'Komputer Server')
            ->where('summary.nomor_register', '0099')
        );
});

it('returns 404 when token is not found or asset has been deleted', function () {
    $token = $this->asset->qr_token;
    $this->asset->delete();

    $this->actingAs($this->user)
        ->get(route('scan.show', ['token' => $token]))
        ->assertNotFound()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Scan/Index')
            ->where('notFound', true)
            ->where('summary', null)
        );
});

it('rejects old numeric id URLs via route pattern', function () {
    $this->actingAs($this->user)
        ->get('/scan/' . $this->asset->id)
        ->assertNotFound();
});
