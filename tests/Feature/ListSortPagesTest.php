<?php

use App\Models\Asset;
use App\Models\AssetReport;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->asset = Asset::factory()->create(['unit_id' => $this->kec->id]);
});

function lsIds(object $t, string $url, string $prop = 'items'): array
{
    $ids = [];

    $t->actingAs($t->kasubag)->get($url)->assertOk()
        ->assertInertia(function ($page) use (&$ids, $prop) {
            $ids = collect($page->toArray()['props'][$prop]['data'])->pluck('id')->all();
        });

    return $ids;
}

function lsReport(object $t, string $tanggal): AssetReport
{
    return AssetReport::factory()->create(['asset_id' => $t->asset->id, 'unit_id' => $t->kec->id, 'tanggal_kejadian' => $tanggal]);
}

it('sorts Lapor Rusak/Hilang newest first by default, oldest first on request, stable on equal dates', function () {
    $a = lsReport($this, '2026-01-10');
    $b = lsReport($this, '2026-03-10');
    $c = lsReport($this, '2026-03-10');
    $d = lsReport($this, '2026-02-10');

    $newest = [$c->id, $b->id, $d->id, $a->id];

    expect(lsIds($this, '/asset-reports'))->toBe($newest)
        ->and(lsIds($this, '/asset-reports?urut=terbaru'))->toBe($newest)
        ->and(lsIds($this, '/asset-reports?urut=terlama'))->toBe([$a->id, $d->id, $b->id, $c->id])
        ->and(lsIds($this, '/asset-reports?urut=ngawur'))->toBe($newest)
        ->and(lsIds($this, '/asset-reports?urut[]=terlama'))->toBe($newest);
});

it('keeps urut on the next page of Lapor Rusak/Hilang and sends the sort options', function () {
    foreach (range(1, 16) as $i) {
        lsReport($this, now()->subDays(20 - $i)->toDateString());
    }

    $this->actingAs($this->kasubag)->get('/asset-reports?urut=terlama')
        ->assertInertia(fn ($page) => $page
            ->where('filters.urut', 'terlama')
            ->has('sortOptions', 2)
            ->where('sortOptions.0', ['value' => 'terbaru', 'label' => 'Terbaru'])
            ->where('items.next_page_url', fn ($url) => str_contains($url, 'urut=terlama')));

    expect(lsIds($this, '/asset-reports?urut=terlama&page=2'))->toHaveCount(1);
});
