<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Services\ReportQuery;

function rqMutation(string $no, $origin, $dest, string $date, string $status, $creator): AssetMutation
{
    return AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $origin->id === $dest->id ? 'internal' : 'kec_ke_kel',
        'origin_unit_id' => $origin->id, 'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $creator->id,
    ]);
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
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);

    $this->aKec = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik']);
    $this->aA1 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik']);
    $this->aA2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->laptop->id, 'kondisi' => 'rusak_berat']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->laptop->id, 'kondisi' => 'baik']);

    $this->m1 = rqMutation('M1', $this->kec, $this->kelA, '2026-10-01', 'pending', $this->camat);
    $this->m2 = rqMutation('M2', $this->kec, $this->kelB, '2026-10-05', 'approved', $this->camat);
    $this->m3 = rqMutation('M3', $this->kelB, $this->kelB, '2026-10-10', 'pending', $this->camat);

    $this->r1 = AssetReport::factory()->create(['asset_id' => $this->aA1->id, 'unit_id' => $this->kelA->id, 'jenis' => 'rusak', 'tanggal_kejadian' => '2026-10-02', 'status' => 'pending']);
    $this->r2 = AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'tanggal_kejadian' => '2026-10-06', 'status' => 'approved']);
    $this->r3 = AssetReport::factory()->create(['asset_id' => $this->aKec->id, 'unit_id' => $this->kec->id, 'jenis' => 'rusak', 'tanggal_kejadian' => '2026-10-09', 'status' => 'pending']);
});

function rq(object $t, $user, string $kind, array $filters = []): array
{
    return (new ReportQuery($user))->build($kind, $filters)->pluck('id')->sort()->values()->all();
}

it('limits the asset list to scope and filters by unit, parent category and kondisi', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->kasubag, 'aset'))->toBe($ids($this->aKec, $this->aA1, $this->aA2, $this->aB))
        ->and(rq($this, $this->camat, 'aset'))->toBe($ids($this->aKec, $this->aA1, $this->aA2, $this->aB))
        ->and(rq($this, $this->adminA, 'aset'))->toBe($ids($this->aA1, $this->aA2))
        ->and(rq($this, $this->camat, 'aset', ['unit_id' => $this->kelB->id]))->toBe($ids($this->aB))
        ->and(rq($this, $this->camat, 'aset', ['category_id' => $this->alat->id]))->toBe($ids($this->aKec, $this->aA1))
        ->and(rq($this, $this->camat, 'aset', ['category_id' => $this->laptop->id]))->toBe($ids($this->aA2, $this->aB))
        ->and(rq($this, $this->camat, 'aset', ['kondisi' => 'rusak_berat']))->toBe($ids($this->aA2));
});

it('includes a mutation when either side is in scope and filters by unit, status and inclusive dates', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->camat, 'mutasi'))->toBe($ids($this->m1, $this->m2, $this->m3))
        ->and(rq($this, $this->adminA, 'mutasi'))->toBe($ids($this->m1))
        ->and(rq($this, $this->camat, 'mutasi', ['asal_id' => $this->kec->id]))->toBe($ids($this->m1, $this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['tujuan_id' => $this->kelB->id]))->toBe($ids($this->m2, $this->m3))
        ->and(rq($this, $this->camat, 'mutasi', ['asal_id' => $this->kelB->id, 'tujuan_id' => $this->kelB->id]))->toBe($ids($this->m3))
        ->and(rq($this, $this->camat, 'mutasi', ['jenis_mutasi' => 'internal']))->toBe($ids($this->m3))
        ->and(rq($this, $this->adminA, 'mutasi', ['asal_id' => $this->kelB->id]))->toBe([])
        ->and(rq($this, $this->camat, 'mutasi', ['status' => 'approved']))->toBe($ids($this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['dari' => '2026-10-05', 'sampai' => '2026-10-05']))->toBe($ids($this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['dari' => '2026-10-02']))->toBe($ids($this->m2, $this->m3));
});

it('limits damaged/lost reports to scope and filters by jenis, status and inclusive dates', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->camat, 'rusak-hilang'))->toBe($ids($this->r1, $this->r2, $this->r3))
        ->and(rq($this, $this->adminA, 'rusak-hilang'))->toBe($ids($this->r1))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['jenis' => 'hilang']))->toBe($ids($this->r2))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['kondisi' => 'hilang']))->toBe($ids($this->r2))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['category_id' => $this->elektronik->id]))->toBe($ids($this->r2))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['status' => 'pending']))->toBe($ids($this->r1, $this->r3))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['unit_id' => $this->kec->id]))->toBe($ids($this->r3))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['dari' => '2026-10-06', 'sampai' => '2026-10-09']))->toBe($ids($this->r2, $this->r3));
});

it('can join rusak-hilang with assets without ambiguous columns', function () {
    $count = (new ReportQuery($this->camat))
        ->build('rusak-hilang', ['status' => 'approved', 'kondisi' => 'hilang', 'unit_id' => $this->kelB->id])
        ->reorder()
        ->toBase()
        ->join('assets as a', 'a.id', '=', 'asset_reports.asset_id')
        ->count();

    expect($count)->toBe(1);
});

it('ignores filters that do not belong to the report kind', function () {
    expect(rq($this, $this->camat, 'mutasi', ['kondisi' => 'hilang', 'category_id' => 1]))->toHaveCount(3);
});

it('shows nothing to a user without a unit or role', function () {
    $nobody = App\Models\User::factory()->create();

    expect(rq($this, $nobody, 'aset'))->toBe([])
        ->and(rq($this, $nobody, 'mutasi'))->toBe([])
        ->and(rq($this, $nobody, 'rusak-hilang'))->toBe([]);
});

it('can be joined with assets without ambiguous columns', function () {
    $count = (new ReportQuery($this->camat))
        ->build('mutasi', ['status' => 'approved', 'dari' => '2026-10-01', 'asal_id' => $this->kec->id])
        ->reorder()
        ->toBase()
        ->join('asset_mutation_items as mi', 'mi.asset_mutation_id', '=', 'asset_mutations.id')
        ->join('assets as ma', 'ma.id', '=', 'mi.asset_id')
        ->count();

    expect($count)->toBe(0);
});
