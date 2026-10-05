<?php

use App\Models\Asset;
use App\Models\AssetCategory;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kasubag = userWithRole('kasubag');
    $this->category = AssetCategory::factory()->subcategory()->create();
});

function srtAsset(object $t, string $nama, array $o = []): Asset
{
    return Asset::factory()->create($o + ['nama_aset' => $nama, 'unit_id' => $t->kec->id, 'category_id' => $t->category->id]);
}

function srtNames(object $t, string $query = '', $user = null): array
{
    $names = [];

    $t->actingAs($user ?? $t->kasubag)->get('/assets'.$query)->assertOk()
        ->assertInertia(function ($page) use (&$names) {
            $names = collect($page->toArray()['props']['assets']['data'])->pluck('nama_aset')->all();
        });

    return $names;
}

it('sorts by name by default and descending, and ignores an unknown or hostile urut value', function () {
    foreach (['Meja', 'Lemari', 'Kursi'] as $nama) {
        srtAsset($this, $nama);
    }

    expect(srtNames($this))->toBe(['Kursi', 'Lemari', 'Meja'])
        ->and(srtNames($this, '?urut=ngawur'))->toBe(['Kursi', 'Lemari', 'Meja'])
        ->and(srtNames($this, '?urut=nama_aset;drop table assets'))->toBe(['Kursi', 'Lemari', 'Meja'])
        ->and(srtNames($this, '?urut='))->toBe(['Kursi', 'Lemari', 'Meja'])
        ->and(srtNames($this, '?urut=nama_desc'))->toBe(['Meja', 'Lemari', 'Kursi']);
});

it('sorts by date added, newest and oldest first', function () {
    srtAsset($this, 'Tengah', ['created_at' => '2026-03-01 08:00:00']);
    srtAsset($this, 'Lama', ['created_at' => '2026-01-01 08:00:00']);
    srtAsset($this, 'Baru', ['created_at' => '2026-05-01 08:00:00']);

    expect(srtNames($this, '?urut=terbaru'))->toBe(['Baru', 'Tengah', 'Lama'])
        ->and(srtNames($this, '?urut=terlama'))->toBe(['Lama', 'Tengah', 'Baru']);
});

it('keeps the date-added order stable when many assets share one created_at', function () {
    $same = '2026-04-01 09:00:00';
    foreach (['Pertama', 'Kedua', 'Ketiga'] as $nama) {
        srtAsset($this, $nama, ['created_at' => $same]);
    }

    expect(srtNames($this, '?urut=terbaru'))->toBe(['Ketiga', 'Kedua', 'Pertama'])
        ->and(srtNames($this, '?urut=terlama'))->toBe(['Pertama', 'Kedua', 'Ketiga']);
});

it('sorts by acquisition date and by acquisition value', function () {
    srtAsset($this, 'Murah Lama', ['tanggal_perolehan' => '2019-01-10', 'nilai_perolehan' => 1000000, 'nilai_buku' => 500000]);
    srtAsset($this, 'Mahal Baru', ['tanggal_perolehan' => '2025-02-20', 'nilai_perolehan' => 9000000, 'nilai_buku' => 8000000]);
    srtAsset($this, 'Sedang Tengah', ['tanggal_perolehan' => '2022-06-30', 'nilai_perolehan' => 4000000, 'nilai_buku' => 3000000]);

    expect(srtNames($this, '?urut=tahun_desc'))->toBe(['Mahal Baru', 'Sedang Tengah', 'Murah Lama'])
        ->and(srtNames($this, '?urut=tahun_asc'))->toBe(['Murah Lama', 'Sedang Tengah', 'Mahal Baru'])
        ->and(srtNames($this, '?urut=nilai_desc'))->toBe(['Mahal Baru', 'Sedang Tengah', 'Murah Lama'])
        ->and(srtNames($this, '?urut=nilai_asc'))->toBe(['Murah Lama', 'Sedang Tengah', 'Mahal Baru']);
});

it('sorts by kode BMD then register, independent of the name', function () {
    srtAsset($this, 'Z-Pertama', ['kode_barang' => '1.3.2.05.02.04.001', 'nomor_register' => 1]);
    srtAsset($this, 'A-Terakhir', ['kode_barang' => '1.3.2.05.02.04.009', 'nomor_register' => 1]);

    expect(srtNames($this, '?urut=kode'))->toBe(['Z-Pertama', 'A-Terakhir'])
        ->and(srtNames($this))->toBe(['A-Terakhir', 'Z-Pertama']);
});

it('keeps the order on the next page and together with other filters', function () {
    foreach (range(1, 16) as $i) {
        srtAsset($this, sprintf('Aset %02d', $i), ['created_at' => now()->subDays(20 - $i)]);
    }

    $this->actingAs($this->kasubag)->get('/assets?urut=terbaru')
        ->assertInertia(fn ($page) => $page
            ->where('filters.urut', 'terbaru')
            ->where('assets.next_page_url', fn ($url) => str_contains($url, 'urut=terbaru')));

    expect(srtNames($this, '?urut=terbaru&page=2'))->toBe(['Aset 01'])
        ->and(srtNames($this, '?urut=terbaru&search=Aset 1'))->toBe(['Aset 16', 'Aset 15', 'Aset 14', 'Aset 13', 'Aset 12', 'Aset 11', 'Aset 10']);
});

it('never widens the account scope, whatever the order', function () {
    srtAsset($this, 'Milik Kecamatan');
    srtAsset($this, 'Milik Kelurahan', ['unit_id' => $this->kel->id]);
    $adminKel = userWithRole('admin_kelurahan', $this->kel);

    foreach (['terbaru', 'terlama', 'nilai_desc', 'kode'] as $urut) {
        expect(srtNames($this, "?urut={$urut}", $adminKel))->toBe(['Milik Kelurahan']);
    }
});

it('sends the sort options to the page with the default first', function () {
    $this->actingAs($this->kasubag)->get('/assets')
        ->assertInertia(fn ($page) => $page
            ->has('sortOptions', 9)
            ->where('sortOptions.0', ['value' => 'nama_asc', 'label' => 'Nama A-Z'])
            ->where('sortOptions.2', ['value' => 'terbaru', 'label' => 'Terbaru ditambahkan']));
});
