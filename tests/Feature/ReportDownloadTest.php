<?php

use App\Models\Asset;
use App\Models\AssetCategory;
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

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);

    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B']);
});

it('downloads the damaged/lost report limited to the user scope', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2026/0002']);

    $response = $this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh');
    expect($response->headers->get('content-disposition'))->toContain('laporan-rusak-hilang-'.now()->format('Y-m-d').'.xlsx');

    $rep = xlsxRows($response);
    $heading = array_flip($rep[5]);
    expect($rep[0][0])->toBe('Laporan Aset Rusak dan Hilang')
        ->and($rep[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($rep[2][0])->toBe('Filter: Tanpa filter')
        ->and(array_slice($rep, 6))->toHaveCount(1)
        ->and($rep[6][$heading['Nomor Laporan']])->toBe('LP/2026/0001')
        ->and($rep[6][$heading['Kronologi']])->toBe('Patah kaki');
});

it('labels filters with their readable names in the file header', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'status' => 'approved']);

    $rows = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh?jenis=hilang&status=approved'));

    expect($rows[2][0])->toBe('Filter: Jenis: Hilang; Status: Disetujui');
});

it('refuses a unit out of scope, retired or unknown reports and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/aset/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/mutasi/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?jenis=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=aset')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=mutasi')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/rusak-hilang/unduh')->assertRedirect('/login');
});

it('defaults to the damaged/lost report and its row count equals the rows in the file', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/1']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2']);

    $this->actingAs($this->camat)->get('/laporan')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'rusak-hilang')
            ->where('rowCount', 2)
            ->has('units', 3)
            ->missing('categories')
            ->missing('kondisiOptions'));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/rusak-hilang/unduh'));
    expect(array_slice($file, 6))->toHaveCount(2);

    $this->actingAs($this->adminA)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 1)->where('units', []));
});
