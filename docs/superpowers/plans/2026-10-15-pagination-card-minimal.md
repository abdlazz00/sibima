# Pagination Card Minimal Rata Kanan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (eksekusi native, satu sesi). Steps use checkbox (`- [ ]`) syntax. Dua Task = dua tahap bergerbang; **berhenti di akhir tiap Task dan tunggu pengguna menyatakan lolos**.

**Goal:** Semua halaman daftar dan laporan memakai `PaginationCardMinimal` rata kanan berbahasa Indonesia dengan pemilih jumlah per halaman (server-side) dan keterangan total.

**Architecture:** Helper `PerPage::resolve` (daftar putih) di backend; komponen `PaginationCardMinimal` ditulis ulang di `pagination.tsx`; tiap halaman mengganti blok footer lamanya dengan komponen itu.

**Tech Stack:** Laravel 13, Pest, Inertia 2, React 19, Untitled UI (React Aria).

**Spec:** `docs/superpowers/specs/2026-10-15-pagination-card-minimal-design.md`

## Global Constraints

- Daftar putih per halaman `[10, 15, 25, 50, 100]`; bawaan 15 (daftar) / 25 (laporan). Teks UI Indonesia.
- Tombol Sebelumnya/Berikutnya `secondary` (abu-abu), ukuran `md`.
- `per_page` tidak boleh ikut ke unduhan Excel laporan.
- Jangan jalankan Prettier pada berkas halaman lama (diff hanya blok pagination/handler terkait). Pint hanya pada berkas PHP yang diubah (path eksplisit).
- Commit tanpa Co-Authored-By/atribusi Claude, path eksplisit, di `main`, tanpa push.

## Review Focus

- `per_page` tak sah (`7`, `-1`, `abc`, `1000`) → bawaan, tanpa error (tes).
- Ganti jumlah per halaman → halaman 1 dan filter/pencarian/urutan terjaga; pindah halaman sesudahnya mempertahankan `per_page`.
- Data kosong → kartu tidak tampil; halaman terakhir → Berikutnya nonaktif; halaman pertama → Sebelumnya nonaktif.
- Unduhan laporan tidak membawa `per_page`.
- 375 px tanpa meluber.

---

### Task 1 (Tahap 1 – Backend, komponen, dan halaman Aset)

**Files:**
- Create: `app/Support/PerPage.php`, `tests/Unit/PerPageTest.php`, `tests/Feature/PerPageTest.php`
- Modify: `app/Http/Controllers/{AssetController,AssetMutationController,AssetReportController,AssetRequestController,PenerimaanAsetController,UserController,LaporanAsetController,LaporanMutasiController,LaporanRusakHilangController}.php`, `resources/js/Components/ui/application/pagination/pagination.tsx`, `resources/js/Pages/Assets/Index.tsx`

**Interfaces:**
- Produces: `PerPage::OPTIONS` dan `PerPage::resolve(Request, int $default = 15): int`; `PaginationCardMinimal` props `page, total, pageSize, pageSizes?, totalItems?, itemLabel?, onPageChange, onPageSizeChange, className`; konstanta `PAGE_SIZES = [10, 15, 25, 50, 100]` diekspor dari `pagination.tsx`.

- [ ] **Step 1: Tes yang gagal**

`tests/Unit/PerPageTest.php`:
```php
<?php

use App\Support\PerPage;
use Illuminate\Http\Request;

test('it accepts only whitelisted page sizes and falls back to the default', function (mixed $input, int $expected) {
    expect(PerPage::resolve(Request::create('/x', 'GET', ['per_page' => $input])))->toBe($expected);
})->with([
    'allowed int' => [25, 25],
    'allowed string' => ['50', 50],
    'not whitelisted' => [7, 15],
    'negative' => [-1, 15],
    'garbage' => ['abc', 15],
    'too large' => [1000, 15],
]);

test('it uses the given default and ignores a missing parameter', function () {
    expect(PerPage::resolve(Request::create('/x'), 25))->toBe(25)
        ->and(PerPage::resolve(Request::create('/x', 'GET', ['per_page' => 10]), 25))->toBe(10);
});
```
`tests/Feature/PerPageTest.php`:
```php
<?php

use App\Models\Asset;
use Inertia\Testing\AssertableInertia as Assert;

test('the asset list honors a whitelisted page size and exposes it in the filters', function () {
    $kec = makeKecamatan();
    Asset::factory()->count(12)->create(['unit_id' => $kec->id]);
    $user = userWithRole('camat', $kec);

    $this->actingAs($user)->get('/assets?per_page=10')->assertInertia(fn (Assert $page) => $page
        ->has('assets.data', 10)
        ->where('assets.per_page', 10)
        ->where('filters.per_page', 10));

    $this->actingAs($user)->get('/assets?per_page=7')->assertInertia(fn (Assert $page) => $page
        ->has('assets.data', 12)
        ->where('assets.per_page', 15)
        ->where('filters.per_page', 15));
});

test('the asset report detail honors the page size and keeps the default of 25', function () {
    $kec = makeKecamatan();
    Asset::factory()->count(12)->create(['unit_id' => $kec->id]);
    $user = userWithRole('camat', $kec);

    $this->actingAs($user)->get('/laporan-aset?per_page=10')->assertInertia(fn (Assert $page) => $page->where('asets.per_page', 10));
    $this->actingAs($user)->get('/laporan-aset')->assertInertia(fn (Assert $page) => $page->where('asets.per_page', 25));
});
```
Jika factory `Asset` membutuhkan kategori/data lain yang tidak otomatis, ikuti pola `tests/Feature/AssetBrowseTest.php` (buat `AssetCategory` dahulu).

- [ ] **Step 2: Jalankan, pastikan gagal** — `php artisan test --compact tests/Unit/PerPageTest.php tests/Feature/PerPageTest.php` → FAIL (kelas `PerPage` belum ada).

- [ ] **Step 3: Helper**

`app/Support/PerPage.php`:
```php
<?php

namespace App\Support;

use Illuminate\Http\Request;

class PerPage
{
    /** Jumlah baris per halaman yang boleh dipilih pengguna. */
    public const OPTIONS = [10, 15, 25, 50, 100];

    public static function resolve(Request $request, int $default = 15): int
    {
        $value = (int) $request->input('per_page');

        return in_array($value, self::OPTIONS, true) ? $value : $default;
    }
}
```

- [ ] **Step 4: Terapkan di controller** (tambahkan `use App\Support\PerPage;`; baca tiap method `index` sebelum mengedit)

| Controller | Perubahan |
|---|---|
| `AssetController::index` | `$perPage = PerPage::resolve($request);` `paginateVisibleTo($request->user(), $filters, $perPage)`; `'filters' => [...$filters, 'per_page' => $perPage]` |
| `AssetMutationController::index` | `$perPage = PerPage::resolve($request);` `paginateForUser($request->user(), $filters, $perPage)` (ganti literal `15`); `'filters' => [...$filters, 'per_page' => $perPage]` |
| `AssetReportController::index` | `$perPage = PerPage::resolve($request);` ganti `paginate(15)` → `paginate($perPage)`; `'filters' => [...$request->only('search', 'status', 'jenis', 'urut'), 'per_page' => $perPage]` |
| `AssetRequestController::index` | sama dengan di atas (`paginate($perPage)`; filters + `per_page`) |
| `PenerimaanAsetController::index` | sama (`$query->paginate($perPage)`; filters + `per_page`) |
| `UserController::index` | `->paginate($perPage)`; `'filters' => [...$request->only(['search', 'role', 'unit_id', 'status']), 'per_page' => $perPage]` |
| `LaporanAset|Mutasi|RusakHilangController::index` | ganti `->paginate(self::PER_PAGE)` → `->paginate(PerPage::resolve($request, self::PER_PAGE))`; **jangan** masukkan `per_page` ke `$filters` (agar tidak ke unduhan) |

- [ ] **Step 5: Jalankan tes sampai hijau**

```bash
vendor/bin/pint --format agent app/Support/PerPage.php app/Http/Controllers/AssetController.php app/Http/Controllers/AssetMutationController.php app/Http/Controllers/AssetReportController.php app/Http/Controllers/AssetRequestController.php app/Http/Controllers/PenerimaanAsetController.php app/Http/Controllers/UserController.php app/Http/Controllers/LaporanAsetController.php app/Http/Controllers/LaporanMutasiController.php app/Http/Controllers/LaporanRusakHilangController.php tests/Unit/PerPageTest.php tests/Feature/PerPageTest.php
php artisan test --compact tests/Unit/PerPageTest.php tests/Feature/PerPageTest.php
php artisan test --compact --filter='Asset|Mutasi|Penerimaan|Laporan|UserController|AssetRequest|AssetReport'
```
Expected: PASS. Commit backend:
```bash
git add app/Support/PerPage.php app/Http/Controllers tests/Unit/PerPageTest.php tests/Feature/PerPageTest.php
git commit -m "feat(list): accept a whitelisted per_page on list and report endpoints"
```

- [ ] **Step 6: Komponen `PaginationCardMinimal`**

Di `pagination.tsx`, (a) ganti seluruh `MobilePagination` dan `PaginationCardMinimal` (beserta interface props-nya) dengan kode berikut, dan (b) tambahkan `export const PAGE_SIZES = [10, 15, 25, 50, 100];` di bawah impor:
```tsx
interface MobilePaginationProps {
    /** The current page. */
    page?: number;
    /** The total number of pages. */
    total?: number;
    /** The class name of the pagination component. */
    className?: string;
    /** The function to call when the page changes. */
    onPageChange?: (page: number) => void;
}

const MobilePagination = ({ page = 1, total = 10, className, onPageChange }: MobilePaginationProps) => {
    return (
        <nav aria-label="Navigasi halaman" className={cx("flex items-center justify-between md:hidden", className)}>
            <Button
                aria-label="Halaman sebelumnya"
                iconLeading={ArrowLeft}
                color="secondary"
                size="md"
                isDisabled={page <= 1}
                onPress={() => onPageChange?.(Math.max(1, page - 1))}
            />

            <span className="text-sm text-fg-secondary">
                Halaman <span className="font-medium">{page}</span> dari <span className="font-medium">{total}</span>
            </span>

            <Button
                aria-label="Halaman berikutnya"
                iconLeading={ArrowRight}
                color="secondary"
                size="md"
                isDisabled={page >= total}
                onPress={() => onPageChange?.(Math.min(total, page + 1))}
            />
        </nav>
    );
};

interface PaginationCardMinimalProps {
    /** The current page. */
    page?: number;
    /** The total number of pages. */
    total?: number;
    /** The current page size. */
    pageSize?: number;
    /** Page sizes offered in the selector; the selector is hidden when omitted. */
    pageSizes?: number[];
    /** Total number of items, shown next to the page info. */
    totalItems?: number;
    /** Noun for the items, e.g. "aset". */
    itemLabel?: string;
    /** The class name of the pagination component. */
    className?: string;
    /** The function to call when the page changes. */
    onPageChange?: (page: number) => void;
    /** The function to call when the page size changes. */
    onPageSizeChange?: (pageSize: number) => void;
}

export const PaginationCardMinimal = ({
    page = 1,
    total = 1,
    pageSize = 10,
    pageSizes,
    totalItems,
    itemLabel = "data",
    className,
    onPageChange,
    onPageSizeChange,
}: PaginationCardMinimalProps) => {
    const pages = Math.max(total, 1);
    const summary = totalItems !== undefined && (
        <span className="text-base text-secondary tabular-nums">
            · {totalItems.toLocaleString("id-ID")} {itemLabel}
        </span>
    );
    const sizeSelect = pageSizes && (
        <Select
            aria-label="Jumlah per halaman"
            size="sm"
            className="w-36"
            items={pageSizes.map((size) => ({ id: size, label: `${size} per halaman` }))}
            selectedKey={pageSize}
            onSelectionChange={(key) => onPageSizeChange?.(Number(key))}
        >
            {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
    );

    return (
        <div className={cx("border-t border-secondary px-4 py-3 md:px-6 md:pt-3 md:pb-4", className)}>
            <MobilePagination page={page} total={pages} onPageChange={onPageChange} />
            <div className="mt-3 flex flex-wrap items-center gap-3 md:hidden">
                {summary}
                {sizeSelect}
            </div>

            <nav aria-label="Navigasi halaman" className="hidden items-center gap-3 md:flex">
                <span className="text-base font-medium text-secondary">
                    Halaman {page} dari {pages}
                </span>
                {summary}
                {sizeSelect}

                <div className="ml-auto flex items-center gap-3">
                    <Button isDisabled={page <= 1} color="secondary" size="md" iconLeading={ArrowLeft} onPress={() => onPageChange?.(Math.max(1, page - 1))}>
                        Sebelumnya
                    </Button>
                    <Button isDisabled={page >= pages} color="secondary" size="md" iconTrailing={ArrowRight} onPress={() => onPageChange?.(Math.min(pages, page + 1))}>
                        Berikutnya
                    </Button>
                </div>
            </nav>
        </div>
    );
};
```
Komponen lain di berkas itu (`PaginationCardDefault`, `PaginationButtonGroup`, `PaginationCardAdvanced`, dll.) tidak dipakai aplikasi dan tidak disentuh; bila `tsc` mengeluh karena prop `align` lama dipakai komponen lain, sesuaikan hanya pemakaian itu.

- [ ] **Step 7: Halaman Aset** (`Pages/Assets/Index.tsx`)

Ganti impor `PaginationPageDefault` dengan `import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';`. Tambahkan setelah `goToPage`:
```tsx
    const changePageSize = (per_page: number) =>
        router.get(route('assets.index'), { ...filters, per_page, page: undefined }, { preserveState: true, preserveScroll: true });
```
Ganti blok `{/* Pagination */}` (`<div className="flex flex-col gap-3 border-t …">…</div>`) dengan:
```tsx
                    {assets.total > 0 && (
                        <PaginationCardMinimal
                            page={assets.current_page}
                            total={assets.last_page}
                            pageSize={assets.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={assets.total}
                            itemLabel="aset"
                            onPageChange={goToPage}
                            onPageSizeChange={changePageSize}
                        />
                    )}
```
Jika tipe `filters` di berkas itu tidak menerima `per_page`, tambahkan `per_page?: number` ke tipenya.

- [ ] **Step 8: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -3
git add resources/js/Components/ui/application/pagination/pagination.tsx resources/js/Pages/Assets/Index.tsx
git commit -m "feat(ui): right-aligned minimal pagination card with a per-page selector on the asset list"
```
Cek runtime headless (Playwright; pindahkan `public/hot` ke `public/hot.bak` agar memakai build, lalu kembalikan; login kasubag via tombol Enter): `/assets` menampilkan kartu; ganti ke "10 per halaman" → URL memuat `per_page=10`, halaman 1, jumlah baris 10; Berikutnya/Sebelumnya bekerja dan `per_page` terjaga; tanpa galat konsol; tanpa scroll horizontal di 375 px.

- [ ] **Step 9: GERBANG TAHAP 1 — berhenti**

Laporkan hasil dan minta pengguna menilai halaman Data Aset: susunan kartu (info kiri, tombol kanan), teks Indonesia, pemilih per halaman, keterangan total, 375 px, keyboard/fokus. Setelah lolos baru Task 2.

---

### Task 2 (Tahap 2 – Halaman lain)

**Files:**
- Modify: `resources/js/Pages/{AssetMutations,AssetReports,AssetRequests,Penerimaan,Users,Pegawai,AssetCategories}/Index.tsx`, `resources/js/Pages/Laporan{Aset,Mutasi,RusakHilang}/Index.tsx`, `resources/js/Components/ReportDetailTable.tsx`, `resources/js/lib/use-laporan-filters.ts`, `resources/js/Pages/Profile/Partials/ActivityTab.tsx`

- [ ] **Step 1: Halaman server-side yang memakai `go(...)/goTo(...)` (Mutasi, Lapor Rusak/Hilang, Permohonan, Penerimaan)**

Di tiap berkas: ganti impor `PaginationPageDefault` dengan `PAGE_SIZES, PaginationCardMinimal`, dan ganti blok footer (`<div className="flex flex-col gap-3 border-t …">` berisi "Menampilkan …" + `PaginationPageDefault`) dengan komponen berikut (`X` = nama paginator: `mutations` di Mutasi, `items` di tiga lainnya; `NOUN` = `mutasi` / `laporan` / `permohonan` / `penerimaan`; `fn` = `go` (Mutasi, Laporan, Permohonan) atau `goTo` (Penerimaan)):
```tsx
                    {X.total > 0 && (
                        <PaginationCardMinimal
                            page={X.current_page}
                            total={X.last_page}
                            pageSize={X.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={X.total}
                            itemLabel="NOUN"
                            onPageChange={(page) => fn({ page })}
                            onPageSizeChange={(per_page) => fn({ per_page, page: undefined })}
                        />
                    )}
```
Catatan: pada Mutasi blok lama memakai `router.get(... { ...filters, page } ...)` tanpa `replace`; memakai `go({ page })` menambahkan `replace: true` (tidak menumpuk riwayat) dan menyertakan pencarian saat ini — itu perilaku yang diinginkan. Tambahkan `per_page?: number` ke tipe `filters` bila diperlukan agar `tsc` bersih.

- [ ] **Step 2: Pengguna** (`Pages/Users/Index.tsx`)

Ganti impor sama; tambahkan `changePageSize`:
```tsx
    const changePageSize = (per_page: number) => {
        router.get(route('users.index'), { ...filters, per_page, page: undefined }, { preserveState: true, preserveScroll: true });
    };
```
Ganti blok `{/* Pagination */}` (`{users.total > users.per_page && (…)}`) dengan kartu yang sama (`X=users`, `itemLabel="pengguna"`, `onPageChange={goToPage}`, `onPageSizeChange={changePageSize}`) dan syarat `users.total > 0`. Tambahkan `per_page?: number` ke tipe `filters`.

- [ ] **Step 3: Laporan (tiga halaman + `ReportDetailTable` + hook)**

`lib/use-laporan-filters.ts`: tambah parameter opsional `perPage?: number` pada `useLaporanFilters(routeName, downloadRouteName, filters, sort, perPage?)`, dan di `visit` sisipkan `per_page: perPage` ke `clean({ ...base, urut: sort.urut, arah: sort.arah, per_page: perPage, ...extra })` (sehingga ikut terbawa saat mengurutkan/memfilter/pindah halaman, dan `extra.per_page` menimpa). `downloadUrl` tetap dibangun dari `filters` (tanpa `per_page`).

`ReportDetailTable.tsx`: ganti impor ke `PAGE_SIZES, PaginationCardMinimal`; tambah prop `onPageSize: (perPage: number) => void`; ganti blok footer (baris "Menampilkan …" + `PaginationPageDefault`) dengan:
```tsx
            {paginator.total > 0 && (
                <PaginationCardMinimal
                    page={paginator.current_page}
                    total={paginator.last_page}
                    pageSize={paginator.per_page}
                    pageSizes={PAGE_SIZES}
                    totalItems={paginator.total}
                    itemLabel={unit}
                    onPageChange={onPage}
                    onPageSizeChange={onPageSize}
                />
            )}
```
Di tiga halaman laporan: teruskan `paginator.per_page` sebagai argumen kelima `useLaporanFilters(..., asets.per_page)` (Mutasi: `mutasis.per_page`; Rusak/Hilang: variabel paginatornya) dan tambahkan prop `onPageSize={(per_page) => visit({ per_page, page: undefined })}` di pemakaian `<ReportDetailTable>`.

- [ ] **Step 4: Pegawai (client-side)** (`Pages/Pegawai/Index.tsx`)

Ganti impor `PaginationPageDefault` dengan `PaginationCardMinimal` (dan hapus impor `Select` bila tak terpakai lagi). Ganti seluruh blok `{/* Pagination Bar */}` (kartu dengan "Menampilkan … Per halaman: … `PaginationPageDefault`") dengan:
```tsx
                {filteredPegawais.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                        <PaginationCardMinimal
                            className="border-t-0"
                            page={safeCurrentPage}
                            total={totalPages}
                            pageSize={itemsPerPage}
                            pageSizes={PAGE_SIZE_OPTIONS}
                            totalItems={filteredPegawais.length}
                            itemLabel="pegawai"
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                                setItemsPerPage(size);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                )}
```
(`PAGE_SIZE_OPTIONS = [6, 12, 24, 48]` yang ada dipertahankan.)

- [ ] **Step 5: Kategori Aset dan tab Aktivitas Profil**

`Pages/AssetCategories/Index.tsx`: ganti impor ke `PaginationCardMinimal`; ganti blok "Table Footer with Pagination" dengan:
```tsx
                    {categories.length > 0 && (
                        <PaginationCardMinimal
                            page={currentPage}
                            total={totalPages}
                            totalItems={categories.length}
                            itemLabel="kategori"
                            onPageChange={setCurrentPage}
                        />
                    )}
```
`Pages/Profile/Partials/ActivityTab.tsx`: ganti `PaginationPageDefault` (dan pembungkus `border-t` di sekitarnya) dengan:
```tsx
            {aktivitas && aktivitas.total > 0 && (
                <PaginationCardMinimal
                    className="mt-4"
                    page={aktivitas.current_page}
                    total={aktivitas.last_page}
                    totalItems={aktivitas.total}
                    itemLabel="aktivitas"
                    onPageChange={(page) => load(filter, page)}
                />
            )}
```
(sesuaikan nama variabel dengan kode saat ini).

- [ ] **Step 6: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -3
grep -rn "PaginationPageDefault" resources/js --include=*.tsx | grep -v "ui/"
php artisan test --compact --filter='Asset|Mutasi|Penerimaan|Laporan|UserController|Profile|Activity|PerPage'
```
Expected: `grep` hanya menyisakan `AssetSelectModal.tsx`; build/tes bersih. Cek runtime headless untuk Mutasi, Lapor Rusak/Hilang, Permohonan, Penerimaan, Pengguna (superadmin), Pegawai, Kategori, tiga Laporan (ganti jumlah per halaman; pastikan tautan Unduh Excel tidak memuat `per_page`), dan tab Aktivitas Profil; tanpa galat konsol dan tanpa scroll horizontal di 375 px. Lalu:
```bash
git add resources/js
git commit -m "feat(ui): minimal pagination card with per-page selector on all list, report, pegawai, category, and activity views"
```

- [ ] **Step 7: Suite penuh dan GERBANG TAHAP 2 — berhenti**

Jalankan suite penuh di latar belakang (`php artisan test --compact`, ±15 menit) dan laporkan. Minta pengguna menilai semua halaman daftar/laporan. Setelah lolos: perbarui memori proyek dan tanyakan persetujuan sebelum push.

---

## Catatan Self-Review

- Cakupan spec: helper + semua controller (Task 1), komponen (Task 1), semua halaman (Task 1 Aset + Task 2 sisanya), terjemahan dan perbaikan bug bawaan (Step 6), unduhan tanpa `per_page` (Task 1 Step 4 dan Task 2 Step 3), Review Focus punya tes/cek runtime.
- Konsistensi: `PAGE_SIZES`, `PaginationCardMinimal` props, dan `per_page` sama di semua langkah.
- Risiko: nama variabel/tipe `filters` tiap halaman berbeda; `tsc` menjadi pagar. Test `Asset::factory()` mungkin perlu kategori (lihat `AssetBrowseTest`).

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: tidak ada yang dipangkas (satu helper, satu komponen, tiap halaman hanya mengganti blok footer).
- Impeccable (Operate, pengguna lansia): tombol Sebelumnya/Berikutnya tetap abu-abu tetapi diberi ikon panah sebagai penanda arah; teks "Halaman X dari Y" dan jumlah total naik ke 16px. Tanpa lompat ke halaman tertentu (jumlah halaman kecil).
