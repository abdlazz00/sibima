<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\AssetReport;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\IOFactory;

function xlsxRows($response): array
{
    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $response->streamedContent());
    $rows = IOFactory::load($path)->getActiveSheet()->toArray(null, true, false, false);
    unlink($path);

    return $rows;
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);

    $this->a1 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nomor_register' => 7,
        'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004', 'nilai_perolehan' => 2000, 'nilai_buku' => 1500,
    ]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi', 'nilai_perolehan' => 1000, 'nilai_buku' => 500]);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B', 'nilai_perolehan' => 3000, 'nilai_buku' => 2500]);
});

it('downloads the asset list as an xlsx limited to scope, with text kept as text', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan/aset/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-aset-'.now()->format('Y-m-d').'.xlsx');

    $rows = xlsxRows($response);
    expect($rows[0][0])->toBe('Laporan Daftar Aset')
        ->and($rows[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($rows[2][0])->toBe('Filter: Tanpa filter')
        ->and($rows[3][0])->toStartWith('Dicetak: ')
        ->and($rows[5])->toContain('Kode Barang', 'No. Register', 'Nama Aset', 'Nilai Buku');

    $data = array_slice($rows, 6);
    expect($data)->toHaveCount(2);

    $heading = array_flip($rows[5]);
    $byName = collect($data)->keyBy(fn ($r) => $r[$heading['Nama Aset']]);
    expect($byName->has('=SUM(1+1)'))->toBeTrue()
        ->and($byName['=SUM(1+1)'][$heading['No. Register']])->toBe('0007')
        ->and($byName['=SUM(1+1)'][$heading['Kode Barang']])->toBe('1.3.2.05.02.04.004')
        ->and((float) $byName['=SUM(1+1)'][$heading['Nilai Buku']])->toBe(1500.0)
        ->and($byName['=SUM(1+1)'][$heading['Unit']])->toBe('Kelurahan A')
        ->and($byName->has('Meja B'))->toBeFalse();
});

it('labels the whole scope for kasubag and applies filters', function () {
    $rows = xlsxRows($this->actingAs($this->kasubag)->get('/laporan/aset/unduh?unit_id='.$this->kelB->id));

    expect($rows[1][0])->toBe('Cakupan: Kelurahan B')
        ->and(array_slice($rows, 6))->toHaveCount(1);

    $all = xlsxRows($this->actingAs($this->kasubag)->get('/laporan/aset/unduh'));
    expect($all[1][0])->toBe('Cakupan: Seluruh unit')
        ->and(array_slice($all, 6))->toHaveCount(3);
});

it('downloads the mutation history with its asset list and the damaged/lost report', function () {
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/0001', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kelA->id, 'tanggal_mutasi' => '2026-10-03', 'status' => 'pending',
        'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $mutation->id, 'asset_id' => $this->a2->id]);
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);

    $mut = xlsxRows($this->actingAs($this->adminA)->get('/laporan/mutasi/unduh'));
    $heading = array_flip($mut[5]);
    expect($mut[0][0])->toBe('Laporan Riwayat Mutasi')
        ->and(array_slice($mut, 6))->toHaveCount(1)
        ->and($mut[6][$heading['Nomor Mutasi']])->toBe('MUT/2026/0001')
        ->and($mut[6][$heading['Unit Tujuan']])->toBe('Kelurahan A')
        ->and((int) $mut[6][$heading['Jumlah Aset']])->toBe(1)
        ->and($mut[6][$heading['Daftar Aset']])->toContain($this->a2->kode_barang.' - Kursi');

    $rep = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh'));
    $heading = array_flip($rep[5]);
    expect($rep[0][0])->toBe('Laporan Aset Rusak dan Hilang')
        ->and(array_slice($rep, 6))->toHaveCount(1)
        ->and($rep[6][$heading['Nomor Laporan']])->toBe('LP/2026/0001')
        ->and($rep[6][$heading['Kronologi']])->toBe('Patah kaki');
});

it('refuses a unit out of scope, an unknown report and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/aset/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/mutasi/unduh')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan/aset/unduh?kondisi=hilang')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?kondisi=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/aset/unduh')->assertRedirect('/login');
});

it('shows the row count on the page and it equals the rows in the file', function () {
    $this->actingAs($this->camat)->get('/laporan?laporan=aset&category_id='.$this->alat->id)
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'aset')
            ->where('rowCount', 3)
            ->has('units', 3)
            ->has('categories', 1)
            ->has('kondisiOptions', 4));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/aset/unduh?category_id='.$this->alat->id));
    expect(array_slice($file, 6))->toHaveCount(3);

    $this->actingAs($this->adminA)->get('/laporan')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 2)->where('units', []));

    $this->actingAs($this->adminA)->get('/laporan?laporan=mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('laporan', 'mutasi')->where('rowCount', 0));
});
