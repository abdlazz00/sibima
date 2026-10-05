# Pengurutan Data Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna dapat mengurutkan halaman Data Aset lewat dropdown "Urutkan" (tanggal ditambahkan, nama, tahun perolehan, nilai, kode BMD), dan ekspor Excel mengikuti urutan itu.

**Architecture:** Satu daftar kunci urutan `Asset::SORTS` menjadi sumber tunggal untuk query dan dropdown. `EloquentAssetRepository::queryVisibleTo` menerapkan urutan dari `$filters['urut']` (nilai tak dikenal jatuh ke default). Controller halaman dan ekspor sama-sama meneruskan `urut`; frontend menambah satu `<select>` yang memanggil `applyFilters` yang sudah ada.

**Tech Stack:** Laravel 13, Pest (SQLite `:memory:`), Inertia + React/TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-05-pengurutan-data-aset-design.md`

## Global Constraints

- Parameter query bernama `urut`, bernilai salah satu dari 9 kunci: `nama_asc` (default), `nama_desc`, `terbaru`, `terlama`, `tahun_desc`, `tahun_asc`, `nilai_desc`, `nilai_asc`, `kode`.
- Nilai `urut` yang tidak dikenal atau kosong memakai `nama_asc` tanpa error; tidak pernah dimasukkan ke SQL sebagai nama kolom.
- Setiap urutan selain default dan `kode` diakhiri `id` (arah sama) agar hasil stabil.
- Tanpa migrasi, tanpa permission baru, tanpa `FormRequest` baru.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude**, jangan push.
- Jangan menguji lewat browser kecuali pengguna memerintahkan; frontend diverifikasi dengan `npx tsc --noEmit` dan `npm run build`.
- Nama fungsi helper Pest harus unik antar berkas; helper baru berawalan `srt`.
- Edit berkas PHP bernamespace dengan alat Edit; skrip TSX tanpa backslash boleh lewat Python dari berkas.
- `php artisan test` penuh lebih dari 2 menit: jalankan di latar belakang atau pakai `--filter`.

## Review Focus

Kondisi yang tersirat di spec tetapi tidak disebut tegas, urut dari yang paling mungkin terjadi pada pengguna:

1. **Banyak aset dengan `created_at` sama (hasil impor Excel):** urutan "terbaru" harus stabil (id sebagai pembeda). Diuji di Task 1.
2. **Pindah ke halaman 2 atau menggabung filter:** urutan tidak boleh hilang. Diuji di Task 1.
3. **Nilai `urut` ngawur di URL (termasuk yang mirip nama kolom atau SQL):** jatuh ke default, tidak error. Diuji di Task 1.
4. **Ekspor dari halaman yang sudah diurutkan:** isi Excel mengikuti urutan yang dipilih. Diuji di Task 1.
5. **Pengguna unit terbatas:** pengurutan tidak membuka aset di luar cakupannya. Diuji di Task 1.

---

## File Structure

| Berkas | Perubahan |
|---|---|
| `app/Models/Asset.php` | Konstanta `SORTS`, `sortOrder()`, `sortOptions()`. |
| `app/Repositories/EloquentAssetRepository.php` | `queryVisibleTo` memakai urutan dari `urut`. |
| `app/Http/Controllers/AssetController.php` | `urut` ke `filters`, kirim `sortOptions`. |
| `app/Http/Controllers/ExportController.php` | `urut` ke daftar filter ekspor. |
| `resources/js/Pages/Assets/Index.tsx` | Tipe, props, dan satu `<select>` "Urutkan". |
| `tests/Feature/AssetSortTest.php` | Pengujian baru (halaman). |
| `tests/Feature/ExportTest.php` | Satu test ekspor mengikuti urutan. |

---

### Task 1: Backend pengurutan (model, repositori, controller, ekspor)

**Files:**
- Create: `tests/Feature/AssetSortTest.php`
- Modify: `tests/Feature/ExportTest.php` (tambah satu test di akhir), `app/Models/Asset.php`, `app/Repositories/EloquentAssetRepository.php`, `app/Http/Controllers/AssetController.php:34-41`, `app/Http/Controllers/ExportController.php:19`

**Interfaces:**
- Produces: `Asset::SORTS` (kunci => `['label' => string, 'order' => list<[kolom, arah]>]`); `Asset::sortOrder(?string $key): array` (kembali ke default bila kunci tak dikenal); `Asset::sortOptions(): array` (`[{value, label}]`, 9 item, `nama_asc` pertama); `queryVisibleTo(User, array $filters)` membaca `$filters['urut']`; prop halaman `sortOptions` dan `filters.urut`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/AssetSortTest.php`:

```php
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
```

Tambahkan di akhir `tests/Feature/ExportTest.php`:

```php

it('exports assets in the order chosen on the list', function () {
    foreach (['Meja Tengah' => '2026-03-01 08:00:00', 'Meja Lama' => '2026-01-01 08:00:00', 'Meja Baru' => '2026-05-01 08:00:00'] as $nama => $dibuat) {
        Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'nama_aset' => $nama, 'created_at' => $dibuat]);
    }

    $default = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'aset')));
    $terbaru = impSheetRows($this->actingAs($this->kasubag)->get(route('export', ['modul' => 'aset', 'urut' => 'terbaru'])));

    expect(array_column($default, 2))->toBe(['Nama Aset', 'Meja Baru', 'Meja Lama', 'Meja Tengah'])
        ->and(array_column($terbaru, 2))->toBe(['Nama Aset', 'Meja Baru', 'Meja Tengah', 'Meja Lama']);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter="AssetSortTest|exports assets in the order chosen"`
Expected: FAIL (urutan masih tetap dan `sortOptions` belum ada).

- [ ] **Step 3: Implementasi**

`app/Models/Asset.php` (alat Edit): tepat sebelum `    protected function casts(): array` tambahkan:

```php
    /** Urutan Data Aset: kunci => label dan urutan kolom. `id` menjadi pembeda terakhir agar hasil stabil. */
    public const SORTS = [
        'nama_asc' => ['label' => 'Nama A-Z', 'order' => [['nama_aset', 'asc'], ['kode_barang', 'asc'], ['nomor_register', 'asc']]],
        'nama_desc' => ['label' => 'Nama Z-A', 'order' => [['nama_aset', 'desc'], ['kode_barang', 'asc'], ['nomor_register', 'asc']]],
        'terbaru' => ['label' => 'Terbaru ditambahkan', 'order' => [['created_at', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama ditambahkan', 'order' => [['created_at', 'asc'], ['id', 'asc']]],
        'tahun_desc' => ['label' => 'Tahun perolehan terbaru', 'order' => [['tanggal_perolehan', 'desc'], ['id', 'desc']]],
        'tahun_asc' => ['label' => 'Tahun perolehan terlama', 'order' => [['tanggal_perolehan', 'asc'], ['id', 'asc']]],
        'nilai_desc' => ['label' => 'Nilai perolehan tertinggi', 'order' => [['nilai_perolehan', 'desc'], ['id', 'desc']]],
        'nilai_asc' => ['label' => 'Nilai perolehan terendah', 'order' => [['nilai_perolehan', 'asc'], ['id', 'asc']]],
        'kode' => ['label' => 'Kode BMD', 'order' => [['kode_barang', 'asc'], ['nomor_register', 'asc']]],
    ];

    /** @return list<array{0: string, 1: string}> */
    public static function sortOrder(?string $key): array
    {
        return (self::SORTS[$key ?? ''] ?? self::SORTS['nama_asc'])['order'];
    }

    /** @return list<array{value: string, label: string}> */
    public static function sortOptions(): array
    {
        return array_map(
            fn (string $key) => ['value' => $key, 'label' => self::SORTS[$key]['label']],
            array_keys(self::SORTS),
        );
    }

```

`app/Repositories/EloquentAssetRepository.php` (alat Edit), di `queryVisibleTo`:
1. ganti `        return Asset::query()
            ->visibleTo($user)` dengan `        $query = Asset::query()
            ->visibleTo($user)`.
2. ganti

```php
            ->when($filters['kondisi'] ?? null, fn (Builder $query, $kondisi) => $query->where('kondisi', $kondisi))
            ->orderBy('nama_aset')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register');
    }
```

dengan:

```php
            ->when($filters['kondisi'] ?? null, fn (Builder $query, $kondisi) => $query->where('kondisi', $kondisi));

        foreach (Asset::sortOrder($filters['urut'] ?? null) as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        return $query;
    }
```

`app/Http/Controllers/AssetController.php`:
- `$filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi']);` menjadi `$filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi', 'urut']);`
- tepat setelah baris `'units' => $this->units->accessibleBy($request->user()),` tambahkan `'sortOptions' => Asset::sortOptions(),`.

`app/Http/Controllers/ExportController.php:19`: `$request->only(['search', 'category_id', 'unit_id', 'kondisi'])` menjadi `$request->only(['search', 'category_id', 'unit_id', 'kondisi', 'urut'])`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="AssetSortTest|ExportTest|AssetBrowseTest|AssetManageTest|ImportExport"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Models/Asset.php app/Repositories/EloquentAssetRepository.php app/Http/Controllers/AssetController.php app/Http/Controllers/ExportController.php tests/Feature/AssetSortTest.php tests/Feature/ExportTest.php
git commit -m "feat(assets): sort the asset list and its export by date added, name, year, value or code"
```

---

### Task 2: Dropdown "Urutkan" di halaman Data Aset dan verifikasi akhir

**Files:**
- Modify: `resources/js/Pages/Assets/Index.tsx`

**Interfaces:**
- Consumes: prop `sortOptions: {value, label}[]` dan `filters.urut` (Task 1).
- Produces: `<select aria-label="Urutkan">` di bar filter yang memanggil `applyFilters({ urut })`.

- [ ] **Step 1: Skrip edit frontend**

Simpan dengan alat Write ke `C:/Users/ABDULA~1/AppData/Local/Temp/claude/C--Users-abdulaziz-Documents-pribadi-SIBIMA/b39db684-e281-401f-8853-ec1e845ccf18/scratchpad/srt_front.py`, lalu jalankan dari root repo:

```python
def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:70], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


SELECT = """
                        <div className="relative min-w-[210px]">
                            <select
                                aria-label="Urutkan"
                                value={filters.urut ?? 'nama_asc'}
                                onChange={(e) => applyFilters({ urut: e.target.value === 'nama_asc' ? undefined : e.target.value })}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                {sortOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        Urutkan: {o.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
"""

edit('resources/js/Pages/Assets/Index.tsx', [
    ("    unit_id?: string;\n    kondisi?: string;\n}", "    unit_id?: string;\n    kondisi?: string;\n    urut?: string;\n}"),
    ("    kondisiOptions: Option[];\n    can: { create: boolean };", "    kondisiOptions: Option[];\n    sortOptions: Option[];\n    can: { create: boolean };"),
    ("export default function Index({ assets, filters, categories, units, kondisiOptions, can }: IndexProps) {",
     "export default function Index({ assets, filters, categories, units, kondisiOptions, sortOptions, can }: IndexProps) {"),
    ("                        </div>\n                    </div>\n                </div>\n\n                {/* Data Table */}",
     "                        </div>\n" + SELECT + "                    </div>\n                </div>\n\n                {/* Data Table */}"),
])
print('ok')
```

- [ ] **Step 2: Verifikasi frontend**

Run: `python <path skrip>` lalu `npx tsc --noEmit` lalu `npm run build`
Expected: skrip mencetak `ok` (semua `assert` lolos), `tsc` tanpa error, build sukses. Bila `tsc` mengeluh tipe `Option`, itu sudah dideklarasikan di berkas yang sama (`interface Option`).

- [ ] **Step 3: Suite penuh**

Run (latar belakang): `php artisan test`
Expected: seluruh suite hijau (baseline 622 + test baru). Perbaiki regresi sebelum lanjut.

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Assets/Index.tsx
git commit -m "feat(assets): urutkan dropdown in the asset list filter bar"
```
