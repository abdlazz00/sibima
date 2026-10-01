<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\User;
use App\Services\AssetRecapService;

function recapAsset(object $t, $unit, $category, string $kondisi, float $np, float $nb, string $tanggal): Asset
{
    return Asset::factory()->create([
        'unit_id' => $unit->id, 'category_id' => $category->id, 'kondisi' => $kondisi,
        'nilai_perolehan' => $np, 'nilai_buku' => $nb, 'tanggal_perolehan' => $tanggal,
    ]);
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->otherKec = makeKecamatan('Kecamatan Lain');

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->kursi = AssetCategory::create(['name' => 'KURSI', 'parent_id' => $this->alat->id]);
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);
    $this->perlengkapan = AssetCategory::create(['name' => 'PERLENGKAPAN']);
    $this->lain = AssetCategory::create(['name' => 'ALAT LAIN', 'parent_id' => $this->perlengkapan->id]);

    recapAsset($this, $this->kec, $this->meja, 'baik', 1000, 800, '2022-03-01');
    recapAsset($this, $this->kelA, $this->kursi, 'baik', 2000, 1500, '2022-07-15');
    recapAsset($this, $this->kelA, $this->laptop, 'rusak_berat', 3000, 1000, '2024-01-10');
    recapAsset($this, $this->kelB, $this->laptop, 'hilang', 500, 100, '2024-05-05');
    recapAsset($this, $this->otherKec, $this->meja, 'baik', 9000, 9000, '2023-02-02');
    recapAsset($this, $this->kelA, $this->lain, 'rusak_ringan', 400, 200, '2022-12-31');

    $this->camat = userWithRole('camat', $this->kec);
    $this->service = app(AssetRecapService::class);
});

it('summarises the camat scope without the other kecamatan', function () {
    $recap = $this->service->for($this->camat, []);

    expect($recap['ringkasan'])->toBe(['jumlah' => 5, 'nilai_perolehan' => 6900.0, 'nilai_buku' => 3600.0]);
});

it('gives each condition its count and percentage', function () {
    $kondisi = collect($this->service->for($this->camat, [])['kondisi']);

    expect($kondisi->pluck('kondisi')->all())->toBe(['baik', 'rusak_ringan', 'rusak_berat', 'hilang'])
        ->and($kondisi->pluck('jumlah')->all())->toBe([2, 1, 1, 1])
        ->and($kondisi->pluck('persen')->all())->toBe([40.0, 20.0, 20.0, 20.0])
        ->and($kondisi->first()['label'])->toBe('Baik')
        ->and(abs($kondisi->sum('persen') - 100.0))->toBeLessThanOrEqual(0.2);
});

it('builds the yearly trend with zero-filled gaps in ascending order', function () {
    $tren = $this->service->for($this->camat, [])['tren'];

    expect($tren)->toBe([
        ['tahun' => 2022, 'jumlah' => 3, 'nilai_perolehan' => 3400.0, 'nilai_buku' => 2500.0],
        ['tahun' => 2023, 'jumlah' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0],
        ['tahun' => 2024, 'jumlah' => 2, 'nilai_perolehan' => 3500.0, 'nilai_buku' => 1100.0],
    ]);
});

it('recaps by main category with its subcategories', function () {
    $recap = $this->service->for($this->camat, [])['rekap_kategori'];

    $grup = collect($recap['grup']);
    expect($grup->pluck('nama')->all())->toBe(['ALAT KANTOR', 'ELEKTRONIK', 'PERLENGKAPAN'])
        ->and($grup[0])->toBe([
            'id' => $this->alat->id, 'nama' => 'ALAT KANTOR', 'jumlah' => 2, 'nilai_perolehan' => 3000.0, 'nilai_buku' => 2300.0,
            'anak' => [
                ['id' => $this->kursi->id, 'nama' => 'KURSI', 'jumlah' => 1, 'nilai_perolehan' => 2000.0, 'nilai_buku' => 1500.0],
                ['id' => $this->meja->id, 'nama' => 'MEJA', 'jumlah' => 1, 'nilai_perolehan' => 1000.0, 'nilai_buku' => 800.0],
            ],
        ])
        ->and(collect($grup[2]['anak'])->pluck('nama')->all())->toBe(['ALAT LAIN'])
        ->and($grup[2]['jumlah'])->toBe(1)
        ->and($recap['total'])->toBe(['jumlah' => 5, 'nilai_perolehan' => 6900.0, 'nilai_buku' => 3600.0]);
});

it('recaps by unit for a multi-unit scope', function () {
    $recap = $this->service->for($this->camat, [])['rekap_unit'];

    expect(collect($recap['baris'])->pluck('nama')->all())->toBe([$this->kec->name, 'Kelurahan A', 'Kelurahan B'])
        ->and(collect($recap['baris'])->pluck('jumlah')->all())->toBe([1, 3, 1])
        ->and($recap['baris'][1]['nilai_perolehan'])->toBe(5400.0)
        ->and($recap['total'])->toBe(['jumlah' => 5, 'nilai_perolehan' => 6900.0, 'nilai_buku' => 3600.0]);
});

it('has no unit recap for a single-unit user and limits everything to that unit', function () {
    $recap = $this->service->for(userWithRole('admin_kelurahan', $this->kelA), []);

    expect($recap['rekap_unit'])->toBeNull()
        ->and($recap['ringkasan']['jumlah'])->toBe(3)
        ->and($recap['ringkasan']['nilai_perolehan'])->toBe(5400.0);
});

it('applies the unit, category and kondisi filters and keeps every total in agreement', function () {
    $unit = $this->service->for($this->camat, ['unit_id' => $this->kelA->id]);
    expect($unit['ringkasan']['jumlah'])->toBe(3)
        ->and(collect($unit['rekap_unit']['baris'])->pluck('nama')->all())->toBe(['Kelurahan A']);

    $category = $this->service->for($this->camat, ['category_id' => $this->alat->id]);
    expect($category['ringkasan']['jumlah'])->toBe(2);

    $kondisi = $this->service->for($this->camat, ['kondisi' => 'baik']);
    expect($kondisi['ringkasan']['jumlah'])->toBe(2)
        ->and(collect($kondisi['kondisi'])->pluck('persen')->all())->toBe([100.0, 0.0, 0.0, 0.0]);

    foreach ([$unit, $category, $kondisi, $this->service->for($this->camat, [])] as $r) {
        expect($r['rekap_kategori']['total'])->toBe($r['ringkasan'])
            ->and(collect($r['tren'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah'])
            ->and(collect($r['tren'])->sum('nilai_perolehan'))->toBe($r['ringkasan']['nilai_perolehan'])
            ->and(collect($r['kondisi'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah']);
        if ($r['rekap_unit'] !== null) {
            expect($r['rekap_unit']['total'])->toBe($r['ringkasan']);
        }
    }
});

it('returns zeros and empty lists when nothing matches', function () {
    $recap = $this->service->for(User::factory()->create(), []);

    expect($recap['ringkasan'])->toBe(['jumlah' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0])
        ->and(collect($recap['kondisi'])->pluck('persen')->all())->toBe([0.0, 0.0, 0.0, 0.0])
        ->and($recap['tren'])->toBe([])
        ->and($recap['rekap_kategori'])->toBe(['grup' => [], 'total' => ['jumlah' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0]])
        ->and($recap['rekap_unit'])->toBeNull();
});

it('does not zero-fill an absurd span of years caused by a mistyped acquisition year', function () {
    recapAsset($this, $this->kelA, $this->meja, 'baik', 100, 50, '0202-05-05');

    $tren = $this->service->for($this->camat, [])['tren'];

    expect(collect($tren)->pluck('tahun')->all())->toBe([202, 2022, 2024])
        ->and(collect($tren)->sum('jumlah'))->toBe(6);
});
