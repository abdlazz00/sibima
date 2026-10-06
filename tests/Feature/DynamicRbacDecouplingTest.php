<?php

use App\Enums\BeritaAcaraStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\User;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    (new \Database\Seeders\RoleSeeder)->run();
    (new \Database\Seeders\PermissionSeeder)->run();
    (new WorkflowDefinitionSeeder)->run();
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Decoupled');
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.99']);
});

test('role kustom kelurahan dengan permohonan.create dapat mengajukan permohonan unit tanpa role hardcode', function () {
    $role = Role::create(['name' => 'staf_kelurahan_mandiri', 'guard_name' => 'web']);
    $role->givePermissionTo(['permohonan.create', 'permohonan.view', 'laporan.mutasi']);

    $user = userWithRole('staf_kelurahan_mandiri', $this->kel);

    $response = $this->actingAs($user)->post(route('asset-requests.store'), [
        'jenis' => 'unit',
        'category_id' => $this->category->id,
        'jumlah' => 3,
        'keterangan' => 'Kebutuhan operasional mandiri kelurahan',
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('asset_requests', [
        'unit_id' => $this->kel->id,
        'jumlah' => 3,
    ]);
});

test('role kustom hanya dapat mengakses laporan sesuai permission spesifik yang diberikan', function () {
    $role = Role::create(['name' => 'analis_mutasi', 'guard_name' => 'web']);
    $role->givePermissionTo(['laporan.mutasi']);

    $user = userWithRole('analis_mutasi', $this->kel);

    // Boleh akses laporan mutasi
    $this->actingAs($user)->get(route('laporan-mutasi.index'))->assertOk();

    // Ditolak akses laporan aset & rusak-hilang
    $this->actingAs($user)->get(route('laporan-aset.index'))->assertForbidden();
    $this->actingAs($user)->get(route('laporan-rusak-hilang.index'))->assertForbidden();
});

test('role kustom tanpa aset.print-label ditolak saat mencetak label aset', function () {
    $role = Role::create(['name' => 'staf_inventaris_view', 'guard_name' => 'web']);
    $role->givePermissionTo(['aset.view']);

    $user = userWithRole('staf_inventaris_view', $this->kel);
    $asset = Asset::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs($user)
        ->get('/assets/labels?'.http_build_query(['ids' => [$asset->id], 'size' => 'kecil']))
        ->assertForbidden();
});

test('role kustom dengan penerimaan.create dapat mengelola draft penerimaan unitnya', function () {
    $role = Role::create(['name' => 'petugas_ba_kelurahan', 'guard_name' => 'web']);
    $role->givePermissionTo(['penerimaan.view', 'penerimaan.create']);

    $user = userWithRole('petugas_ba_kelurahan', $this->kel);

    $draft = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/DECOUPLED/001',
        'tanggal_penerimaan' => '2026-10-06',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/DEC/01',
        'unit_id' => $this->kel->id,
        'created_by' => $user->id,
        'status' => BeritaAcaraStatus::Draft,
    ]);

    $response = $this->actingAs($user)->get(route('penerimaan-aset.index'));
    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page->has('items.data', 1));
});
