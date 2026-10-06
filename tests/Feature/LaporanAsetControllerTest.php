<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);

    $this->holder = Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'nama' => 'Budi Santoso']);
    $this->a1 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja A', 'nomor_register' => 7,
        'nilai_perolehan' => 5000, 'nilai_buku' => 4000, 'tanggal_perolehan' => '2021-02-03', 'current_holder_id' => $this->holder->id,
        'sumber_perolehan' => 'Pembelian', 'no_dokumen' => 'DOK-9', 'keterangan' => 'Catatan A',
    ]);
    $this->a2 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B',
        'nilai_perolehan' => 9000, 'nilai_buku' => 7000, 'tanggal_perolehan' => '2023-06-07',
    ]);
    $this->aOther = Asset::factory()->create([
        'unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Lain',
        'nilai_perolehan' => 100, 'nilai_buku' => 50, 'tanggal_perolehan' => '2020-01-01',
    ]);
});

it('renders the page with recap, list rows and filter options for the camat', function () {
    $this->actingAs($this->camat)->get('/laporan-aset')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('LaporanAset/Index')
            ->where('ringkasan.jumlah', 3)
            ->where('asets.total', 3)
            ->has('kondisi', 4)
            ->has('tren')
            ->has('rekap_kategori.grup')
            ->where('rekap_unit.total.jumlah', 3)
            ->has('units', 3)
            ->has('categories', 1)
            ->has('kondisiOptions', 4)
            ->where('sort', ['urut' => 'kode_barang', 'arah' => 'asc']));
});

it('gives a list row its columns and the detail block', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset?urut=nama_aset')
        ->assertInertia(fn (Assert $p) => $p
            ->where('asets.data.0', fn ($row) => $row['id'] === $this->a1->id
                && $row['nomor_register'] === '0007'
                && $row['kategori'] === 'ALAT KANTOR'
                && $row['subkategori'] === 'MEJA'
                && $row['unit'] === 'Kelurahan A'
                && $row['tahun_perolehan'] === '2021'
                && $row['kondisi'] === $this->a1->kondisi->value
                && $row['nilai_perolehan'] == 5000
                && $row['detail']['pemegang'] === 'Budi Santoso'
                && $row['detail']['no_dokumen'] === 'DOK-9'
                && $row['detail']['sumber_perolehan'] === 'Pembelian'
                && $row['detail']['keterangan'] === 'Catatan A'));
});

it('limits a single-unit user to the own unit and hides the unit recap and the unit filter', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p
            ->where('ringkasan.jumlah', 2)
            ->where('asets.total', 2)
            ->where('rekap_unit', null)
            ->where('units', []));
});

it('paginates 25 rows per page', function () {
    Asset::factory()->count(28)->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id]);

    $this->actingAs($this->adminA)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 30)->has('asets.data', 25)->where('asets.last_page', 2));
    $this->actingAs($this->adminA)->get('/laporan-aset?page=2')
        ->assertInertia(fn (Assert $p) => $p->has('asets.data', 5));
});

it('sorts by a whitelisted column and refuses anything else', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset?urut=nilai_perolehan&arah=desc')
        ->assertInertia(fn (Assert $p) => $p
            ->where('asets.data.0.id', $this->a2->id)
            ->where('sort', ['urut' => 'nilai_perolehan', 'arah' => 'desc']));

    $this->actingAs($this->adminA)->getJson('/laporan-aset?urut=password')->assertUnprocessable()->assertJsonValidationErrors('urut');
    $this->actingAs($this->adminA)->getJson('/laporan-aset?urut=nama_aset;drop table assets')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan-aset?arah=sideways')->assertUnprocessable()->assertJsonValidationErrors('arah');
});

it('applies filters and refuses a unit out of scope', function () {
    $this->actingAs($this->camat)->get('/laporan-aset?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 1)->where('ringkasan.jumlah', 1));

    $this->actingAs($this->adminA)->getJson('/laporan-aset?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->adminA)->getJson('/laporan-aset/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
});

it('keeps the page row count equal to the summary and handles an empty result', function () {
    $this->actingAs($this->kasubag)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 3)->where('ringkasan.jumlah', 3));

    $this->actingAs($this->kasubag)->get('/laporan-aset?kondisi=hilang')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 0)->where('ringkasan.jumlah', 0)->where('tren', []));
});

it('downloads the workbook and refuses an empty download', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan-aset/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-aset-'.now()->format('Y-m-d').'.xlsx');

    $this->actingAs($this->adminA)->getJson('/laporan-aset/unduh?kondisi=hilang')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan-aset')->assertRedirect('/login');
    $this->get('/laporan-aset/unduh')->assertRedirect('/login');
});

it('forbids a user without laporan.aset permission from accessing laporan aset', function () {
    $role = \Spatie\Permission\Models\Role::create(['name' => 'pegawai_tanpa_laporan', 'guard_name' => 'web']);
    $user = userWithRole('pegawai_tanpa_laporan', $this->kelA);

    $this->actingAs($user)->get('/laporan-aset')->assertForbidden();
    $this->actingAs($user)->get('/laporan-aset/unduh')->assertForbidden();
});

