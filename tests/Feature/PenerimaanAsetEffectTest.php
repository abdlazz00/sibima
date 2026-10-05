<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);

    $this->service = app(ApprovalWorkflowService::class);
});

function makeBeritaAcaraForEffectTest(object $test, int $jumlahUnit = 3): BeritaAcaraPenerimaan
{
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/042/VIII/2025',
        'tanggal_penerimaan' => '2025-08-05',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/042/VIII/2025',
        'vendor' => 'PT. Daikin Indonesia',
        'unit_id' => $test->kec->id,
        'created_by' => $test->admin->id,
        'status' => 'submitted',
    ]);

    $ba->items()->create([
        'nama_aset' => 'AC Split Daikin 1.5PK',
        'merk_type' => 'FTXM35 Inverter',
        'category_id' => $test->category->id,
        'jumlah_unit' => $jumlahUnit,
        'nilai_per_unit' => 5500000,
        'kondisi_awal' => 'baik',
    ]);

    return $ba;
}

it('creates one Asset per unit with the same kode_barang and sequential nomor_register on final approval', function () {
    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 3);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $assets = Asset::where('category_id', $this->category->id)->orderBy('nomor_register')->get();

    expect($assets)->toHaveCount(3)
        ->and($assets->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.05.02.04.001'])
        ->and($assets->pluck('nomor_register')->all())->toBe([1, 2, 3])
        ->and($assets[0]->no_dokumen)->toBe('BA/042/VIII/2025-001')
        ->and($assets[1]->no_dokumen)->toBe('BA/042/VIII/2025-002')
        ->and($assets[2]->no_dokumen)->toBe('BA/042/VIII/2025-003');

    expect($ba->items->first()->fresh()->asset_ids)->toBe($assets->pluck('id')->all());
});

it('reuses existing kode_barang and continues nomor_register sequence for matching asset name in same category', function () {
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'AC Split Daikin 1.5PK',
    ]);
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 2,
        'nama_aset' => 'AC Split Daikin 1.5PK',
    ]);

    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 2);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $newAssets = Asset::where('category_id', $this->category->id)
        ->whereNotIn('nomor_register', [1, 2])
        ->orderBy('nomor_register')
        ->get();

    expect($newAssets)->toHaveCount(2)
        ->and($newAssets->pluck('kode_barang')->all())->toBe(['1.3.2.05.02.04.001', '1.3.2.05.02.04.001'])
        ->and($newAssets->pluck('nomor_register')->all())->toBe([3, 4]);
});

it('generates distinct kode_barang for different asset items in the same category', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/042/MULTI/2025',
        'tanggal_penerimaan' => '2025-08-05',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/042/MULTI/2025',
        'vendor' => 'PT. Vendor',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'submitted',
    ]);

    $ba->items()->create([
        'nama_aset' => 'AC Split Daikin',
        'merk_type' => 'FTXM35',
        'category_id' => $this->category->id,
        'jumlah_unit' => 2,
        'nilai_per_unit' => 5000000,
        'kondisi_awal' => 'baik',
    ]);

    $ba->items()->create([
        'nama_aset' => 'Kulkas Showcase',
        'merk_type' => 'Polytron',
        'category_id' => $this->category->id,
        'jumlah_unit' => 2,
        'nilai_per_unit' => 3000000,
        'kondisi_awal' => 'baik',
    ]);

    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $acAssets = Asset::where('nama_aset', 'AC Split Daikin')->orderBy('nomor_register')->get();
    $kulkasAssets = Asset::where('nama_aset', 'Kulkas Showcase')->orderBy('nomor_register')->get();

    expect($acAssets)->toHaveCount(2)
        ->and($acAssets->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.05.02.04.001'])
        ->and($acAssets->pluck('nomor_register')->all())->toBe([1, 2]);

    expect($kulkasAssets)->toHaveCount(2)
        ->and($kulkasAssets->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.05.02.04.002'])
        ->and($kulkasAssets->pluck('nomor_register')->all())->toBe([1, 2]);
});

it('continues the sequence from existing assets under the same category code for new item', function () {
    Asset::factory()->create(['category_id' => $this->category->id, 'kode_barang' => '1.3.2.05.02.04.005', 'nama_aset' => 'Barang Lama']);

    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 1);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    expect(Asset::where('kode_barang', '1.3.2.05.02.04.006')->exists())->toBeTrue();
});

it('fails the final approval clearly when the category has no BMD code', function () {
    $this->category->update(['code' => null]);
    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 1);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);

    expect(fn () => $this->service->approve($request, $this->camat))
        ->toThrow(InvalidArgumentException::class);

    expect(Asset::where('category_id', $this->category->id)->count())->toBe(0);
});

it('gives every unit a distinct no_dokumen even when items span different categories', function () {
    $otherCategory = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/900/IX/2025',
        'tanggal_penerimaan' => '2025-08-05',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/900/IX/2025',
        'vendor' => 'PT. Test',
        'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id,
        'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'AC Split',
        'merk_type' => 'FTXM35',
        'category_id' => $this->category->id,
        'jumlah_unit' => 1,
        'nilai_per_unit' => 5500000,
        'kondisi_awal' => 'baik',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Komputer',
        'merk_type' => 'HP',
        'category_id' => $otherCategory->id,
        'jumlah_unit' => 1,
        'nilai_per_unit' => 8000000,
        'kondisi_awal' => 'baik',
    ]);

    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $noDokumens = Asset::whereIn('category_id', [$this->category->id, $otherCategory->id])->pluck('no_dokumen');
    expect($noDokumens->unique())->toHaveCount(2);
});

it('does not create any asset when rejected before the final step', function () {
    $ba = makeBeritaAcaraForEffectTest($this);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->reject($request, $this->kasubag, 'Dokumen tidak lengkap');

    expect(Asset::where('category_id', $this->category->id)->count())->toBe(0);
});
