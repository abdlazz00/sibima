<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\ImportBatch;
use App\Models\Pegawai;
use App\Services\ImportService;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;

function impSheetRows($response): array
{
    $path = tempnam(sys_get_temp_dir(), 'exp').'.xlsx';
    file_put_contents($path, $response->streamedContent());

    return IOFactory::load($path)->getSheetByName('Data')->toArray(null, true, false, false);
}

beforeEach(function () {
    Storage::fake('local');
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->kasubag = impUser('kasubag', null, ['export-aset', 'export-pegawai', 'export-kategori', 'import-aset', 'import-pegawai', 'import-kategori']);
});

it('forbids exporting without the permission and returns 404 for unknown modules', function () {
    $this->actingAs(userWithRole('lurah', $this->kelA))->get(route('export', 'kategori'))->assertForbidden();
    $this->actingAs($this->kasubag)->get('/export/lainnya')->assertNotFound();
});

it('redirects guests to login', function () {
    $this->get(route('export', 'aset'))->assertRedirect('/login');
});

it('exports kategori with the template header', function () {
    $rows = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'kategori')));

    expect($rows[0])->toBe(ImportService::importer('kategori')->headers())
        ->and($rows[1][0])->toBe('ALAT KANTOR')
        ->and($rows[1][2])->toBe('MEJA');
});

it('exports only assets in the account scope and honours the list filters', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Kerja', 'kondisi' => 'baik']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Rusak', 'kondisi' => 'rusak_berat']);
    Asset::factory()->create(['unit_id' => makeKelurahan($this->kec, 'Kelurahan B')->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Luar']);
    $admin = impUser('admin_kelurahan', $this->kelA, ['export-aset']);

    $all = impSheetRows($this->actingAs($admin)->get(route('export', 'aset')));
    $filtered = impSheetRows($this->actingAs($admin)->get(route('export', ['modul' => 'aset', 'kondisi' => 'rusak_berat'])));

    expect(array_column($all, 2))->toBe(['Nama Aset', 'Meja Kerja', 'Meja Rusak'])
        ->and(array_column($filtered, 2))->toBe(['Nama Aset', 'Meja Rusak']);
});

it('refuses to export more rows than the limit with a clear message', function () {
    config(['import.export_max' => 1]);
    AssetCategory::create(['name' => 'LAIN']);

    $this->actingAs($this->kasubag)->from('/asset-categories')->get(route('export', 'kategori'))
        ->assertRedirect('/asset-categories')->assertSessionHas('error');
});

it('keeps formula-looking values as text in the export', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => '=SUM(1+1)']);

    $rows = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'aset')));

    expect($rows[1][2])->toBe('=SUM(1+1)');
});

it('round-trips: exported kategori, pegawai and aset import back into an empty database', function () {
    $user = $this->kasubag;
    Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '1.3.2.05.02.04.004',
        'nomor_register' => 7, 'nama_aset' => 'Meja Kerja', 'tanggal_perolehan' => '2023-06-14',
        'nilai_perolehan' => 1000000, 'nilai_buku' => 800000, 'kondisi' => 'baik', 'no_dokumen' => 'DOC-1',
    ]);
    Pegawai::create(['nama' => 'Budi', 'nip' => '198001012005011001', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    $exports = [];
    foreach (['kategori', 'pegawai', 'aset'] as $modul) {
        $exports[$modul] = impSheetRows($this->actingAs($user)->get(route('export', $modul)));
    }

    Asset::query()->delete();
    Pegawai::query()->delete();
    AssetCategory::query()->whereNotNull('parent_id')->delete();
    AssetCategory::query()->delete();

    foreach (['kategori', 'pegawai', 'aset'] as $modul) {
        $headers = array_shift($exports[$modul]);
        $batch = app(ImportService::class)->upload($modul, impXlsx($headers, $exports[$modul]), $user)->refresh();

        expect($batch->jumlah_baru)->toBe(1, "modul {$modul}")
            ->and($batch->jumlah_error)->toBe(0, "modul {$modul}");
        app(ImportService::class)->confirm($batch);
    }

    $asset = Asset::firstOrFail();

    expect($asset->nama_aset)->toBe('Meja Kerja')
        ->and($asset->nomor_register)->toBe(7)
        ->and($asset->tanggal_perolehan->toDateString())->toBe('2023-06-14')
        ->and((float) $asset->nilai_buku)->toBe(800000.0)
        ->and(Pegawai::first()->nip)->toBe('198001012005011001')
        ->and(AssetCategory::count())->toBe(2)
        ->and(ImportBatch::where('status', ImportBatch::SELESAI)->count())->toBe(3);
});

it('exports assets in the order chosen on the list', function () {
    foreach (['Meja Tengah' => '2026-03-01 08:00:00', 'Meja Lama' => '2026-01-01 08:00:00', 'Meja Baru' => '2026-05-01 08:00:00'] as $nama => $dibuat) {
        Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'nama_aset' => $nama, 'created_at' => $dibuat]);
    }

    $default = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'aset')));
    $terbaru = impSheetRows($this->actingAs($this->kasubag)->get(route('export', ['modul' => 'aset', 'urut' => 'terbaru'])));

    expect(array_column($default, 2))->toBe(['Nama Aset', 'Meja Baru', 'Meja Lama', 'Meja Tengah'])
        ->and(array_column($terbaru, 2))->toBe(['Nama Aset', 'Meja Baru', 'Meja Tengah', 'Meja Lama']);
});
