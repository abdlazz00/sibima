# Kartu Filter, Pencarian di Tabel, dan Urutan Halaman Transaksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Penerimaan Aset, Mutasi Aset, Permohonan Aset, dan Lapor Rusak/Hilang memakai kartu filter (grid dropdown), pencarian di baris atas kartu tabel, dan dropdown "Urutkan" (Terbaru/Terlama); pencarian dan filter jenis di Mutasi Aset diperbaiki agar benar-benar bekerja.

**Architecture:** `App\Support\ListSort` menerapkan urutan dari daftar kunci (`SORTS`) ke query dan membuat opsi dropdown. Tiap halaman memakai tiga komponen bersama di `resources/js/Components/ListFilters.tsx` (`FilterCard`, `FilterSelect`, `TableSearch`). Pekerjaan dibagi per halaman agar tiap task punya siklus tes sendiri.

**Tech Stack:** Laravel 13, Pest (SQLite `:memory:`), Inertia + React/TypeScript, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-10-05-filter-urutan-halaman-transaksi-design.md`

## Global Constraints

- Parameter `urut` berisi kunci `terbaru` (default, urutan sekarang) atau `terlama`; nilai tak dikenal, kosong, atau bukan string jatuh ke `terbaru` tanpa error; nilai request tidak pernah menjadi nama kolom.
- Urutan per halaman: Penerimaan `tanggal_penerimaan`+`id`; Mutasi `tanggal_mutasi`+`id`; Permohonan `id`; Lapor `tanggal_kejadian`+`id` (arah desc untuk `terbaru`, asc untuk `terlama`).
- Hak akses/cakupan unit dan semua filter yang ada tidak berubah. Data Aset tidak disentuh.
- Tanpa migrasi, permission baru, atau `FormRequest` baru.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude**, jangan push.
- Jangan menguji lewat browser kecuali pengguna memerintahkan; frontend diverifikasi dengan `npx tsc --noEmit` dan `npm run build`.
- Nama fungsi helper Pest harus unik antar berkas; helper baru berawalan `ls`.
- Edit berkas PHP bernamespace dengan alat Edit; skrip TSX tanpa backslash boleh lewat Python dari berkas (simpan dengan alat Write ke folder scratchpad).
- `php artisan test` penuh lebih dari 2 menit: jalankan di latar belakang atau pakai `--filter`.

## Review Focus

Kondisi yang tersirat di spec tetapi tidak disebut tegas, urut dari yang paling mungkin terjadi pada pengguna:

1. **Pencarian Mutasi tidak boleh membocorkan mutasi unit lain:** `search`/`jenis` harus digabung AND dengan cakupan unit, bukan OR. Diuji di Task 5.
2. **Pencarian Mutasi lewat item/unit tidak boleh menggandakan baris** (satu mutasi dengan banyak item cocok tetap satu baris). Diuji di Task 5.
3. **Tanggal sama (banyak dokumen di hari yang sama):** urutan stabil dengan `id` sebagai pembeda di semua halaman. Diuji di Task 2, 4, 5 (Permohonan memakai `id` langsung).
4. **Pindah ke halaman 2:** `urut` (dan filter lain) tidak hilang, termasuk di Mutasi yang dulu tidak memakai `withQueryString()`. Diuji di Task 2-5.
5. **`urut` ngawur atau berupa array di URL:** jatuh ke default, tidak 500. Diuji di Task 1 (unit) dan Task 2.
6. **Pencarian dan jenis Mutasi aktif bersamaan:** hasil memenuhi keduanya. Diuji di Task 5.

---

## File Structure

| Berkas | Perubahan |
|---|---|
| `app/Support/ListSort.php` | Baru: `apply()` dan `options()`. |
| `resources/js/Components/ListFilters.tsx` | Baru: `FilterCard`, `FilterSelect`, `TableSearch`. |
| `app/Http/Controllers/{AssetReport,AssetRequest,PenerimaanAsset,AssetMutation}Controller.php` | `SORTS`, `urut`, `sortOptions` (Mutasi: filter, lihat Task 5). |
| `app/Models/AssetMutation.php`, `app/Repositories/AssetMutationRepository.php`, `app/Repositories/Contracts/AssetMutationRepositoryInterface.php` | Mutasi: `SORTS`, `paginateForUser` menerima filter. |
| `resources/js/Pages/{AssetReports,AssetRequests,Penerimaan,AssetMutations}/Index.tsx` | Kartu filter + pencarian di kartu tabel + Urutkan. |
| `tests/Feature/ListSortTest.php`, `tests/Feature/ListSortPagesTest.php`, `tests/Feature/AssetMutationIndexFilterTest.php` | Pengujian baru. |

---

### Task 1: `ListSort`

**Files:**
- Create: `app/Support/ListSort.php`, `tests/Feature/ListSortTest.php`

**Interfaces:**
- Produces: `ListSort::apply(Builder $query, array $sorts, mixed $key): Builder` (kunci pertama `$sorts` menjadi default); `ListSort::options(array $sorts): array` (`[{value, label}]`). Format `$sorts`: `kunci => ['label' => string, 'order' => list<[kolom, arah]>]`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ListSortTest.php`:

```php
<?php

use App\Models\User;
use App\Support\ListSort;

const LS_SORTS = [
    'terbaru' => ['label' => 'Terbaru', 'order' => [['created_at', 'desc'], ['id', 'desc']]],
    'terlama' => ['label' => 'Terlama', 'order' => [['created_at', 'asc'], ['id', 'asc']]],
];

function lsSql($key): string
{
    return ListSort::apply(User::query(), LS_SORTS, $key)->toSql();
}

it('applies the chosen order with its tie-break', function () {
    expect(lsSql('terlama'))->toContain('order by "created_at" asc, "id" asc')
        ->and(lsSql('terbaru'))->toContain('order by "created_at" desc, "id" desc');
});

it('falls back to the first key for an unknown, empty, null or non-string value', function () {
    $default = 'order by "created_at" desc, "id" desc';

    foreach (['ngawur', '', null, ['terlama'], 5, 'created_at; drop table users'] as $key) {
        expect(lsSql($key))->toContain($default);
    }
});

it('lists the options with value and label in declaration order', function () {
    expect(ListSort::options(LS_SORTS))->toBe([
        ['value' => 'terbaru', 'label' => 'Terbaru'],
        ['value' => 'terlama', 'label' => 'Terlama'],
    ]);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ListSortTest`
Expected: FAIL (`Class "App\Support\ListSort" not found`).

- [ ] **Step 3: Implementasi**

`app/Support/ListSort.php`:

```php
<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/** Urutan daftar yang dipilih pengguna lewat kunci; kolom hanya berasal dari daftar tetap, tidak pernah dari request. */
final class ListSort
{
    /** @param array<string, array{label: string, order: list<array{0: string, 1: string}>}> $sorts */
    public static function apply(Builder $query, array $sorts, mixed $key): Builder
    {
        $chosen = is_string($key) && isset($sorts[$key]) ? $sorts[$key] : reset($sorts);

        foreach ($chosen['order'] as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        return $query;
    }

    /**
     * @param  array<string, array{label: string, order: list<array{0: string, 1: string}>}>  $sorts
     * @return list<array{value: string, label: string}>
     */
    public static function options(array $sorts): array
    {
        return array_map(
            fn (string $key) => ['value' => $key, 'label' => $sorts[$key]['label']],
            array_keys($sorts),
        );
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ListSortTest`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add app/Support/ListSort.php tests/Feature/ListSortTest.php
git commit -m "feat(support): add ListSort for key-based list ordering"
```

---

### Task 2: Komponen bersama dan Lapor Rusak/Hilang

**Files:**
- Create: `resources/js/Components/ListFilters.tsx`, `tests/Feature/ListSortPagesTest.php`
- Modify: `app/Http/Controllers/AssetReportController.php`, `resources/js/Pages/AssetReports/Index.tsx`

**Interfaces:**
- Consumes: `ListSort` (Task 1).
- Produces: prop halaman `sortOptions` dan `filters.urut`; komponen `FilterCard({ children, action? })`, `FilterSelect({ value, onChange(value: string), ariaLabel, children })`, `TableSearch({ value, onChange(value: string), onSubmit, onClear, placeholder })`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ListSortPagesTest.php`:

```php
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ListSortPagesTest`
Expected: FAIL (urutan `terlama` belum berlaku, `sortOptions` belum ada).

- [ ] **Step 3: Backend**

`app/Http/Controllers/AssetReportController.php` (alat Edit):
1. Tambah `use App\Support\ListSort;` tepat sebelum `use Illuminate\Http\Request;`.
2. Tepat sebelum `    public function index(Request $request): Response` tambahkan:

```php
    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['tanggal_kejadian', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['tanggal_kejadian', 'asc'], ['id', 'asc']]],
    ];

```

3. Ganti `        $items = AssetReport::with(` dengan `        $query = AssetReport::with(`.
4. Ganti

```php
            ))
            ->latest('tanggal_kejadian')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();
```

dengan:

```php
            ));

        $items = ListSort::apply($query, self::SORTS, $request->input('urut'))->paginate(15)->withQueryString();
```

5. Ganti `'filters' => $request->only('search', 'status', 'jenis'),` dengan `'filters' => $request->only('search', 'status', 'jenis', 'urut'),\n            'sortOptions' => ListSort::options(self::SORTS),`.

- [ ] **Step 4: Komponen bersama**

Simpan dengan alat Write ke `resources/js/Components/ListFilters.tsx`:

```tsx
import { ChevronDownIcon as ChevronDown, SearchIcon as Search, XIcon as X } from '@/Components/Icons';
import { FormEvent, PropsWithChildren, ReactNode } from 'react';

/** Kartu filter: grid dropdown rata (1/2/4 kolom). `action` tampil di bawah grid (mis. "Reset filter"). */
export function FilterCard({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

export function FilterSelect({
    value,
    onChange,
    ariaLabel,
    children,
}: PropsWithChildren<{ value: string; onChange: (value: string) => void; ariaLabel: string }>) {
    return (
        <div className="relative">
            <select
                aria-label={ariaLabel}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
    );
}

/** Baris pencarian di bagian atas kartu tabel. */
export function TableSearch({
    value,
    onChange,
    onSubmit,
    onClear,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: FormEvent) => void;
    onClear: () => void;
    placeholder: string;
}) {
    return (
        <div className="border-b border-slate-200 p-4">
            <form onSubmit={onSubmit} className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    aria-label="Cari"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {value && (
                    <button
                        type="button"
                        aria-label="Hapus pencarian"
                        onClick={onClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </form>
        </div>
    );
}
```

- [ ] **Step 5: Halaman Lapor Rusak/Hilang**

Simpan dengan alat Write ke `C:/Users/ABDULA~1/AppData/Local/Temp/claude/C--Users-abdulaziz-Documents-pribadi-SIBIMA/b39db684-e281-401f-8853-ec1e845ccf18/scratchpad/ls_reports.py`, jalankan dari root repo:

```python
path = 'resources/js/Pages/AssetReports/Index.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, ", SearchIcon as Search } from '@/Components/Icons';\n", " } from '@/Components/Icons';\nimport { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';\n")
s = once(s, "filters: { search?: string; status?: string; jenis?: string };", "filters: { search?: string; status?: string; jenis?: string; urut?: string };\n    sortOptions: { value: string; label: string }[];")
s = once(s, "const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';\n\n", "")
s = once(s, "export default function Index({ items, filters, can }: IndexProps) {", "export default function Index({ items, filters, sortOptions, can }: IndexProps) {")

START = '                <div className="flex flex-wrap items-end gap-3">\n                    <form onSubmit={submitSearch}'
END = '                </div>\n\n                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">\n'
i = s.index(START)
j = s.index(END, i) + len(END)

NEW = """                <FilterCard>
                    <FilterSelect ariaLabel="Status" value={filters.status ?? ''} onChange={(v) => go({ status: v || undefined, page: undefined })}>
                        <option value="">Semua status</option>
                        {Object.entries(REPORT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Jenis" value={filters.jenis ?? ''} onChange={(v) => go({ jenis: v || undefined, page: undefined })}>
                        <option value="">Semua jenis</option>
                        {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => go({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                </FilterCard>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            go({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari nomor laporan atau nama aset..."
                    />
"""
s = s[:i] + NEW + s[j:]
assert '<Search ' not in s
open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 6: Jalankan, pastikan lulus, lalu verifikasi frontend**

Run: `php artisan test --filter="ListSortPagesTest|AssetReportControllerTest"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: test PASS; skrip mencetak `ok`; `tsc` tanpa error; build sukses.

- [ ] **Step 7: Commit**

```bash
git add resources/js/Components/ListFilters.tsx app/Http/Controllers/AssetReportController.php resources/js/Pages/AssetReports/Index.tsx tests/Feature/ListSortPagesTest.php
git commit -m "feat(reports): filter card, table search and sort on the Lapor Rusak/Hilang list"
```

---

### Task 3: Permohonan Aset

**Files:**
- Modify: `app/Http/Controllers/AssetRequestController.php`, `resources/js/Pages/AssetRequests/Index.tsx`, `tests/Feature/ListSortPagesTest.php` (tambah test di akhir)

**Interfaces:**
- Consumes: `ListSort`, `ListFilters.tsx` (Task 1-2).
- Produces: prop `sortOptions`, `filters.urut` pada halaman Permohonan.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `tests/Feature/ListSortPagesTest.php` (dan `use App\Models\AssetRequest;` di bagian `use` atas):

```php

it('sorts Permohonan Aset by id, newest first by default and oldest first on request', function () {
    $pegawai = App\Models\Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $ids = [];
    foreach (range(1, 3) as $i) {
        $ids[] = AssetRequest::factory()->create(['pegawai_id' => $pegawai->id, 'unit_id' => $this->kec->id])->id;
    }

    expect(lsIds($this, '/asset-requests'))->toBe(array_reverse($ids))
        ->and(lsIds($this, '/asset-requests?urut=terlama'))->toBe($ids)
        ->and(lsIds($this, '/asset-requests?urut=ngawur'))->toBe(array_reverse($ids));
});

it('keeps urut on the next page of Permohonan Aset and sends the sort options', function () {
    $pegawai = App\Models\Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    foreach (range(1, 16) as $i) {
        AssetRequest::factory()->create(['pegawai_id' => $pegawai->id, 'unit_id' => $this->kec->id]);
    }

    $this->actingAs($this->kasubag)->get('/asset-requests?urut=terlama')
        ->assertInertia(fn ($page) => $page
            ->where('filters.urut', 'terlama')
            ->has('sortOptions', 2)
            ->where('items.next_page_url', fn ($url) => str_contains($url, 'urut=terlama')));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ListSortPagesTest`
Expected: FAIL pada dua test Permohonan (test Lapor tetap lulus).

- [ ] **Step 3: Backend**

`app/Http/Controllers/AssetRequestController.php` (alat Edit):
1. Tambah `use App\Support\ListSort;` tepat sebelum `use Illuminate\Http\Request;`.
2. Tepat sebelum `    public function index(Request $request): Response` tambahkan:

```php
    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['id', 'asc']]],
    ];

```

3. Ganti `        $items = AssetRequest::with(` dengan `        $query = AssetRequest::with(`.
4. Ganti

```php
            ))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();
```

dengan:

```php
            ));

        $items = ListSort::apply($query, self::SORTS, $request->input('urut'))->paginate(15)->withQueryString();
```

5. Ganti `'filters' => $request->only('search', 'status', 'jenis', 'menunggu_pemenuhan'),` dengan `'filters' => $request->only('search', 'status', 'jenis', 'menunggu_pemenuhan', 'urut'),\n            'sortOptions' => ListSort::options(self::SORTS),`.

- [ ] **Step 4: Halaman**

Simpan dengan alat Write ke `.../scratchpad/ls_requests.py`, jalankan dari root repo:

```python
path = 'resources/js/Pages/AssetRequests/Index.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, ", SearchIcon as Search } from '@/Components/Icons';\n", " } from '@/Components/Icons';\nimport { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';\n")
s = once(s, "filters: { search?: string; status?: string; jenis?: string; menunggu_pemenuhan?: string };", "filters: { search?: string; status?: string; jenis?: string; menunggu_pemenuhan?: string; urut?: string };\n    sortOptions: { value: string; label: string }[];")
s = once(s, "const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';\n\n", "")
s = once(s, "export default function Index({ items, filters, can }: IndexProps) {", "export default function Index({ items, filters, sortOptions, can }: IndexProps) {")

START = '                <div className="flex flex-wrap items-end gap-3">\n                    <form onSubmit={submitSearch}'
END = '                </div>\n\n                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">\n'
i = s.index(START)
j = s.index(END, i) + len(END)

NEW = """                <FilterCard>
                    <FilterSelect ariaLabel="Status" value={filters.status ?? ''} onChange={(v) => go({ status: v || undefined, page: undefined })}>
                        <option value="">Semua status</option>
                        {Object.entries(REQUEST_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Jenis" value={filters.jenis ?? ''} onChange={(v) => go({ jenis: v || undefined, page: undefined })}>
                        <option value="">Semua jenis</option>
                        {Object.entries(REQUEST_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => go({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                    <button
                        type="button"
                        aria-pressed={waiting}
                        onClick={() => go({ menunggu_pemenuhan: waiting ? undefined : '1', page: undefined })}
                        className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-sm ${waiting ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                        Menunggu Pemenuhan
                    </button>
                </FilterCard>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            go({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari nomor permohonan atau keterangan..."
                    />
"""
s = s[:i] + NEW + s[j:]
assert '<Search ' not in s
open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 5: Jalankan dan verifikasi**

Run: `php artisan test --filter="ListSortPagesTest|AssetRequestControllerTest"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: test PASS; skrip `ok`; `tsc` dan build bersih.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/AssetRequestController.php resources/js/Pages/AssetRequests/Index.tsx tests/Feature/ListSortPagesTest.php
git commit -m "feat(requests): filter card, table search and sort on the Permohonan Aset list"
```

---

### Task 4: Penerimaan Aset

**Files:**
- Modify: `app/Http/Controllers/PenerimaanAsetController.php`, `resources/js/Pages/Penerimaan/Index.tsx`, `tests/Feature/ListSortPagesTest.php`

**Interfaces:**
- Consumes: `ListSort`, `ListFilters.tsx`.
- Produces: prop `sortOptions`, `filters.urut` pada halaman Penerimaan.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `tests/Feature/ListSortPagesTest.php` (dan `use App\Models\BeritaAcaraPenerimaan;` di atas):

```php

function lsBa(object $t, string $tanggal, string $nomor): BeritaAcaraPenerimaan
{
    return BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $nomor, 'tanggal_penerimaan' => $tanggal, 'sumber_perolehan' => 'APBD',
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
```

Catatan: bila `create` menolak karena kolom `NOT NULL` lain (mis. `vendor`), isi kolom itu dengan nilai tetap sesuai migrasi `berita_acara_penerimaans`; tujuan test tidak berubah.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ListSortPagesTest`
Expected: FAIL pada dua test Penerimaan.

- [ ] **Step 3: Backend**

`app/Http/Controllers/PenerimaanAsetController.php` (alat Edit):
1. Tambah `use App\Support\ListSort;` tepat sebelum `use Illuminate\Http\Request;`.
2. Tepat sebelum `    public function index(Request $request): Response` tambahkan:

```php
    private const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['tanggal_penerimaan', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['tanggal_penerimaan', 'asc'], ['id', 'asc']]],
    ];

```

3. Ganti

```php
            ->when($request->sampai, fn (Builder $q, $sampai) => $q->whereDate('tanggal_penerimaan', '<=', $sampai))
            ->latest('tanggal_penerimaan')
            ->latest('id');
```

dengan:

```php
            ->when($request->sampai, fn (Builder $q, $sampai) => $q->whereDate('tanggal_penerimaan', '<=', $sampai));

        ListSort::apply($query, self::SORTS, $request->input('urut'));
```

4. Ganti `'filters' => $request->only('search', 'status', 'dari', 'sampai'),` dengan `'filters' => $request->only('search', 'status', 'dari', 'sampai', 'urut'),\n            'sortOptions' => ListSort::options(self::SORTS),`.

- [ ] **Step 4: Halaman**

Simpan dengan alat Write ke `.../scratchpad/ls_penerimaan.py`, jalankan dari root repo:

```python
path = 'resources/js/Pages/Penerimaan/Index.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, ", SearchIcon as Search } from '@/Components/Icons';\n", " } from '@/Components/Icons';\nimport { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';\n")
s = once(s, "filters: { search?: string; status?: string; dari?: string; sampai?: string };", "filters: { search?: string; status?: string; dari?: string; sampai?: string; urut?: string };\n    sortOptions: { value: string; label: string }[];")
s = once(s, "export default function Index({ items, filters, can }: IndexProps) {",
         "const DATE_INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';\nconst DATE_LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';\n\nexport default function Index({ items, filters, sortOptions, can }: IndexProps) {")

START = '                <form onSubmit={submitSearch} className="relative max-w-md">'
END = '                </div>\n\n                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">\n'
i = s.index(START)
j = s.index(END, i) + len(END)

NEW = """                <FilterCard
                    action={
                        (filters.status || filters.dari || filters.sampai) && (
                            <button
                                type="button"
                                onClick={() => goTo({ status: undefined, dari: undefined, sampai: undefined, page: undefined })}
                                className="text-sm font-medium text-blue-700 hover:underline"
                            >
                                Reset filter
                            </button>
                        )
                    }
                >
                    <FilterSelect ariaLabel="Status" value={filters.status ?? ''} onChange={(v) => goTo({ status: v || undefined, page: undefined })}>
                        <option value="">Semua status</option>
                        {(Object.keys(PENERIMAAN_STATUS_LABEL) as PenerimaanStatusKey[]).map((key) => (
                            <option key={key} value={key}>{PENERIMAAN_STATUS_LABEL[key]}</option>
                        ))}
                    </FilterSelect>
                    <div>
                        <label htmlFor="filter-dari" className={DATE_LABEL}>Dari tanggal</label>
                        <input id="filter-dari" type="date" value={filters.dari ?? ''} onChange={(e) => goTo({ dari: e.target.value || undefined, page: undefined })} className={DATE_INPUT} />
                    </div>
                    <div>
                        <label htmlFor="filter-sampai" className={DATE_LABEL}>Sampai tanggal</label>
                        <input id="filter-sampai" type="date" value={filters.sampai ?? ''} onChange={(e) => goTo({ sampai: e.target.value || undefined, page: undefined })} className={DATE_INPUT} />
                    </div>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => goTo({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                </FilterCard>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            goTo({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari no. berita acara atau nama aset..."
                    />
"""
s = s[:i] + NEW + s[j:]
assert '<Search ' not in s
open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 5: Jalankan dan verifikasi**

Run: `php artisan test --filter="ListSortPagesTest|PenerimaanAset"`, lalu `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: test PASS; skrip `ok`; `tsc` dan build bersih.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/PenerimaanAsetController.php resources/js/Pages/Penerimaan/Index.tsx tests/Feature/ListSortPagesTest.php
git commit -m "feat(penerimaan): filter card, table search and sort on the Penerimaan Aset list"
```

---

### Task 5: Mutasi Aset (perbaikan pencarian/jenis, urutan, tampilan) dan verifikasi akhir

**Files:**
- Create: `tests/Feature/AssetMutationIndexFilterTest.php`
- Modify: `app/Models/AssetMutation.php`, `app/Repositories/AssetMutationRepository.php`, `app/Repositories/Contracts/AssetMutationRepositoryInterface.php`, `app/Http/Controllers/AssetMutationController.php`, `resources/js/Pages/AssetMutations/Index.tsx`

**Interfaces:**
- Consumes: `ListSort`, `ListFilters.tsx`.
- Produces: `AssetMutation::SORTS`; `paginateForUser(User $user, array $filters = [], int $perPage = 15)` yang membaca `search`, `jenis`, `urut` dan memakai `withQueryString()`; prop halaman `filters` (`search`, `jenis`, `urut`) dan `sortOptions`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/AssetMutationIndexFilterTest.php`:

```php
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=AssetMutationIndexFilterTest`
Expected: FAIL (search/jenis diabaikan, `filters` dan `sortOptions` tidak ada).

- [ ] **Step 3: Backend**

`app/Models/AssetMutation.php` (alat Edit): tepat sebelum `    public function unit(): BelongsTo` (relasi yang ditambah di pekerjaan Pengembalian) tambahkan:

```php
    /** Urutan daftar Mutasi Aset (dipakai repositori). */
    public const SORTS = [
        'terbaru' => ['label' => 'Terbaru', 'order' => [['tanggal_mutasi', 'desc'], ['id', 'desc']]],
        'terlama' => ['label' => 'Terlama', 'order' => [['tanggal_mutasi', 'asc'], ['id', 'asc']]],
    ];

```

`app/Repositories/Contracts/AssetMutationRepositoryInterface.php`: ganti `public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator;` dengan `public function paginateForUser(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator;`.

`app/Repositories/AssetMutationRepository.php` (alat Edit): ganti seluruh method `paginateForUser` dengan:

```php
    public function paginateForUser(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = AssetMutation::with(['originUnit', 'destinationUnit', 'creator', 'items'])
            ->when($filters['jenis'] ?? null, fn ($q, $jenis) => $q->where('jenis_mutasi', $jenis))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('nomor_mutasi', 'like', "%{$search}%")
                ->orWhereHas('items.asset', fn ($a) => $a->where('nama_aset', 'like', "%{$search}%"))
                ->orWhereHas('originUnit', fn ($u) => $u->where('name', 'like', "%{$search}%"))
                ->orWhereHas('destinationUnit', fn ($u) => $u->where('name', 'like', "%{$search}%"))
            ));

        ListSort::apply($query, AssetMutation::SORTS, $filters['urut'] ?? null);

        $accessibleUnitIds = $user->accessibleUnitIds();
        if ($accessibleUnitIds !== null) {
            $query->where(function ($q) use ($accessibleUnitIds) {
                $q->whereIn('origin_unit_id', $accessibleUnitIds)
                    ->orWhereIn('destination_unit_id', $accessibleUnitIds);
            });
        }

        return $query->paginate($perPage)->withQueryString();
    }
```

dan tambahkan `use App\Support\ListSort;` pada daftar `use` berkas itu.

`app/Http/Controllers/AssetMutationController.php` (alat Edit): tambah `use App\Support\ListSort;` tepat sebelum `use Illuminate\Http\Request;`; ganti

```php
        $mutations = $this->repository->paginateForUser($request->user(), 15);

        return Inertia::render('AssetMutations/Index', [
            'mutations' => $mutations,
```

dengan:

```php
        $filters = $request->only('search', 'jenis', 'urut');
        $mutations = $this->repository->paginateForUser($request->user(), $filters, 15);

        return Inertia::render('AssetMutations/Index', [
            'mutations' => $mutations,
            'filters' => $filters,
            'sortOptions' => ListSort::options(AssetMutation::SORTS),
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="AssetMutationIndexFilterTest|AssetMutationEndToEndTest|AssetMutationHardeningTest|PengembalianAsetTest"`
Expected: PASS. Bila ada test lain yang memanggil `paginateForUser` dengan argumen posisi `(user, 15)`, ubah menjadi `(user, [], 15)` (`grep -rn paginateForUser app tests` hanya menemukan controller).

- [ ] **Step 5: Halaman Mutasi**

Simpan dengan alat Write ke `.../scratchpad/ls_mutations.py`, jalankan dari root repo:

```python
import re

path = 'resources/js/Pages/AssetMutations/Index.tsx'
s = open(path, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')


def once(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)


s = once(s, "import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';\n",
         "import { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';\nimport AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';\n")
s = once(s, "filters?: { search?: string; jenis?: string };", "filters?: { search?: string; jenis?: string; urut?: string };\n    sortOptions: { value: string; label: string }[];")
s = once(s, "export default function Index({ mutations, filters = {}, can }: IndexProps) {", "export default function Index({ mutations, filters = {}, sortOptions, can }: IndexProps) {")

# state dan handler: satu fungsi go() seperti halaman lain
a = s.index("    const [selectedType, setSelectedType]")
b = s.index("    return (\n        <AuthenticatedLayout>", a)
HANDLERS = """    const pages = pageNumbersWithGaps(mutations.current_page, mutations.last_page);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-mutations.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

"""
s = s[:a] + HANDLERS + s[b:]

# filter + pencarian
START = '                {/* Filters & Search */}\n'
END = '                {/* Table Section */}\n                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">\n'
i = s.index(START)
j = s.index(END, i) + len(END)
NEW = """                <FilterCard>
                    <FilterSelect ariaLabel="Jenis alur" value={filters.jenis ?? ''} onChange={(v) => go({ jenis: v || undefined, page: undefined })}>
                        <option value="">Semua Alur</option>
                        {(Object.keys(MUTATION_TYPE_LABEL) as MutationType[]).map((type) => (
                            <option key={type} value={type}>{MUTATION_TYPE_LABEL[type]}</option>
                        ))}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => go({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                </FilterCard>

                {/* Table Section */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            go({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari no. mutasi, nama aset, atau unit..."
                    />
"""
s = s[:i] + NEW + s[j:]

# paginasi membawa urut
s, n = re.subn(r"\n( +)jenis: filters\.jenis,", lambda m: "\n" + m.group(1) + "jenis: filters.jenis,\n" + m.group(1) + "urut: filters.urut,", s)
assert n == 3, n
assert 'selectedType' not in s and 'handleTypeChange' not in s and 'applyFilter' not in s

open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
print('ok')
```

- [ ] **Step 6: Verifikasi frontend**

Run: `python <path skrip>`, `npx tsc --noEmit`, `npm run build`
Expected: skrip `ok` (semua `assert` lolos); `tsc` tanpa error (ikon `Search` masih dipakai di keadaan kosong halaman ini, jadi impornya tetap); build sukses.

- [ ] **Step 7: Suite penuh**

Run (latar belakang): `php artisan test`
Expected: seluruh suite hijau (baseline 632 + test baru). Perbaiki regresi sebelum lanjut.

- [ ] **Step 8: Commit**

```bash
git add app/Models/AssetMutation.php app/Repositories/AssetMutationRepository.php app/Repositories/Contracts/AssetMutationRepositoryInterface.php app/Http/Controllers/AssetMutationController.php resources/js/Pages/AssetMutations/Index.tsx tests/Feature/AssetMutationIndexFilterTest.php
git commit -m "feat(mutations): working search and jenis filter, sort, and the filter card layout on the Mutasi Aset list"
```
