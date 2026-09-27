<?php

use App\Enums\ApprovalStatus;
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

it('creates one Asset per unit with sequential kode_barang on final approval', function () {
    $ba = makeBeritaAcaraForEffectTest($this);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $codes = Asset::where('category_id', $this->category->id)->orderBy('kode_barang')->pluck('kode_barang');

    expect($codes->all())->toBe([
        '1.3.2.05.02.04.001',
        '1.3.2.05.02.04.002',
        '1.3.2.05.02.04.003',
    ]);

    $asset = Asset::where('kode_barang', '1.3.2.05.02.04.001')->firstOrFail();
    expect($asset->nama_aset)->toBe('AC Split Daikin 1.5PK')
        ->and($asset->unit_id)->toBe($this->kec->id)
        ->and($asset->no_dokumen)->toBe('BA/042/VIII/2025-001')
        ->and($asset->histories()->where('event', 'diterima')->exists())->toBeTrue();

    expect($ba->items->first()->fresh()->asset_ids)->toHaveCount(3);
});

it('continues the sequence from existing assets under the same category code', function () {
    Asset::factory()->create(['category_id' => $this->category->id, 'kode_barang' => '1.3.2.05.02.04.005']);

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
