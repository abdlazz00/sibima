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

    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B']);
});

it('downloads the mutation history with its asset list and the damaged/lost report', function () {
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/0001', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kelA->id, 'tanggal_mutasi' => '2026-10-03', 'status' => 'pending',
        'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $mutation->id, 'asset_id' => $this->a2->id]);
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);

    $response = $this->actingAs($this->adminA)->get('/laporan/mutasi/unduh');
    expect($response->headers->get('content-disposition'))->toContain('laporan-mutasi-'.now()->format('Y-m-d').'.xlsx');

    $mut = xlsxRows($response);
    $heading = array_flip($mut[5]);
    expect($mut[0][0])->toBe('Laporan Riwayat Mutasi')
        ->and($mut[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($mut[2][0])->toBe('Filter: Tanpa filter')
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

it('labels filters with their readable names in the file header', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'status' => 'approved']);

    $rows = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh?jenis=hilang&status=approved'));

    expect($rows[2][0])->toBe('Filter: Jenis: Hilang; Status: Disetujui');
});

it('refuses a unit out of scope, an unknown report, the retired aset report and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/aset/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/mutasi/unduh')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?jenis=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=aset')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/mutasi/unduh')->assertRedirect('/login');
});

it('defaults to the mutation report, shows the row count and it equals the rows in the file', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/1']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2']);

    $this->actingAs($this->camat)->get('/laporan')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'mutasi')
            ->where('rowCount', 0)
            ->has('units', 3)
            ->missing('categories')
            ->missing('kondisiOptions'));

    $this->actingAs($this->camat)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('laporan', 'rusak-hilang')->where('rowCount', 2));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/rusak-hilang/unduh'));
    expect(array_slice($file, 6))->toHaveCount(2);

    $this->actingAs($this->adminA)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 1)->where('units', []));
});
