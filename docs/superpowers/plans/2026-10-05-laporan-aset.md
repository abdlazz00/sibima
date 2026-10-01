# Laporan Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Laporan Aset" page (`/laporan-aset`) under a new sidebar group LAPORAN: summary, condition donut and yearly-acquisition bar chart (Chart.js), category and unit recaps, a sortable paginated detail table, and a five-sheet Excel download with an official letterhead — all limited to the user's unit scope.

**Architecture:** `ReportQuery::build('aset', …)` stays the single source of scope + filters. `AssetRecapService` aggregates it (summary, condition %, yearly trend, category/unit recap). `LaporanAsetController` renders the page (recap + paginated list) and streams the workbook built by `AssetRecapWorkbook` on top of a small `ReportSheetWriter` (letterhead + table helper). The old tabbed `/laporan` page stops serving "aset" and keeps mutasi / rusak-hilang until their own redesign.

**Tech Stack:** Laravel 13, Inertia 2 + React 18 + TypeScript, Tailwind v3, Pest 5, `phpoffice/phpspreadsheet` (installed), new npm packages `chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels`.

**Spec:** `docs/superpowers/specs/2026-10-05-laporan-aset-design.md`

## Global Constraints

- Scope is always `User::accessibleUnitIds()` through `ReportQuery` (`null` = all units; `[]` = nothing). `unit_id` outside scope: HTTP 422 (`ReportRequest`). Never aggregate outside `ReportQuery`.
- Filters: `unit_id`, `category_id` (a parent category includes its subcategories), `kondisi`. Sorting: `urut` ∈ `kode_barang|nomor_register|nama_aset|tanggal_perolehan|kondisi|nilai_perolehan|nilai_buku` (default `kode_barang`), `arah` ∈ `asc|desc` (default `asc`); anything else 422. Page size 25.
- Aggregates must run on SQLite (tests) and MySQL: only `COUNT`, `SUM`, `COALESCE`, `GROUP BY`; the year is derived in PHP from `GROUP BY tanggal_perolehan`.
- Service output keys (exact): `ringkasan {jumlah, nilai_perolehan, nilai_buku}`; `kondisi [{kondisi,label,jumlah,persen}]` (four entries, `Kondisi` enum order, persen rounded to 1 decimal, `0.0` when empty); `tren [{tahun,jumlah,nilai_perolehan,nilai_buku}]` ascending, gaps filled with zeros; `rekap_kategori {grup:[{id,nama,jumlah,nilai_perolehan,nilai_buku,anak:[{id,nama,jumlah,nilai_perolehan,nilai_buku}]}], total{jumlah,nilai_perolehan,nilai_buku}}`; `rekap_unit` = `null` when the scope has one unit (or none) else `{baris:[{id,nama,jumlah,nilai_perolehan,nilai_buku}], total{…}}`. All totals for the same filters are equal. Money values are floats.
- Excel: file `laporan-aset-{Y-m-d}.xlsx`; sheets `Ringkasan`, `Daftar Rinci`, `Rekap Kategori`, `Rekap Unit` (omitted when `rekap_unit` is null), `Tren Tahunan`; tables only, no charts. Every sheet starts with the letterhead: logo `public/images/lambang-kota-batam.png` at A1, `PEMERINTAH KOTA BATAM` / `KECAMATAN SAGULUNG` / sheet title in B1:B3 (merged across), then `Cakupan:` (A5), `Filter:` (A6), `Dicetak:` (A7); the table header is row 9. **Every text cell is written as an explicit string** (keeps `0007`, numeric-looking `kode_barang`, and prevents formula injection); money/count `#,##0`, percent `0.0`, year `0`, date `dd/mm/yyyy`.
- A download with zero rows is 422. Page row count (`asets.total`) equals the Daftar Rinci data rows and `ringkasan.jumlah`.
- UI: `AuthenticatedLayout`, Bahasa Indonesia, cards `rounded-lg border border-slate-200 bg-white` without shadow, badges `rounded` (4px), numbers `tabular-nums`, semantic status colours from `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` §2.3; charts via Chart.js (datalabels plugin passed per chart, not registered globally). Do NOT use `role="tablist"`/`role="tab"` anywhere (Preline's `autoInit()` hijacks them and crashes the layout).
- Sidebar: new group `LAPORAN` between `TRANSAKSI` and `PENGATURAN`; the obsolete `ALAT BANTU` group (two disabled placeholders) is removed; the `Laporan` item leaves `UTAMA`.
- PHP ^8.3, MySQL in dev/prod, SQLite `:memory:` in tests. No JS test runner: frontend is verified by `tsc` and `npm run build`. **Do NOT test in the browser** — the project owner will request manual UI checks later; the manual-verification steps are skipped and ledgered.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution) line. Stage files by explicit path (never `git add docs` / `git add .`): the untracked `docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx` must stay out of commits.**

**Rulings made while planning:**
- Service output uses nested keys `rekap_kategori.grup/total` and `rekap_unit.baris/total` (spec §4.1 listed them loosely).
- Percent per condition is rounded to one decimal, so the four values may sum to 99.8–100.2; tests use a ±0.2 tolerance (spec said "berjumlah 100").
- The new `ReportSheetWriter` also owns `scopeLabel()`/`filterLabel()`; the old `ReportExporter` delegates to it (Task 4), which also fixes the deferred minor "xlsx filter line prints raw enum values".

## Review Focus

- **Totals must agree everywhere** for the same filters: `ringkasan`, category recap total, unit recap total, trend total, Excel totals, `asets.total`. → Tasks 1, 2, 3.
- **Scope leaks**: another unit's numbers never appear for any role; `unit_id` outside scope is 422; single-unit users get `rekap_unit = null` and no `Rekap Unit` sheet. → Tasks 1, 2, 3.
- **Sorting is whitelisted**: a crafted `urut`/`arah` is 422 and can never reach SQL. → Task 3.
- **Empty data** (no assets in scope/filter): service returns zeros without division errors, charts get empty arrays, download is 422. → Tasks 1, 3, 6.
- **Excel text integrity and letterhead on every sheet** including `0007` and a name starting with `=`. → Task 2.
- **The old tabbed page no longer serves "aset"** while mutasi and rusak-hilang keep working. → Task 4.

## File Structure

| File | Responsibility |
|---|---|
| `app/Services/AssetRecapService.php` (new) | all recap aggregates from `ReportQuery` |
| `app/Services/ReportSheetWriter.php` (new) | letterhead, table writer, scope/filter labels |
| `app/Services/AssetRecapWorkbook.php` (new) | five-sheet Excel download |
| `app/Http/Controllers/LaporanAsetController.php` (new), `routes/web.php`, `app/Http/Requests/ReportRequest.php` | page + download + sort validation |
| `app/Http/Controllers/ReportController.php`, `app/Services/ReportExporter.php`, `resources/js/Pages/Report/Index.tsx` | retire "aset" from the old tabbed page |
| `resources/js/lib/format.ts`, `types/index.d.ts`, `Components/Charts/{TrenAsetChart,KondisiChart}.tsx`, `config/navigation.ts`, `Pages/Dashboard.tsx` | frontend foundations, menu |
| `resources/js/Pages/LaporanAset/Index.tsx` | the page |

---

## Task 1: `AssetRecapService`

**Files:**
- Create: `app/Services/AssetRecapService.php`
- Test: `tests/Feature/AssetRecapServiceTest.php`

**Interfaces:**
- Consumes: `ReportQuery::build('aset', array $filters): Illuminate\Database\Eloquent\Builder`, `User::accessibleUnitIds(): ?array`.
- Produces: `AssetRecapService::for(User $user, array $filters): array` with the exact keys in Global Constraints.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRecapServiceTest.php`:

```php
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
    $this->lain = AssetCategory::create(['name' => 'LAIN-LAIN']);

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

it('recaps by main category with subcategories, treating a category without parent as main', function () {
    $recap = $this->service->for($this->camat, [])['rekap_kategori'];

    $grup = collect($recap['grup']);
    expect($grup->pluck('nama')->all())->toBe(['ALAT KANTOR', 'ELEKTRONIK', 'LAIN-LAIN'])
        ->and($grup[0])->toBe([
            'id' => $this->alat->id, 'nama' => 'ALAT KANTOR', 'jumlah' => 2, 'nilai_perolehan' => 3000.0, 'nilai_buku' => 2300.0,
            'anak' => [
                ['id' => $this->kursi->id, 'nama' => 'KURSI', 'jumlah' => 1, 'nilai_perolehan' => 2000.0, 'nilai_buku' => 1500.0],
                ['id' => $this->meja->id, 'nama' => 'MEJA', 'jumlah' => 1, 'nilai_perolehan' => 1000.0, 'nilai_buku' => 800.0],
            ],
        ])
        ->and($grup[2]['anak'])->toBe([])
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRecapServiceTest.php`
Expected: FAIL (`Target class [App\Services\AssetRecapService] does not exist`).

- [ ] **Step 3: Implement**

`app/Services/AssetRecapService.php`:

```php
<?php

namespace App\Services;

use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;

class AssetRecapService
{
    private const SUMS = 'COUNT(*) as jumlah, COALESCE(SUM(nilai_perolehan), 0) as nilai_perolehan, COALESCE(SUM(nilai_buku), 0) as nilai_buku';

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function for(User $user, array $filters): array
    {
        $query = new ReportQuery($user);
        $base = fn () => $query->build('aset', $filters)->reorder()->toBase();

        $ringkasan = $this->zero();
        $perKondisi = [];
        foreach ($base()->selectRaw('kondisi, '.self::SUMS)->groupBy('kondisi')->get() as $row) {
            $perKondisi[$row->kondisi] = (int) $row->jumlah;
            $ringkasan = $this->add($ringkasan, $row);
        }

        return [
            'ringkasan' => $ringkasan,
            'kondisi' => $this->kondisi($perKondisi, $ringkasan['jumlah']),
            'tren' => $this->tren($base()->selectRaw('tanggal_perolehan, '.self::SUMS)->groupBy('tanggal_perolehan')->get()),
            'rekap_kategori' => $this->rekapKategori($base()->selectRaw('category_id, '.self::SUMS)->groupBy('category_id')->get()),
            'rekap_unit' => $this->rekapUnit($user, $base()->selectRaw('unit_id, '.self::SUMS)->groupBy('unit_id')->get()),
        ];
    }

    /** @return array{jumlah: int, nilai_perolehan: float, nilai_buku: float} */
    private function zero(): array
    {
        return ['jumlah' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0];
    }

    /**
     * @param  array{jumlah: int, nilai_perolehan: float, nilai_buku: float}  $total
     * @return array{jumlah: int, nilai_perolehan: float, nilai_buku: float}
     */
    private function add(array $total, object $row): array
    {
        return [
            'jumlah' => $total['jumlah'] + (int) $row->jumlah,
            'nilai_perolehan' => $total['nilai_perolehan'] + (float) $row->nilai_perolehan,
            'nilai_buku' => $total['nilai_buku'] + (float) $row->nilai_buku,
        ];
    }

    /**
     * @param  array<string, int>  $perKondisi
     * @return list<array{kondisi: string, label: string, jumlah: int, persen: float}>
     */
    private function kondisi(array $perKondisi, int $total): array
    {
        return array_map(function (Kondisi $kondisi) use ($perKondisi, $total) {
            $jumlah = $perKondisi[$kondisi->value] ?? 0;

            return [
                'kondisi' => $kondisi->value,
                'label' => $kondisi->label(),
                'jumlah' => $jumlah,
                'persen' => $total > 0 ? round($jumlah / $total * 100, 1) : 0.0,
            ];
        }, Kondisi::cases());
    }

    /** @return list<array{tahun: int, jumlah: int, nilai_perolehan: float, nilai_buku: float}> */
    private function tren($rows): array
    {
        $years = [];
        foreach ($rows as $row) {
            $year = (int) substr((string) $row->tanggal_perolehan, 0, 4);
            $years[$year] = $this->add($years[$year] ?? $this->zero(), $row);
        }

        if ($years === []) {
            return [];
        }

        $result = [];
        foreach (range(min(array_keys($years)), max(array_keys($years))) as $year) {
            $result[] = ['tahun' => $year] + ($years[$year] ?? $this->zero());
        }

        return $result;
    }

    /** @return array{grup: list<array<string, mixed>>, total: array<string, int|float>} */
    private function rekapKategori($rows): array
    {
        $categories = AssetCategory::query()->get(['id', 'name', 'parent_id'])->keyBy('id');
        $groups = [];
        $total = $this->zero();

        foreach ($rows as $row) {
            $category = $categories[$row->category_id];
            $main = $category->parent_id !== null ? $categories[$category->parent_id] : $category;

            $groups[$main->id] ??= ['id' => (int) $main->id, 'nama' => $main->name] + $this->zero() + ['anak' => []];
            $groups[$main->id] = array_merge($groups[$main->id], $this->add(
                ['jumlah' => $groups[$main->id]['jumlah'], 'nilai_perolehan' => $groups[$main->id]['nilai_perolehan'], 'nilai_buku' => $groups[$main->id]['nilai_buku']],
                $row,
            ));

            if ($category->parent_id !== null) {
                $groups[$main->id]['anak'][] = ['id' => (int) $category->id, 'nama' => $category->name]
                    + $this->add($this->zero(), $row);
            }

            $total = $this->add($total, $row);
        }

        foreach ($groups as &$group) {
            usort($group['anak'], fn ($a, $b) => strcmp($a['nama'], $b['nama']));
        }
        unset($group);

        $groups = array_values($groups);
        usort($groups, fn ($a, $b) => [$b['jumlah'], $a['nama']] <=> [$a['jumlah'], $b['nama']]);

        return ['grup' => $groups, 'total' => $total];
    }

    /** @return array{baris: list<array<string, mixed>>, total: array<string, int|float>}|null */
    private function rekapUnit(User $user, $rows): ?array
    {
        $ids = $user->accessibleUnitIds();

        if (($ids === null ? Unit::count() : count($ids)) <= 1) {
            return null;
        }

        $byUnit = collect($rows)->keyBy('unit_id');
        $total = $this->zero();
        $baris = [];

        foreach (Unit::whereIn('id', $byUnit->keys())->orderBy('type')->orderBy('name')->get() as $unit) {
            $row = $byUnit[$unit->id];
            $baris[] = ['id' => (int) $unit->id, 'nama' => $unit->name] + $this->add($this->zero(), $row);
            $total = $this->add($total, $row);
        }

        return ['baris' => $baris, 'total' => $total];
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/AssetRecapServiceTest.php`
Expected: PASS (8 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetRecapService.php tests/Feature/AssetRecapServiceTest.php
git commit -m "feat: add AssetRecapService for the Laporan Aset recap"
```

---

## Task 2: Letterhead/table writer and the five-sheet workbook

**Files:**
- Create: `app/Services/ReportSheetWriter.php`, `app/Services/AssetRecapWorkbook.php`
- Test: `tests/Feature/AssetRecapWorkbookTest.php`

**Interfaces:**
- Consumes: `AssetRecapService::for(...)` output (Task 1), `ReportQuery::build('aset', …)`.
- Produces: `ReportSheetWriter::kop(Worksheet $sheet, string $title, string $scope, string $filter, int $columns): int` (returns first free row = 9), `::table(Worksheet $sheet, int $headerRow, array $columns, array $rows, ?array $total = null, array $boldRows = [], bool $freeze = false): int` (columns `[heading, kind]`, kind ∈ `text|wrap|int|money|percent|year|date`; returns next free row), `::scopeLabel(User $user, array $filters): string`, `::filterLabel(array $filters): string`; `AssetRecapWorkbook::download(array $recap, Illuminate\Database\Eloquent\Builder $query, array $filters, User $user): StreamedResponse`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/AssetRecapWorkbookTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Services\AssetRecapService;
use App\Services\AssetRecapWorkbook;
use App\Services\ReportQuery;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

function wbBuild($user, array $filters = []): Spreadsheet
{
    $recap = app(AssetRecapService::class)->for($user, $filters);
    $query = (new ReportQuery($user))->build('aset', $filters);
    $response = app(AssetRecapWorkbook::class)->download($recap, $query, $filters, $user);

    ob_start();
    $response->sendContent();
    $content = ob_get_clean();

    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $content);
    $spreadsheet = IOFactory::load($path);
    unlink($path);

    return $spreadsheet;
}

function wbRows(Spreadsheet $spreadsheet, string $sheet): array
{
    return $spreadsheet->getSheetByName($sheet)->toArray(null, true, false, false);
}

function wbFind(array $rows, string $label): ?array
{
    foreach ($rows as $row) {
        if (($row[0] ?? null) === $label || ($row[1] ?? null) === $label) {
            return $row;
        }
    }

    return null;
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);

    Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik', 'nilai_perolehan' => 1000, 'nilai_buku' => 800, 'tanggal_perolehan' => '2022-03-01', 'nomor_register' => 7, 'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik', 'nilai_perolehan' => 2000, 'nilai_buku' => 1500, 'tanggal_perolehan' => '2022-07-15']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->laptop->id, 'kondisi' => 'rusak_berat', 'nilai_perolehan' => 3000, 'nilai_buku' => 1000, 'tanggal_perolehan' => '2024-01-10']);
    Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->laptop->id, 'kondisi' => 'hilang', 'nilai_perolehan' => 500, 'nilai_buku' => 100, 'tanggal_perolehan' => '2024-05-05']);

    $this->camat = userWithRole('camat', $this->kec);
});

it('writes five sheets, each with the letterhead, scope, filter and print date', function () {
    $book = wbBuild($this->camat);

    expect($book->getSheetNames())->toBe(['Ringkasan', 'Daftar Rinci', 'Rekap Kategori', 'Rekap Unit', 'Tren Tahunan']);

    foreach ($book->getSheetNames() as $name) {
        $rows = wbRows($book, $name);
        expect($rows[0][1])->toBe('PEMERINTAH KOTA BATAM')
            ->and($rows[1][1])->toBe('KECAMATAN SAGULUNG')
            ->and($rows[2][1])->not->toBeEmpty()
            ->and($rows[4][0])->toStartWith('Cakupan: ')
            ->and($rows[5][0])->toBe('Filter: Tanpa filter')
            ->and($rows[6][0])->toStartWith('Dicetak: ')
            ->and($book->getSheetByName($name)->getDrawingCollection())->toHaveCount(1);
    }
});

it('summarises totals and conditions on the Ringkasan sheet', function () {
    $rows = wbRows(wbBuild($this->camat), 'Ringkasan');

    expect($rows[2][1])->toBe('Ringkasan Laporan Aset')
        ->and(wbFind($rows, 'Jumlah Aset')[1])->toEqual(4)
        ->and(wbFind($rows, 'Total Nilai Perolehan')[1])->toEqual(6500)
        ->and(wbFind($rows, 'Total Nilai Buku')[1])->toEqual(3400)
        ->and(wbFind($rows, 'Baik')[1])->toEqual(2)
        ->and(wbFind($rows, 'Baik')[2])->toEqual(50.0)
        ->and(wbFind($rows, 'Total')[1])->toEqual(4);
});

it('lists every asset on Daftar Rinci with text kept as text and a totals row', function () {
    $rows = wbRows(wbBuild($this->camat), 'Daftar Rinci');

    expect($rows[8])->toContain('Kode Barang', 'No. Register', 'Nama Aset', 'Nilai Perolehan', 'Nilai Buku', 'Keterangan')
        ->and(count($rows[8]))->toBe(17);

    $heading = array_flip($rows[8]);
    $data = array_slice($rows, 9, 4);
    $special = collect($data)->first(fn ($r) => $r[$heading['Nama Aset']] === '=SUM(1+1)');

    expect($special)->not->toBeNull()
        ->and($special[$heading['No. Register']])->toBe('0007')
        ->and($special[$heading['Kode Barang']])->toBe('1.3.2.05.02.04.004');

    $total = wbFind($rows, 'TOTAL');
    expect($total[$heading['Nilai Perolehan']])->toEqual(6500)
        ->and($total[$heading['Nilai Buku']])->toEqual(3400);
});

it('recaps categories, units and the yearly trend with matching totals', function () {
    $book = wbBuild($this->camat);

    $kategori = wbRows($book, 'Rekap Kategori');
    expect(array_slice($kategori[8], 0, 5))->toBe(['Kategori', 'Subkategori', 'Jumlah', 'Nilai Perolehan', 'Nilai Buku'])
        ->and(wbFind($kategori, 'ALAT KANTOR')[2])->toEqual(2)
        ->and(wbFind($kategori, 'LAPTOP')[2])->toEqual(2)
        ->and(wbFind($kategori, 'Total')[3])->toEqual(6500);

    $unit = wbRows($book, 'Rekap Unit');
    expect(wbFind($unit, 'Kelurahan A')[1])->toEqual(2)
        ->and(wbFind($unit, 'Total')[1])->toEqual(4);

    $tren = wbRows($book, 'Tren Tahunan');
    expect(wbFind($tren, 'Total')[2])->toEqual(6500)
        ->and(collect($tren)->pluck(0)->filter(fn ($v) => $v === 2023 || $v === 2023.0)->count())->toBe(1);
});

it('drops the Rekap Unit sheet for a single-unit user', function () {
    $book = wbBuild(userWithRole('admin_kelurahan', $this->kelA));

    expect($book->getSheetNames())->toBe(['Ringkasan', 'Daftar Rinci', 'Rekap Kategori', 'Tren Tahunan']);
});

it('labels the filters on every sheet', function () {
    $book = wbBuild($this->camat, ['category_id' => $this->alat->id, 'kondisi' => 'baik']);

    expect(wbRows($book, 'Ringkasan')[5][0])->toBe('Filter: Kategori: ALAT KANTOR; Kondisi: Baik')
        ->and(wbRows($book, 'Daftar Rinci')[5][0])->toBe('Filter: Kategori: ALAT KANTOR; Kondisi: Baik');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRecapWorkbookTest.php`
Expected: FAIL (`Target class [App\Services\AssetRecapWorkbook] does not exist`).

- [ ] **Step 3: Implement the writer**

`app/Services/ReportSheetWriter.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Letterhead, table helper and human labels shared by the Excel reports. */
class ReportSheetWriter
{
    public const FIRST_TABLE_ROW = 9;

    private const STATUS = [
        'pending' => 'Menunggu Persetujuan', 'approved' => 'Disetujui', 'rejected' => 'Ditolak', 'cancelled' => 'Dibatalkan',
    ];

    private const FORMATS = ['int' => '#,##0', 'money' => '#,##0', 'percent' => '0.0', 'year' => '0', 'date' => 'dd/mm/yyyy'];

    /** Writes the official letterhead and returns the first free row for the table header. */
    public function kop(Worksheet $sheet, string $title, string $scope, string $filter, int $columns): int
    {
        $last = Coordinate::stringFromColumnIndex(max($columns, 6));
        $logo = public_path('images/lambang-kota-batam.png');

        if (is_file($logo)) {
            $drawing = new Drawing;
            $drawing->setName('Lambang Kota Batam');
            $drawing->setPath($logo);
            $drawing->setHeight(58);
            $drawing->setCoordinates('A1');
            $drawing->setOffsetX(4);
            $drawing->setOffsetY(2);
            $drawing->setWorksheet($sheet);
        }

        foreach ([1 => ['PEMERINTAH KOTA BATAM', 12], 2 => ['KECAMATAN SAGULUNG', 12], 3 => [$title, 14]] as $row => [$text, $size]) {
            $sheet->mergeCells("B{$row}:{$last}{$row}");
            $sheet->setCellValueExplicit("B{$row}", $text, DataType::TYPE_STRING);
            $sheet->getStyle("B{$row}")->getFont()->setBold(true)->setSize($size);
            $sheet->getRowDimension($row)->setRowHeight(20);
        }

        foreach ([5 => "Cakupan: {$scope}", 6 => "Filter: {$filter}", 7 => 'Dicetak: '.now()->format('d/m/Y H:i')] as $row => $text) {
            $sheet->mergeCells("A{$row}:{$last}{$row}");
            $sheet->setCellValueExplicit("A{$row}", $text, DataType::TYPE_STRING);
        }

        return self::FIRST_TABLE_ROW;
    }

    /**
     * Writes a header, the rows and an optional totals row; returns the next free row.
     *
     * @param  list<array{0: string, 1: string}>  $columns  [heading, kind]; kind: text|wrap|int|money|percent|year|date
     * @param  list<list<mixed>>  $rows
     * @param  list<mixed>|null  $total
     * @param  list<int>  $boldRows  zero-based indexes into $rows
     */
    public function table(Worksheet $sheet, int $headerRow, array $columns, array $rows, ?array $total = null, array $boldRows = [], bool $freeze = false): int
    {
        $lastLetter = Coordinate::stringFromColumnIndex(count($columns));

        foreach ($columns as $i => [$heading]) {
            $sheet->setCellValueExplicit(Coordinate::stringFromColumnIndex($i + 1).$headerRow, $heading, DataType::TYPE_STRING);
        }
        $sheet->getStyle("A{$headerRow}:{$lastLetter}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
            'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $row = $headerRow;
        foreach ($rows as $index => $cells) {
            $row++;
            $this->writeRow($sheet, $row, $columns, $cells);
            if (in_array($index, $boldRows, true)) {
                $sheet->getStyle("A{$row}:{$lastLetter}{$row}")->getFont()->setBold(true);
            }
        }

        if ($total !== null) {
            $row++;
            $this->writeRow($sheet, $row, $columns, $total);
            $sheet->getStyle("A{$row}:{$lastLetter}{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'borders' => ['top' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        foreach ($columns as $i => [, $kind]) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);

            if ($kind === 'wrap') {
                $sheet->getColumnDimension($letter)->setWidth(45);
                if ($row > $headerRow) {
                    $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$row}")->getAlignment()->setWrapText(true)->setVertical('top');
                }
            } else {
                $sheet->getColumnDimension($letter)->setAutoSize(true);
            }

            if ($row > $headerRow && isset(self::FORMATS[$kind])) {
                $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$row}")->getNumberFormat()->setFormatCode(self::FORMATS[$kind]);
            }
        }

        if ($freeze) {
            $sheet->freezePane('A'.($headerRow + 1));
        }

        return $row + 1;
    }

    /** @param  array<string, mixed>  $filters */
    public function scopeLabel(User $user, array $filters): string
    {
        if (! empty($filters['unit_id'])) {
            return Unit::find($filters['unit_id'])?->name ?? '-';
        }

        $ids = $user->accessibleUnitIds();

        return $ids === null
            ? 'Seluruh unit'
            : Unit::whereIn('id', $ids)->orderBy('type')->orderBy('name')->pluck('name')->implode(', ');
    }

    /** @param  array<string, mixed>  $filters */
    public function filterLabel(array $filters): string
    {
        $parts = [];

        if (! empty($filters['category_id'])) {
            $parts[] = 'Kategori: '.(AssetCategory::find($filters['category_id'])?->name ?? $filters['category_id']);
        }
        if (! empty($filters['kondisi'])) {
            $parts[] = 'Kondisi: '.(Kondisi::tryFrom($filters['kondisi'])?->label() ?? $filters['kondisi']);
        }
        if (! empty($filters['jenis'])) {
            $parts[] = 'Jenis: '.(AssetReportType::tryFrom($filters['jenis'])?->label() ?? $filters['jenis']);
        }
        if (! empty($filters['status'])) {
            $parts[] = 'Status: '.(self::STATUS[$filters['status']] ?? $filters['status']);
        }
        foreach (['dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: {$filters[$key]}";
            }
        }

        return $parts === [] ? 'Tanpa filter' : implode('; ', $parts);
    }

    /**
     * @param  list<array{0: string, 1: string}>  $columns
     * @param  list<mixed>  $cells
     */
    private function writeRow(Worksheet $sheet, int $row, array $columns, array $cells): void
    {
        foreach ($columns as $i => [, $kind]) {
            $value = $cells[$i] ?? null;

            if ($value === null || $value === '') {
                continue;
            }

            $coordinate = Coordinate::stringFromColumnIndex($i + 1).$row;

            match ($kind) {
                'int', 'money', 'percent', 'year' => $sheet->setCellValue($coordinate, $value),
                'date' => $sheet->setCellValue($coordinate, Date::PHPToExcel($value)),
                default => $sheet->setCellValueExplicit($coordinate, (string) $value, DataType::TYPE_STRING),
            };
        }
    }
}
```

- [ ] **Step 4: Implement the workbook**

`app/Services/AssetRecapWorkbook.php`:

```php
<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetRecapWorkbook
{
    public function __construct(private readonly ReportSheetWriter $writer) {}

    /**
     * @param  array<string, mixed>  $recap
     * @param  array<string, mixed>  $filters
     */
    public function download(array $recap, Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($recap, $query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            'laporan-aset-'.now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to tens of thousands of rows.
     *
     * @param  array<string, mixed>  $recap
     * @param  array<string, mixed>  $filters
     */
    private function build(array $recap, Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $scope = $this->writer->scopeLabel($user, $filters);
        $filter = $this->writer->filterLabel($filters);

        $this->ringkasan($this->sheet($spreadsheet, 0, 'Ringkasan'), $recap, $scope, $filter);
        $this->daftar($this->sheet($spreadsheet, 1, 'Daftar Rinci'), $recap, $query, $scope, $filter);
        $this->rekapKategori($this->sheet($spreadsheet, 2, 'Rekap Kategori'), $recap, $scope, $filter);

        $next = 3;
        if ($recap['rekap_unit'] !== null) {
            $this->rekapUnit($this->sheet($spreadsheet, $next++, 'Rekap Unit'), $recap, $scope, $filter);
        }

        $this->tren($this->sheet($spreadsheet, $next, 'Tren Tahunan'), $recap, $scope, $filter);
        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }

    private function sheet(Spreadsheet $spreadsheet, int $index, string $name): Worksheet
    {
        $sheet = $index === 0 ? $spreadsheet->getActiveSheet() : $spreadsheet->createSheet();
        $sheet->setTitle($name);

        return $sheet;
    }

    /** @param  array<string, mixed>  $recap */
    private function ringkasan(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $start = $this->writer->kop($sheet, 'Ringkasan Laporan Aset', $scope, $filter, 4);
        $r = $recap['ringkasan'];

        $next = $this->writer->table($sheet, $start, [['Uraian', 'text'], ['Nilai', 'money']], [
            ['Jumlah Aset', $r['jumlah']],
            ['Total Nilai Perolehan', $r['nilai_perolehan']],
            ['Total Nilai Buku', $r['nilai_buku']],
        ]);

        $this->writer->table(
            $sheet,
            $next + 1,
            [['Kondisi', 'text'], ['Jumlah', 'int'], ['Persen (%)', 'percent']],
            array_map(fn (array $k) => [$k['label'], $k['jumlah'], $k['persen']], $recap['kondisi']),
            ['Total', $r['jumlah'], array_sum(array_column($recap['kondisi'], 'persen'))],
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function daftar(Worksheet $sheet, array $recap, Builder $query, string $scope, string $filter): void
    {
        $columns = [
            ['No', 'int'], ['Kode Barang', 'text'], ['No. Register', 'text'], ['Nama Aset', 'text'], ['Kategori', 'text'],
            ['Subkategori', 'text'], ['Merk/Tipe', 'text'], ['Unit', 'text'], ['Pemegang', 'text'], ['Kondisi', 'text'],
            ['Status', 'text'], ['Tanggal Perolehan', 'date'], ['Sumber Perolehan', 'text'], ['Nilai Perolehan', 'money'],
            ['Nilai Buku', 'money'], ['No. Dokumen', 'text'], ['Keterangan', 'wrap'],
        ];

        $rows = [];
        foreach ($query->get() as $index => $a) {
            /** @var Asset $a */
            $rows[] = [
                $index + 1, $a->kode_barang, $a->registerLabel(), $a->nama_aset,
                $a->category?->parent?->name ?? $a->category?->name,
                $a->category?->parent_id !== null ? $a->category->name : null,
                $a->merk_type, $a->unit?->name, $a->currentHolder?->nama, $a->kondisi->label(), $a->status->label(),
                $a->tanggal_perolehan, $a->sumber_perolehan, (float) $a->nilai_perolehan, (float) $a->nilai_buku,
                $a->no_dokumen, $a->keterangan,
            ];
        }

        $start = $this->writer->kop($sheet, 'Daftar Rinci Aset', $scope, $filter, count($columns));
        $total = array_fill(0, count($columns), null);
        $total[1] = 'TOTAL';
        $total[13] = $recap['ringkasan']['nilai_perolehan'];
        $total[14] = $recap['ringkasan']['nilai_buku'];

        $this->writer->table($sheet, $start, $columns, $rows, $total, [], true);
    }

    /** @param  array<string, mixed>  $recap */
    private function rekapKategori(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $rows = [];
        $bold = [];

        foreach ($recap['rekap_kategori']['grup'] as $group) {
            $bold[] = count($rows);
            $rows[] = [$group['nama'], null, $group['jumlah'], $group['nilai_perolehan'], $group['nilai_buku']];

            foreach ($group['anak'] as $child) {
                $rows[] = [null, $child['nama'], $child['jumlah'], $child['nilai_perolehan'], $child['nilai_buku']];
            }
        }

        $t = $recap['rekap_kategori']['total'];
        $start = $this->writer->kop($sheet, 'Rekap Aset per Kategori', $scope, $filter, 5);
        $this->writer->table(
            $sheet,
            $start,
            [['Kategori', 'text'], ['Subkategori', 'text'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            $rows,
            ['Total', null, $t['jumlah'], $t['nilai_perolehan'], $t['nilai_buku']],
            $bold,
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function rekapUnit(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $t = $recap['rekap_unit']['total'];
        $start = $this->writer->kop($sheet, 'Rekap Aset per Unit', $scope, $filter, 4);
        $this->writer->table(
            $sheet,
            $start,
            [['Unit', 'text'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            array_map(fn (array $u) => [$u['nama'], $u['jumlah'], $u['nilai_perolehan'], $u['nilai_buku']], $recap['rekap_unit']['baris']),
            ['Total', $t['jumlah'], $t['nilai_perolehan'], $t['nilai_buku']],
        );
    }

    /** @param  array<string, mixed>  $recap */
    private function tren(Worksheet $sheet, array $recap, string $scope, string $filter): void
    {
        $r = $recap['ringkasan'];
        $start = $this->writer->kop($sheet, 'Tren Aset per Tahun Perolehan', $scope, $filter, 4);
        $this->writer->table(
            $sheet,
            $start,
            [['Tahun', 'year'], ['Jumlah', 'int'], ['Nilai Perolehan', 'money'], ['Nilai Buku', 'money']],
            array_map(fn (array $y) => [$y['tahun'], $y['jumlah'], $y['nilai_perolehan'], $y['nilai_buku']], $recap['tren']),
            ['Total', $r['jumlah'], $r['nilai_perolehan'], $r['nilai_buku']],
        );
    }
}
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/AssetRecapWorkbookTest.php`
Expected: PASS (6 tests). If `toArray` returns a merged-cell label in column A instead of B for the letterhead rows, the assertions index the actual cell (B1..B3 = column index 1); fix the writer, not the test.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/Services/ReportSheetWriter.php app/Services/AssetRecapWorkbook.php tests/Feature/AssetRecapWorkbookTest.php
git commit -m "feat: add the five-sheet Laporan Aset workbook with letterhead"
```

---

## Task 3: Controller, routes and sort validation

**Files:**
- Create: `app/Http/Controllers/LaporanAsetController.php`
- Create (stub, replaced in Task 6): `resources/js/Pages/LaporanAset/Index.tsx`
- Modify: `app/Http/Requests/ReportRequest.php`, `routes/web.php`
- Test: `tests/Feature/LaporanAsetControllerTest.php`

**Interfaces:**
- Consumes: `AssetRecapService::for`, `AssetRecapWorkbook::download`, `ReportQuery::build`.
- Produces: routes `laporan-aset.index` (`GET /laporan-aset`) → Inertia `LaporanAset/Index` with props `filters`, `sort {urut, arah}`, `ringkasan`, `kondisi`, `tren`, `rekap_kategori`, `rekap_unit`, `asets` (paginator of rows), `units` (`[{id,name,type}]`, `[]` for a single-unit scope), `categories` (`[{id,name}]` main categories), `kondisiOptions`; `laporan-aset.download` (`GET /laporan-aset/unduh`, same query) → xlsx or 422. Row keys: `id, kode_barang, nomor_register, nama_aset, merk_type, kategori, subkategori, unit, tahun_perolehan, kondisi, nilai_perolehan, nilai_buku, detail{pemegang,status,sumber_perolehan,no_dokumen,keterangan}`. `ReportRequest::SORTABLE`, `ReportRequest::sorting(): array{urut: string, arah: string}`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/LaporanAsetControllerTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);

    $this->holder = Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'nama' => 'Budi Santoso']);
    $this->a1 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja A', 'nomor_register' => 7,
        'nilai_perolehan' => 5000, 'nilai_buku' => 4000, 'tanggal_perolehan' => '2021-02-03', 'current_holder_id' => $this->holder->id,
        'sumber_perolehan' => 'Pembelian', 'no_dokumen' => 'DOK-9', 'keterangan' => 'Catatan A',
    ]);
    $this->a2 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B',
        'nilai_perolehan' => 9000, 'nilai_buku' => 7000, 'tanggal_perolehan' => '2023-06-07',
    ]);
    $this->aOther = Asset::factory()->create([
        'unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Lain',
        'nilai_perolehan' => 100, 'nilai_buku' => 50, 'tanggal_perolehan' => '2020-01-01',
    ]);
});

it('renders the page with recap, list rows and filter options for the camat', function () {
    $this->actingAs($this->camat)->get('/laporan-aset')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('LaporanAset/Index')
            ->where('ringkasan.jumlah', 3)
            ->where('asets.total', 3)
            ->has('kondisi', 4)
            ->has('tren')
            ->has('rekap_kategori.grup')
            ->where('rekap_unit.total.jumlah', 3)
            ->has('units', 3)
            ->has('categories', 1)
            ->has('kondisiOptions', 4)
            ->where('sort', ['urut' => 'kode_barang', 'arah' => 'asc']));
});

it('gives a list row its columns and the detail block', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset?urut=nama_aset')
        ->assertInertia(fn (Assert $p) => $p
            ->where('asets.data.0', fn ($row) => $row['id'] === $this->a1->id
                && $row['nomor_register'] === '0007'
                && $row['kategori'] === 'ALAT KANTOR'
                && $row['subkategori'] === 'MEJA'
                && $row['unit'] === 'Kelurahan A'
                && $row['tahun_perolehan'] === '2021'
                && $row['kondisi'] === $this->a1->kondisi->value
                && $row['nilai_perolehan'] === 5000.0
                && $row['detail']['pemegang'] === 'Budi Santoso'
                && $row['detail']['no_dokumen'] === 'DOK-9'
                && $row['detail']['sumber_perolehan'] === 'Pembelian'
                && $row['detail']['keterangan'] === 'Catatan A'));
});

it('limits a single-unit user to the own unit and hides the unit recap and the unit filter', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p
            ->where('ringkasan.jumlah', 2)
            ->where('asets.total', 2)
            ->where('rekap_unit', null)
            ->where('units', []));
});

it('paginates 25 rows per page', function () {
    Asset::factory()->count(28)->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id]);

    $this->actingAs($this->adminA)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 30)->has('asets.data', 25)->where('asets.last_page', 2));
    $this->actingAs($this->adminA)->get('/laporan-aset?page=2')
        ->assertInertia(fn (Assert $p) => $p->has('asets.data', 5));
});

it('sorts by a whitelisted column and refuses anything else', function () {
    $this->actingAs($this->adminA)->get('/laporan-aset?urut=nilai_perolehan&arah=desc')
        ->assertInertia(fn (Assert $p) => $p
            ->where('asets.data.0.id', $this->a2->id)
            ->where('sort', ['urut' => 'nilai_perolehan', 'arah' => 'desc']));

    $this->actingAs($this->adminA)->getJson('/laporan-aset?urut=password')->assertUnprocessable()->assertJsonValidationErrors('urut');
    $this->actingAs($this->adminA)->getJson('/laporan-aset?urut=nama_aset;drop table assets')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan-aset?arah=sideways')->assertUnprocessable()->assertJsonValidationErrors('arah');
});

it('applies filters and refuses a unit out of scope', function () {
    $this->actingAs($this->camat)->get('/laporan-aset?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 1)->where('ringkasan.jumlah', 1));

    $this->actingAs($this->adminA)->getJson('/laporan-aset?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->adminA)->getJson('/laporan-aset/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
});

it('keeps the page row count equal to the summary and handles an empty result', function () {
    $this->actingAs($this->kasubag)->get('/laporan-aset')
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 3)->where('ringkasan.jumlah', 3));

    $this->actingAs($this->kasubag)->get('/laporan-aset?kondisi=hilang')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('asets.total', 0)->where('ringkasan.jumlah', 0)->where('tren', []));
});

it('downloads the workbook and refuses an empty download', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan-aset/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-aset-'.now()->format('Y-m-d').'.xlsx');

    $this->actingAs($this->adminA)->getJson('/laporan-aset/unduh?kondisi=hilang')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan-aset')->assertRedirect('/login');
    $this->get('/laporan-aset/unduh')->assertRedirect('/login');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/LaporanAsetControllerTest.php`
Expected: FAIL (404 on `/laporan-aset`: route not defined).

- [ ] **Step 3: Request rules**

In `app/Http/Requests/ReportRequest.php` add the constant and rules, and the `sorting()` method:

```php
    public const SORTABLE = ['kode_barang', 'nomor_register', 'nama_aset', 'tanggal_perolehan', 'kondisi', 'nilai_perolehan', 'nilai_buku'];
```

(add inside the class, above `FILTER_KEYS`), then add to `rules()`:

```php
            'urut' => ['nullable', Rule::in(self::SORTABLE)],
            'arah' => ['nullable', Rule::in(['asc', 'desc'])],
```

and add the method (after `filters()`):

```php
    /** @return array{urut: string, arah: string} */
    public function sorting(): array
    {
        return [
            'urut' => $this->validated('urut') ?: 'kode_barang',
            'arah' => $this->validated('arah') ?: 'asc',
        ];
    }
```

- [ ] **Step 4: Controller, routes, stub page**

`app/Http/Controllers/LaporanAsetController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Http\Requests\ReportRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Services\AssetRecapService;
use App\Services\AssetRecapWorkbook;
use App\Services\ReportQuery;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanAsetController extends Controller
{
    private const PER_PAGE = 25;

    public function index(ReportRequest $request, AssetRecapService $recap): Response
    {
        $user = $request->user();
        $filters = $request->filters();
        $sort = $request->sorting();
        $ids = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        $asets = (new ReportQuery($user))->build('aset', $filters)
            ->reorder($sort['urut'], $sort['arah'])
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Asset $a) => $this->row($a));

        return Inertia::render('LaporanAset/Index', [
            'filters' => $filters,
            'sort' => $sort,
            ...$recap->for($user, $filters),
            'asets' => $asets,
            'units' => $units->count() > 1 ? $units : [],
            'categories' => AssetCategory::whereNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ]);
    }

    public function unduh(ReportRequest $request, AssetRecapService $recap, AssetRecapWorkbook $workbook): StreamedResponse
    {
        $user = $request->user();
        $filters = $request->filters();
        $query = (new ReportQuery($user))->build('aset', $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $workbook->download($recap->for($user, $filters), $query, $filters, $user);
    }

    /** @return array<string, mixed> */
    private function row(Asset $a): array
    {
        return [
            'id' => $a->id,
            'kode_barang' => $a->kode_barang,
            'nomor_register' => $a->registerLabel(),
            'nama_aset' => $a->nama_aset,
            'merk_type' => $a->merk_type,
            'kategori' => $a->category?->parent?->name ?? $a->category?->name,
            'subkategori' => $a->category?->parent_id !== null ? $a->category->name : null,
            'unit' => $a->unit?->name,
            'tahun_perolehan' => $a->tanggal_perolehan?->format('Y'),
            'kondisi' => $a->kondisi->value,
            'nilai_perolehan' => (float) $a->nilai_perolehan,
            'nilai_buku' => (float) $a->nilai_buku,
            'detail' => [
                'pemegang' => $a->currentHolder?->nama,
                'status' => $a->status->value,
                'sumber_perolehan' => $a->sumber_perolehan,
                'no_dokumen' => $a->no_dokumen,
                'keterangan' => $a->keterangan,
            ],
        ];
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\LaporanAsetController;` (alphabetical among the controller imports) and, inside the `auth` group before the `/laporan` routes:

```php
    Route::get('/laporan-aset', [LaporanAsetController::class, 'index'])->name('laporan-aset.index');
    Route::get('/laporan-aset/unduh', [LaporanAsetController::class, 'unduh'])->name('laporan-aset.download');
```

Stub page (Task 6 replaces it):

```bash
mkdir -p resources/js/Pages/LaporanAset
printf "export default function Index() {\n    return null;\n}\n" > resources/js/Pages/LaporanAset/Index.tsx
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/LaporanAsetControllerTest.php`
Expected: PASS (9 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/LaporanAsetController.php app/Http/Requests/ReportRequest.php routes/web.php resources/js/Pages/LaporanAset/Index.tsx tests/Feature/LaporanAsetControllerTest.php
git commit -m "feat: add the Laporan Aset page and download endpoints"
```

---

## Task 4: Retire "aset" from the old tabbed Laporan page

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`, `app/Http/Requests/ReportRequest.php`, `app/Services/ReportExporter.php`, `routes/web.php`, `resources/js/Pages/Report/Index.tsx`
- Replace: `tests/Feature/ReportDownloadTest.php`

**Interfaces:**
- Consumes: `ReportSheetWriter::scopeLabel/filterLabel` (Task 2).
- Produces: `/laporan` serves only `mutasi` (default) and `rusak-hilang`; `/laporan/{laporan}/unduh` constraint `mutasi|rusak-hilang` (`/laporan/aset/unduh` → 404); `ReportRequest::PAGE_KINDS = ['mutasi', 'rusak-hilang']`; the page no longer receives `categories` / `kondisiOptions`.

- [ ] **Step 1: Rewrite the old download test (RED against the current code)**

Replace `tests/Feature/ReportDownloadTest.php` with:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\AssetReport;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\IOFactory;

function xlsxRows($response): array
{
    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $response->streamedContent());
    $rows = IOFactory::load($path)->getActiveSheet()->toArray(null, true, false, false);
    unlink($path);

    return $rows;
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

    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B']);
});

it('downloads the mutation history with its asset list and the damaged/lost report', function () {
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/0001', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kelA->id, 'tanggal_mutasi' => '2026-10-03', 'status' => 'pending',
        'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $mutation->id, 'asset_id' => $this->a2->id]);
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);

    $response = $this->actingAs($this->adminA)->get('/laporan/mutasi/unduh');
    expect($response->headers->get('content-disposition'))->toContain('laporan-mutasi-'.now()->format('Y-m-d').'.xlsx');

    $mut = xlsxRows($response);
    $heading = array_flip($mut[5]);
    expect($mut[0][0])->toBe('Laporan Riwayat Mutasi')
        ->and($mut[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($mut[2][0])->toBe('Filter: Tanpa filter')
        ->and(array_slice($mut, 6))->toHaveCount(1)
        ->and($mut[6][$heading['Nomor Mutasi']])->toBe('MUT/2026/0001')
        ->and($mut[6][$heading['Unit Tujuan']])->toBe('Kelurahan A')
        ->and((int) $mut[6][$heading['Jumlah Aset']])->toBe(1)
        ->and($mut[6][$heading['Daftar Aset']])->toContain($this->a2->kode_barang.' - Kursi');

    $rep = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh'));
    $heading = array_flip($rep[5]);
    expect($rep[0][0])->toBe('Laporan Aset Rusak dan Hilang')
        ->and(array_slice($rep, 6))->toHaveCount(1)
        ->and($rep[6][$heading['Nomor Laporan']])->toBe('LP/2026/0001')
        ->and($rep[6][$heading['Kronologi']])->toBe('Patah kaki');
});

it('labels filters with their readable names in the file header', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'status' => 'approved']);

    $rows = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh?jenis=hilang&status=approved'));

    expect($rows[2][0])->toBe('Filter: Jenis: Hilang; Status: Disetujui');
});

it('refuses a unit out of scope, an unknown report, the retired aset report and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/aset/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/mutasi/unduh')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?jenis=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=aset')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/mutasi/unduh')->assertRedirect('/login');
});

it('defaults to the mutation report, shows the row count and it equals the rows in the file', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/1']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2']);

    $this->actingAs($this->camat)->get('/laporan')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'mutasi')
            ->where('rowCount', 0)
            ->has('units', 3)
            ->missing('categories')
            ->missing('kondisiOptions'));

    $this->actingAs($this->camat)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('laporan', 'rusak-hilang')->where('rowCount', 2));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/rusak-hilang/unduh'));
    expect(array_slice($file, 6))->toHaveCount(2);

    $this->actingAs($this->adminA)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 1)->where('units', []));
});
```

Run: `php artisan test tests/Feature/ReportDownloadTest.php`
Expected: FAIL (the old code still serves `aset`, default kind is `aset`, and the filter header prints raw values).

- [ ] **Step 2: Backend changes**

`app/Http/Requests/ReportRequest.php`: add the constant above `SORTABLE`

```php
    public const PAGE_KINDS = ['mutasi', 'rusak-hilang'];
```

and change the `laporan` rule to

```php
            'laporan' => ['nullable', Rule::in(self::PAGE_KINDS)],
```

(`ReportQuery` import in this file becomes unused: remove `use App\Services\ReportQuery;`.)

`app/Http/Controllers/ReportController.php`: in `index()` change `?: 'aset'` to `?: 'mutasi'`, and delete the `'categories'` and `'kondisiOptions'` props; remove the now-unused `use App\Enums\Kondisi;` and `use App\Models\AssetCategory;`.

`routes/web.php`: change the download constraint to

```php
        ->where('laporan', 'mutasi|rusak-hilang')
```

`app/Services/ReportExporter.php`: inject the writer and delegate labels, drop the aset report.
- Add `public function __construct(private readonly ReportSheetWriter $writer) {}` at the top of the class.
- In `TITLES` remove the `'aset'` entry; in `columns()` delete the whole `'aset' => [ … ],` arm and the `use App\Models\Asset;` import.
- Replace the calls `$this->scopeLabel($user, $filters)` and `$this->filterLabel($filters)` with `$this->writer->scopeLabel($user, $filters)` and `$this->writer->filterLabel($filters)`, then delete the two private methods `scopeLabel()` and `filterLabel()` and the imports they alone used (`AssetCategory`, `Unit`).

- [ ] **Step 3: Frontend changes**

Replace `resources/js/Pages/Report/Index.tsx` with:

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Kind = 'mutasi' | 'rusak-hilang';
type Filters = Record<string, string | number | undefined>;

interface ReportProps extends PageProps {
    laporan: Kind;
    filters: Filters;
    rowCount: number;
    units: { id: number; name: string; type: string }[];
}

const KINDS: { key: Kind; label: string }[] = [
    { key: 'mutasi', label: 'Riwayat Mutasi' },
    { key: 'rusak-hilang', label: 'Aset Rusak & Hilang' },
];

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Menunggu Persetujuan' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'rejected', label: 'Ditolak' },
    { value: 'cancelled', label: 'Dibatalkan' },
];

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

export default function Index({ laporan, filters, rowCount, units }: ReportProps) {
    const [form, setForm] = useState<Filters>(filters);
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});
    const dirty = signature(form) !== signature(filters);

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const apply = (kind: Kind, data: Filters) =>
        router.get(route('report.index'), clean({ ...data, laporan: kind }), { preserveScroll: true, preserveState: 'errors', replace: true });

    const switchKind = (kind: Kind) => {
        setForm({});
        apply(kind, {});
    };

    const downloadUrl = `${route('report.download', { laporan })}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const select = (key: string, label: string, options: { value: string | number; label: string }[], placeholder: string) => (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <select value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD}>
                <option value="">{placeholder}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );

    const date = (key: string, label: string) => (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <input type="date" value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD} />
        </div>
    );

    const unitSelect = units.length > 0 && select('unit_id', 'Unit', units.map((u) => ({ value: u.id, label: u.name })), 'Semua unit');

    return (
        <AuthenticatedLayout>
            <Head title="Laporan" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan</h1>
                </div>

                <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis laporan">
                    {KINDS.map((k) => (
                        <button
                            key={k.key}
                            type="button"
                            aria-pressed={laporan === k.key}
                            onClick={() => switchKind(k.key)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${laporan === k.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            {k.label}
                        </button>
                    ))}
                </div>

                {errorMessages.length > 0 && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {errorMessages.map((m) => <p key={m}>{m}</p>)}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply(laporan, form);
                    }}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {laporan === 'mutasi' && (
                            <>
                                {date('dari', 'Dari tanggal')}
                                {date('sampai', 'Sampai tanggal')}
                                {unitSelect}
                                {select('status', 'Status', STATUS_OPTIONS, 'Semua status')}
                            </>
                        )}
                        {laporan === 'rusak-hilang' && (
                            <>
                                {date('dari', 'Dari tanggal kejadian')}
                                {date('sampai', 'Sampai tanggal kejadian')}
                                {unitSelect}
                                {select('jenis', 'Jenis', [{ value: 'rusak', label: 'Rusak' }, { value: 'hilang', label: 'Hilang' }], 'Semua jenis')}
                                {select('status', 'Status', STATUS_OPTIONS, 'Semua status')}
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900">{rowCount}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {rowCount > 0 && !dirty ? (
                                <a href={downloadUrl} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                                    Unduh Excel
                                </a>
                            ) : (
                                <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
                                    Unduh Excel
                                </span>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Run tests and checks**

Run: `php artisan test tests/Feature/ReportDownloadTest.php`
Expected: PASS (6 tests).

Run: `php artisan test`
Expected: all green (`ReportQueryTest` still builds the `aset` query directly and stays green; the old aset download tests are gone from `ReportDownloadTest`).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ReportController.php app/Http/Requests/ReportRequest.php app/Services/ReportExporter.php routes/web.php resources/js/Pages/Report/Index.tsx tests/Feature/ReportDownloadTest.php
git commit -m "refactor: retire the aset report from the old tabbed Laporan page"
```

---

## Task 5: Frontend foundations (charts, format, types, menu)

**Files:**
- Modify: `package.json` / `package-lock.json`, `resources/js/types/index.d.ts`, `resources/js/config/navigation.ts`, `resources/js/Pages/Dashboard.tsx`
- Create: `resources/js/lib/format.ts`, `resources/js/Components/Charts/TrenAsetChart.tsx`, `resources/js/Components/Charts/KondisiChart.tsx`

**Interfaces:**
- Produces: `rupiah(n: number): string`, `rupiahRingkas(n: number): string` in `@/lib/format`; types `RekapTotals`, `LaporanAsetRow`, `LaporanAsetData` in `@/types`; `<TrenAsetChart data={LaporanAsetData['tren']} />`, `<KondisiChart data={LaporanAsetData['kondisi']} />`; sidebar group `LAPORAN`.

- [ ] **Step 1: Install the libraries**

Run: `npm install chart.js react-chartjs-2 chartjs-plugin-datalabels`
Expected: packages added, no vulnerabilities reported as errors.

- [ ] **Step 2: Format helpers**

`resources/js/lib/format.ts`:

```ts
export const rupiah = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/** Compact rupiah for chart labels, e.g. "Rp 1,2 jt". */
export const rupiahRingkas = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
```

- [ ] **Step 3: Types**

Append to `resources/js/types/index.d.ts`:

```ts

export interface RekapTotals {
    jumlah: number;
    nilai_perolehan: number;
    nilai_buku: number;
}

export interface LaporanAsetRow {
    id: number;
    kode_barang: string;
    nomor_register: string;
    nama_aset: string;
    merk_type: string | null;
    kategori: string | null;
    subkategori: string | null;
    unit: string | null;
    tahun_perolehan: string | null;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    nilai_perolehan: number;
    nilai_buku: number;
    detail: {
        pemegang: string | null;
        status: 'aktif' | 'dalam_proses';
        sumber_perolehan: string | null;
        no_dokumen: string | null;
        keterangan: string | null;
    };
}

export interface LaporanAsetData {
    filters: Record<string, string | number>;
    sort: { urut: string; arah: 'asc' | 'desc' };
    ringkasan: RekapTotals;
    kondisi: { kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang'; label: string; jumlah: number; persen: number }[];
    tren: { tahun: number; jumlah: number; nilai_perolehan: number; nilai_buku: number }[];
    rekap_kategori: {
        grup: (RekapTotals & { id: number; nama: string; anak: (RekapTotals & { id: number; nama: string })[] })[];
        total: RekapTotals;
    };
    rekap_unit: { baris: (RekapTotals & { id: number; nama: string })[]; total: RekapTotals } | null;
    asets: Paginated<LaporanAsetRow>;
    units: { id: number; name: string; type: string }[];
    categories: { id: number; name: string }[];
    kondisiOptions: { value: string; label: string }[];
}
```

- [ ] **Step 4: Chart components**

`resources/js/Components/Charts/TrenAsetChart.tsx`:

```tsx
import { rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanAsetData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Tren = LaporanAsetData['tren'];

export default function TrenAsetChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 40 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => `Tahun ${items[0].label}`,
                    label: (ctx) => {
                        const row = data[ctx.dataIndex];
                        return [`${row.jumlah} aset`, `Nilai perolehan: ${rupiah(row.nilai_perolehan)}`, `Nilai buku: ${rupiah(row.nilai_buku)}`];
                    },
                },
            },
            datalabels: {
                anchor: 'end',
                align: 'end',
                color: '#0F172A',
                font: { size: 11, weight: 600 },
                formatter: (_value, ctx) => {
                    const row = data[ctx.dataIndex];
                    return [`${row.jumlah} aset`, rupiahRingkas(row.nilai_perolehan)];
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#475569' } },
            y: { beginAtZero: true, ticks: { precision: 0, color: '#475569' }, grid: { color: '#E2E8F0' } },
        },
    };

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(data.length * 96, 320), height: 340 }}>
                <Bar
                    data={{
                        labels: data.map((d) => String(d.tahun)),
                        datasets: [{ data: data.map((d) => d.jumlah), backgroundColor: '#1E40AF', borderRadius: 2, barPercentage: 0.6 }],
                    }}
                    options={options}
                    plugins={[ChartDataLabels]}
                    aria-label="Grafik jumlah aset per tahun perolehan"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Aset per tahun perolehan</caption>
                <thead><tr><th>Tahun</th><th>Jumlah</th><th>Nilai perolehan</th></tr></thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.tahun}><td>{d.tahun}</td><td>{d.jumlah}</td><td>{rupiah(d.nilai_perolehan)}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

`resources/js/Components/Charts/KondisiChart.tsx`:

```tsx
import { LaporanAsetData } from '@/types';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

export const KONDISI_COLOR: Record<string, string> = {
    baik: '#047857',
    rusak_ringan: '#B45309',
    rusak_berat: '#B91C1C',
    hilang: '#4B5563',
};

export default function KondisiChart({ data }: { data: LaporanAsetData['kondisi'] }) {
    const total = data.reduce((sum, k) => sum + k.jumlah, 0);

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    return (
        <div className="mx-auto h-56 w-56">
            <Doughnut
                data={{
                    labels: data.map((k) => k.label),
                    datasets: [{ data: data.map((k) => k.jumlah), backgroundColor: data.map((k) => KONDISI_COLOR[k.kondisi]), borderWidth: 2, borderColor: '#FFFFFF' }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${data[ctx.dataIndex].jumlah} aset (${data[ctx.dataIndex].persen}%)` } },
                    },
                }}
                aria-label="Grafik persentase aset menurut kondisi"
                role="img"
            />
        </div>
    );
}
```

- [ ] **Step 5: Menu and dashboard link**

In `resources/js/config/navigation.ts`:
- in the `UTAMA` group remove the `{ label: 'Laporan', href: '/laporan', icon: 'bar-chart' },` item (leaving only Dashboard);
- insert, between the `TRANSAKSI` and `PENGATURAN` groups:

```ts
    {
        title: 'LAPORAN',
        items: [
            { label: 'Laporan Aset', href: '/laporan-aset', icon: 'bar-chart' },
            { label: 'Laporan Mutasi', href: '/laporan?laporan=mutasi', icon: 'shuffle' },
            { label: 'Laporan Rusak & Hilang', href: '/laporan?laporan=rusak-hilang', icon: 'alert-triangle' },
        ],
    },
```

- delete the whole obsolete `ALAT BANTU` group (both `Pindai QR Code` and `Laporan & Ekspor` placeholders).

In `resources/js/Pages/Dashboard.tsx` change `{ label: 'Laporan', href: route('report.index') },` to `{ label: 'Laporan', href: route('laporan-aset.index') },`.

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json resources/js/lib/format.ts resources/js/types/index.d.ts resources/js/Components/Charts/TrenAsetChart.tsx resources/js/Components/Charts/KondisiChart.tsx resources/js/config/navigation.ts resources/js/Pages/Dashboard.tsx
git commit -m "feat: add Chart.js components, format helpers and the LAPORAN menu group"
```

---

## Task 6: The Laporan Aset page, docs and regression

**Files:**
- Replace stub: `resources/js/Pages/LaporanAset/Index.tsx`
- Modify: `docs/superpowers/specs/2026-10-05-laporan-aset-design.md`, `docs/DETAIL_RBAC_SISTEM.md`

**Interfaces:**
- Consumes: props from Task 3 (`LaporanAsetData`), `TrenAsetChart`, `KondisiChart` + `KONDISI_COLOR` (Task 5), `rupiah` (`@/lib/format`), `pageNumbersWithGaps` (`@/lib/pagination`), `KONDISI_LABEL` (`@/lib/assetReport`), routes `laporan-aset.index`, `laporan-aset.download`, `dashboard`.

- [ ] **Step 1: Page**

`resources/js/Pages/LaporanAset/Index.tsx`:

```tsx
import KondisiChart, { KONDISI_COLOR } from '@/Components/Charts/KondisiChart';
import TrenAsetChart from '@/Components/Charts/TrenAsetChart';
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { rupiah } from '@/lib/format';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { LaporanAsetData, PageProps, RekapTotals } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useState } from 'react';

type Filters = Record<string, string | number | undefined>;

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

const KONDISI_BADGE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200',
    hilang: 'bg-gray-100 text-gray-600 border-gray-300',
};

const SORTABLE_COLUMNS: { key: string; label: string; sort?: string; align?: 'right' }[] = [
    { key: 'kode_barang', label: 'Kode Barang', sort: 'kode_barang' },
    { key: 'nomor_register', label: 'No. Register', sort: 'nomor_register' },
    { key: 'nama_aset', label: 'Nama / Merk', sort: 'nama_aset' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'unit', label: 'Unit' },
    { key: 'tahun', label: 'Tahun', sort: 'tanggal_perolehan' },
    { key: 'kondisi', label: 'Kondisi', sort: 'kondisi' },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right' },
    { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right' },
];

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

function Badge({ label, style }: { label: string; style: string }) {
    return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        </div>
    );
}

function TotalsCells({ row, bold }: { row: RekapTotals; bold?: boolean }) {
    const cls = `px-4 py-3 text-right tabular-nums ${bold ? 'font-semibold' : ''}`;
    return (
        <>
            <td className={cls}>{row.jumlah.toLocaleString('id-ID')}</td>
            <td className={cls}>{rupiah(row.nilai_perolehan)}</td>
            <td className={cls}>{rupiah(row.nilai_buku)}</td>
        </>
    );
}

export default function Index(props: PageProps & LaporanAsetData) {
    const { filters, sort, ringkasan, kondisi, tren, rekap_kategori: rekapKategori, rekap_unit: rekapUnit, asets, units, categories, kondisiOptions } = props;
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    const [form, setForm] = useState<Filters>(filters);
    const [open, setOpen] = useState<number | null>(null);
    const dirty = signature(form) !== signature(filters);

    const visit = (extra: Filters, base: Filters = filters) =>
        router.get(route('laporan-aset.index'), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });

    const downloadUrl = `${route('laporan-aset.download')}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const pages = pageNumbersWithGaps(asets.current_page, asets.last_page);

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Aset</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Aset</h1>
                </div>

                {errorMessages.length > 0 && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {errorMessages.map((m) => <p key={m}>{m}</p>)}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        visit({ page: undefined }, form);
                    }}
                    className={`${CARD} space-y-4`}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {units.length > 0 && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Unit</label>
                                <select value={form.unit_id ?? ''} onChange={(e) => set('unit_id', e.target.value)} className={FIELD}>
                                    <option value="">Semua unit</option>
                                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Kategori</label>
                            <select value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value)} className={FIELD}>
                                <option value="">Semua kategori</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Kondisi</label>
                            <select value={form.kondisi ?? ''} onChange={(e) => set('kondisi', e.target.value)} className={FIELD}>
                                <option value="">Semua kondisi</option>
                                {kondisiOptions.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900 tabular-nums">{asets.total}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {asets.total > 0 && !dirty ? (
                                <a href={downloadUrl} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                                    Unduh Excel
                                </a>
                            ) : (
                                <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
                                    Unduh Excel
                                </span>
                            )}
                        </div>
                    </div>
                </form>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Stat label="Jumlah Aset" value={ringkasan.jumlah.toLocaleString('id-ID')} />
                    <Stat label="Total Nilai Perolehan" value={rupiah(ringkasan.nilai_perolehan)} />
                    <Stat label="Total Nilai Buku" value={rupiah(ringkasan.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Persentase per Kondisi</p>
                        <KondisiChart data={kondisi} />
                        <ul className="mt-4 space-y-2 text-sm">
                            {kondisi.map((k) => (
                                <li key={k.kondisi} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-slate-800">
                                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: KONDISI_COLOR[k.kondisi] }} aria-hidden="true" />
                                        {KONDISI_LABEL[k.kondisi] ?? k.label}
                                    </span>
                                    <span className="tabular-nums text-slate-600">{k.jumlah.toLocaleString('id-ID')} aset · {k.persen.toLocaleString('id-ID')}%</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`${CARD} lg:col-span-2`}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Tren per Tahun Perolehan</p>
                        <TrenAsetChart data={tren} />
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Rekap per Kategori</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Kategori</th>
                                    <th className={`${TH} text-right`}>Jumlah</th>
                                    <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                    <th className={`${TH} text-right`}>Nilai Buku</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {rekapKategori.grup.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Belum ada data.</td></tr>
                                )}
                                {rekapKategori.grup.map((g) => (
                                    <Fragment key={g.id}>
                                        <tr className="bg-slate-50/60">
                                            <td className="px-4 py-3 font-semibold">{g.nama}</td>
                                            <TotalsCells row={g} bold />
                                        </tr>
                                        {g.anak.map((a) => (
                                            <tr key={a.id}>
                                                <td className="py-3 pl-10 pr-4 text-slate-600">{a.nama}</td>
                                                <TotalsCells row={a} />
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                    <td className="px-4 py-3">Total</td>
                                    <TotalsCells row={rekapKategori.total} bold />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {rekapUnit && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Rekap per Unit</p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className={TH}>Unit</th>
                                        <th className={`${TH} text-right`}>Jumlah</th>
                                        <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                        <th className={`${TH} text-right`}>Nilai Buku</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {rekapUnit.baris.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3 font-medium">{u.nama}</td>
                                            <TotalsCells row={u} />
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                        <td className="px-4 py-3">Total</td>
                                        <TotalsCells row={rekapUnit.total} bold />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Daftar Rinci</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>No</th>
                                    {SORTABLE_COLUMNS.map((c) => (
                                        <th
                                            key={c.key}
                                            className={`${TH} ${c.align === 'right' ? 'text-right' : ''}`}
                                            aria-sort={c.sort && sort.urut === c.sort ? (sort.arah === 'asc' ? 'ascending' : 'descending') : undefined}
                                        >
                                            {c.sort ? (
                                                <button type="button" onClick={() => sortBy(c.sort as string)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-blue-700">
                                                    {c.label}
                                                    {sort.urut === c.sort && <span aria-hidden="true">{sort.arah === 'asc' ? '▲' : '▼'}</span>}
                                                </button>
                                            ) : (
                                                c.label
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {asets.data.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Tidak ada aset yang cocok.</td></tr>
                                )}
                                {asets.data.map((a, i) => (
                                    <Fragment key={a.id}>
                                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                                            <td className="px-4 py-3 tabular-nums">
                                                <button type="button" aria-expanded={open === a.id} aria-label={`Detail ${a.nama_aset}`} className="mr-2 text-slate-400 hover:text-blue-700">
                                                    {open === a.id ? '▾' : '▸'}
                                                </button>
                                                {(asets.from ?? 1) + i}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums">{a.kode_barang}</td>
                                            <td className="px-4 py-3 tabular-nums">{a.nomor_register}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900">{a.nama_aset}</p>
                                                {a.merk_type && <p className="text-xs text-slate-500">{a.merk_type}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {a.kategori}
                                                {a.subkategori && <p className="text-xs text-slate-500">{a.subkategori}</p>}
                                            </td>
                                            <td className="px-4 py-3">{a.unit}</td>
                                            <td className="px-4 py-3 tabular-nums">{a.tahun_perolehan}</td>
                                            <td className="px-4 py-3"><Badge label={KONDISI_LABEL[a.kondisi] ?? a.kondisi} style={KONDISI_BADGE[a.kondisi]} /></td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(a.nilai_perolehan)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(a.nilai_buku)}</td>
                                        </tr>
                                        {open === a.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={10} className="px-4 py-4">
                                                    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Pemegang</dt><dd className="text-slate-900">{a.detail.pemegang ?? '—'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Status</dt><dd className="text-slate-900">{a.detail.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Sumber Perolehan</dt><dd className="text-slate-900">{a.detail.sumber_perolehan ?? '—'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">No. Dokumen</dt><dd className="text-slate-900">{a.detail.no_dokumen ?? '—'}</dd></div>
                                                        <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-semibold uppercase text-slate-500">Keterangan</dt><dd className="whitespace-pre-line text-slate-900">{a.detail.keterangan ?? '—'}</dd></div>
                                                    </dl>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{asets.from ?? 0}-{asets.to ?? 0}</span> dari{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">{asets.total}</span> aset
                        </p>
                        {asets.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => visit({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === asets.current_page ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {page}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Docs**

In `docs/superpowers/specs/2026-10-05-laporan-aset-design.md`:
- change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-10-05-laporan-aset.md).`
- in §4.1 add after the output list: "Kunci keluaran bersarang: `rekap_kategori.grup/total` dan `rekap_unit.baris/total`. Persen dibulatkan satu desimal sehingga jumlahnya bisa menyimpang hingga 0,2 dari 100."

In `docs/DETAIL_RBAC_SISTEM.md` change the `**Laporan & Rekapitulasi Excel**` row's last cell to `✅ Selesai: Laporan Aset (`/laporan-aset`, `AssetRecapService`); Mutasi dan Rusak & Hilang menyusul`.

- [ ] **Step 4: Manual verification (browser)** — **SKIPPED by instruction.** The project owner asked for no browser testing until they say so. Ledger it; the checklist for later: sidebar group LAPORAN and no ALAT BANTU; `/laporan-aset` for Kasubag, Camat and an admin kelurahan (unit filter only for multi-unit roles); donut and trend labels (count + compact rupiah), horizontal scroll with many years; row click opens detail; sort headers and pagination; Unduh Excel opens in Excel with logo/kop on every sheet, five sheets (four for a single-unit user), `0007` and totals.

- [ ] **Step 5: Full regression and commit**

Run: `php artisan test`
Expected: all green.

```bash
git add resources/js/Pages/LaporanAset/Index.tsx docs/superpowers/specs/2026-10-05-laporan-aset-design.md docs/DETAIL_RBAC_SISTEM.md
git commit -m "feat: build the Laporan Aset page with charts, recaps and detail list"
```
