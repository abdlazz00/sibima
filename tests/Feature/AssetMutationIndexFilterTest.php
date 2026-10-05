<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan Sungai Binti');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->kasubag = userWithRole('kasubag');
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->category = AssetCategory::factory()->subcategory()->create();
});

function lsMutation(object $t, string $nomor, string $tanggal, string $jenis = 'kec_ke_kel', $dest = null, array $assetNames = ['Laptop']): AssetMutation
{
    $dest ??= $t->kelA;
    $mutation = AssetMutation::create([
        'nomor_mutasi' => $nomor, 'jenis_mutasi' => $jenis, 'origin_unit_id' => $t->kec->id,
        'destination_unit_id' => $dest->id, 'tanggal_mutasi' => $tanggal, 'status' => 'pending', 'created_by' => $t->kasubag->id,
    ]);

    foreach ($assetNames as $nama) {
        $asset = Asset::factory()->create(['nama_aset' => $nama, 'unit_id' => $t->kec->id, 'category_id' => $t->category->id]);
        $mutation->items()->create(['asset_id' => $asset->id]);
    }

    return $mutation;
}

function lsMutIds(object $t, string $query = '', $user = null): array
{
    $ids = [];

    $t->actingAs($user ?? $t->kasubag)->get('/asset-mutations'.$query)->assertOk()
        ->assertInertia(function ($page) use (&$ids) {
            $ids = collect($page->toArray()['props']['mutations']['data'])->pluck('id')->all();
        });

    return $ids;
}

it('searches by nomor mutasi, asset name, and unit name', function () {
    $a = lsMutation($this, 'MUT/001', '2026-01-10', 'kec_ke_kel', $this->kelA, ['Proyektor']);
    $b = lsMutation($this, 'MUT/002', '2026-02-10', 'kec_ke_kel', $this->kelB, ['Meja Rapat']);

    expect(lsMutIds($this, '?search=MUT/001'))->toBe([$a->id])
        ->and(lsMutIds($this, '?search=Meja'))->toBe([$b->id])
        ->and(lsMutIds($this, '?search=Tembesi'))->toBe([$b->id])
        ->and(lsMutIds($this, '?search=tidak-ada'))->toBe([]);
});

it('does not duplicate a mutation whose several items match the search', function () {
    $m = lsMutation($this, 'MUT/010', '2026-01-10', 'kec_ke_kel', $this->kelA, ['Kursi Lipat', 'Kursi Rapat', 'Kursi Tamu']);

    expect(lsMutIds($this, '?search=Kursi'))->toBe([$m->id]);
});

it('filters by jenis and combines it with the search', function () {
    $x = lsMutation($this, 'MUT/020', '2026-01-10', 'kec_ke_kel', $this->kelA, ['Laptop']);
    $y = lsMutation($this, 'MUT/021', '2026-02-10', 'internal', $this->kec, ['Laptop']);

    expect(lsMutIds($this, '?jenis=internal'))->toBe([$y->id])
        ->and(lsMutIds($this, '?jenis=kec_ke_kel&search=Laptop'))->toBe([$x->id])
        ->and(lsMutIds($this, '?jenis=internal&search=MUT/020'))->toBe([]);
});

it('never lets search or jenis widen the unit scope', function () {
    $mine = lsMutation($this, 'MUT/030', '2026-01-10', 'kec_ke_kel', $this->kelA, ['Printer']);
    lsMutation($this, 'MUT/031', '2026-02-10', 'kec_ke_kel', $this->kelB, ['Printer']);

    expect(lsMutIds($this, '?search=Printer', $this->adminKelA))->toBe([$mine->id])
        ->and(lsMutIds($this, '?jenis=kec_ke_kel', $this->adminKelA))->toBe([$mine->id]);
});

it('sorts newest first by default and oldest first on request, stable on equal dates', function () {
    $a = lsMutation($this, 'MUT/041', '2026-01-10');
    $b = lsMutation($this, 'MUT/042', '2026-03-10');
    $c = lsMutation($this, 'MUT/043', '2026-03-10');
    $d = lsMutation($this, 'MUT/044', '2026-02-10');

    $newest = [$c->id, $b->id, $d->id, $a->id];

    expect(lsMutIds($this))->toBe($newest)
        ->and(lsMutIds($this, '?urut=terlama'))->toBe([$a->id, $d->id, $b->id, $c->id])
        ->and(lsMutIds($this, '?urut=ngawur'))->toBe($newest);
});

it('keeps search, jenis and urut on the next page and sends filters and sort options', function () {
    foreach (range(1, 16) as $i) {
        lsMutation($this, "MUT/P{$i}", now()->subDays(20 - $i)->toDateString(), 'kec_ke_kel', $this->kelA, ['Genset']);
    }

    $this->actingAs($this->kasubag)->get('/asset-mutations?search=Genset&jenis=kec_ke_kel&urut=terlama')
        ->assertInertia(fn ($page) => $page
            ->where('filters', ['search' => 'Genset', 'jenis' => 'kec_ke_kel', 'urut' => 'terlama'])
            ->has('sortOptions', 2)
            ->where('mutations.next_page_url', fn ($url) => str_contains($url, 'urut=terlama') && str_contains($url, 'search=Genset') && str_contains($url, 'jenis=kec_ke_kel')));

    expect(lsMutIds($this, '?search=Genset&jenis=kec_ke_kel&urut=terlama&page=2'))->toHaveCount(1);
});
