<?php

use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\AssetRequest;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Pegawai;

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

it('sorts Permohonan Aset by id, newest first by default and oldest first on request', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $ids = [];
    foreach (range(1, 3) as $i) {
        $ids[] = AssetRequest::factory()->create(['pegawai_id' => $pegawai->id, 'unit_id' => $this->kec->id])->id;
    }

    expect(lsIds($this, '/asset-requests'))->toBe(array_reverse($ids))
        ->and(lsIds($this, '/asset-requests?urut=terlama'))->toBe($ids)
        ->and(lsIds($this, '/asset-requests?urut=ngawur'))->toBe(array_reverse($ids));
});

it('keeps urut on the next page of Permohonan Aset and sends the sort options', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    foreach (range(1, 16) as $i) {
        AssetRequest::factory()->create(['pegawai_id' => $pegawai->id, 'unit_id' => $this->kec->id]);
    }

    $this->actingAs($this->kasubag)->get('/asset-requests?urut=terlama')
        ->assertInertia(fn ($page) => $page
            ->where('filters.urut', 'terlama')
            ->has('sortOptions', 2)
            ->where('items.next_page_url', fn ($url) => str_contains($url, 'urut=terlama')));
});

function lsBa(object $t, string $tanggal, string $nomor): BeritaAcaraPenerimaan
{
    return BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $nomor, 'tanggal_penerimaan' => $tanggal, 'sumber_perolehan' => 'APBD', 'no_kontrak_spk' => 'SPK/1', 'vendor' => 'PT Contoh',
        'unit_id' => $t->kec->id, 'created_by' => $t->kasubag->id, 'status' => 'submitted',
    ]);
}

it('sorts Penerimaan Aset newest first by default, oldest first on request, stable on equal dates', function () {
    $a = lsBa($this, '2026-01-10', 'BA/1');
    $b = lsBa($this, '2026-03-10', 'BA/2');
    $c = lsBa($this, '2026-03-10', 'BA/3');
    $d = lsBa($this, '2026-02-10', 'BA/4');

    $newest = [$c->id, $b->id, $d->id, $a->id];

    expect(lsIds($this, '/penerimaan-aset'))->toBe($newest)
        ->and(lsIds($this, '/penerimaan-aset?urut=terlama'))->toBe([$a->id, $d->id, $b->id, $c->id])
        ->and(lsIds($this, '/penerimaan-aset?urut=ngawur'))->toBe($newest);
});

it('keeps urut on the next page of Penerimaan Aset and sends the sort options', function () {
    foreach (range(1, 16) as $i) {
        lsBa($this, now()->subDays(20 - $i)->toDateString(), "BA/P{$i}");
    }

    $this->actingAs($this->kasubag)->get('/penerimaan-aset?urut=terlama')
        ->assertInertia(fn ($page) => $page
            ->where('filters.urut', 'terlama')
            ->has('sortOptions', 2)
            ->where('items.next_page_url', fn ($url) => str_contains($url, 'urut=terlama')));
});
