# Laporan Rusak & Hilang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated "Laporan Rusak & Hilang" page (`/laporan-rusak-hilang`) under the LAPORAN sidebar group: summary metrics (counts, valuation of approved reports, processing time), status and condition compositions, monthly trend, distribution per unit, approval performance (still-pending list) and a sortable paginated detail list with expandable chronology and approval history, plus a one-sheet Excel download ("Daftar Rusak & Hilang") with the official letterhead. The legacy `/laporan` tabbed page, its controller, request, and view are completely retired.

**Architecture:** `ReportQuery::build('rusak-hilang', …)` serves as the single source of scope + filters (with table-qualified columns `asset_reports.*` and category filtering via joined asset). `AssetReportRecapService` aggregates metrics efficiently for both SQLite and MySQL; `LaporanRusakHilangController` renders the page and streams the workbook via `AssetReportExcel` (built on `ReportSheetWriter`). The legacy `ReportController`, `ReportRequest`, and `Report/Index.tsx` are deleted.

**Tech Stack:** Laravel 13, Inertia 2 + React 18 + TypeScript, Tailwind v3, Pest 5, `phpoffice/phpspreadsheet`, `chart.js` + `react-chartjs-2` + `chartjs-plugin-datalabels` (all installed).

**Spec:** `docs/superpowers/specs/2026-10-07-laporan-rusak-hilang-design.md`

## Global Constraints

- Scope is always `User::accessibleUnitIds()` via `ReportQuery` (`null` = all units; `[]` = nothing): `asset_reports.unit_id` is scoped to the user's accessible units.
- Filters (rusak-hilang): `dari`, `sampai` (inclusive, `tanggal_kejadian`), `kondisi` (`rusak_ringan|rusak_berat|hilang`), `status` (`pending|approved|rejected|cancelled`), `unit_id`, `category_id`.
- Valuation metrics (Nilai Perolehan & Nilai Buku terdampak, tren bulanan) count **only reports with status `approved`**. `jumlah_laporan` and the status/kondisi compositions count every status inside the filter.
- Aggregates must run on both SQLite (tests) and MySQL: only `COUNT`, `SUM`, `COALESCE`, `GROUP BY`; months are bucketed in PHP; processing days use `App\Support\Days::between()` and are rounded to 1 decimal.
- Service output keys (exact): `ringkasan {jumlah_laporan, disetujui, nilai_perolehan, nilai_buku, rata_lama_proses, terlama_proses}`; `status [{status,label,jumlah,persen}]` in `AssetReportStatus` enum order; `kondisi [{kondisi,label,jumlah,persen}]` in `[rusak_ringan, rusak_berat, hilang]`; `tren [{bulan:'YYYY-MM',jumlah,nilai_perolehan}]` ascending; `sebaran_unit {baris:[{id,name,jumlah_rusak,jumlah_hilang,total,nilai_buku}], total{jumlah_rusak,jumlah_hilang,total,nilai_buku}}` (null if scope is single unit); `masih_berjalan [{id,nomor,kondisi_label,nama_aset,unit,pemegang,langkah,menunggu,umur_hari,url}]` oldest first, max 20; `jumlah_masih_berjalan` int.
- List sorting: `urut` ∈ `nomor_laporan|tanggal_kejadian|nama_aset|kondisi_baru|nilai_perolehan|nilai_buku|status` (default `tanggal_kejadian`), `arah` ∈ `asc|desc` (default `desc`); page size 25.
- Excel: file `laporan-rusak-hilang-{Y-m-d}.xlsx`, ONE sheet `Daftar Rusak & Hilang`, table only. Letterhead via `ReportSheetWriter::kop`; header row 9; two total rows (`Total Semua Status`, `Total Disetujui`). Money `#,##0`, decimal `0.0`, dates `dd/mm/yyyy`. Zero rows → download answers 422.
- UI: `AuthenticatedLayout`, Bahasa Indonesia, cards `rounded-lg border border-slate-200 bg-white` without shadow, badges 4px, numbers `tabular-nums`. All form controls have linked `<label htmlFor="...">` and `id="..."`.
- Test helper function names must be unique across test files: this plan uses prefixes `rr` (service), `lr` (controller), `re` (excel).
- Commits: plain message only. Never add `Co-Authored-By` lines. Stage files by explicit path.

## File Structure

| File | Responsibility |
|---|---|
| `app/Services/ReportQuery.php` | Scope + filters for `rusak-hilang` (qualified columns, `category_id`, `kondisi`, `unit_id`) |
| `app/Services/AssetReportRecapService.php` (new) | Summary, status/kondisi compositions, monthly trend, unit distribution, in-flight list |
| `app/Services/AssetReportExcel.php` (new) | One-sheet workbook with letterhead and total rows |
| `app/Http/Requests/LaporanRusakHilangRequest.php` (new), `app/Http/Controllers/LaporanRusakHilangController.php` (new), `routes/web.php` | Page + download endpoints, validation, and route configuration |
| `app/Http/Controllers/ReportController.php` (deleted), `app/Http/Requests/ReportRequest.php` (deleted), `resources/js/Pages/Report/Index.tsx` (deleted), `app/Services/ReportExporter.php` | Retirement of legacy report controller and view |
| `resources/js/Components/Charts/TrenInsidenChart.tsx` (new) | Monthly incident bar chart |
| `resources/js/Pages/LaporanRusakHilang/Index.tsx` (new), `resources/js/config/navigation.ts` | The dedicated report page and sidebar navigation update |

---

## Task 1: `ReportQuery` Rusak & Hilang Filters & Scoping

**Files:**
- Modify: `app/Services/ReportQuery.php`
- Test: `tests/Feature/ReportQueryTest.php`

**Interfaces:**
- Produces: `ReportQuery::build('rusak-hilang', $filters)` recognises `dari`, `sampai`, `kondisi`, `status`, `unit_id`, `category_id`; columns qualified `asset_reports.*`; eager loads `asset.category.parent`, `unit`, `pegawai`, `creator`, `approvalRequest.steps`, `approvalRequest.actions.user`; default order `tanggal_kejadian desc, id desc`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/ReportQueryTest.php`, add test cases verifying the new filters and join safety:

```php
it('filters rusak-hilang reports by conditions and categories without ambiguity', function () {
    $camat = User::role('camat')->first();
    $kecamatan = Unit::where('type', 'kecamatan')->first();

    $count = (new ReportQuery($camat))
        ->build('rusak-hilang', [
            'kondisi' => 'rusak_berat',
            'status' => 'approved',
            'unit_id' => $kecamatan->id,
        ])
        ->reorder()
        ->toBase()
        ->join('assets as a', 'a.id', '=', 'asset_reports.asset_id')
        ->count();

    expect($count)->toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run test to verify it fails or needs implementation**

Run: `php artisan test tests/Feature/ReportQueryTest.php`

- [ ] **Step 3: Update `ReportQuery.php` for `rusak-hilang`**

In `app/Services/ReportQuery.php`, update the `rusak-hilang` builder:
- Qualify columns `asset_reports.*`.
- Eager load `asset.category.parent`, `unit`, `pegawai`, `creator`, `photos`, `approvalRequest.steps`, `approvalRequest.actions.user`.
- Filter `dari` and `sampai` against `asset_reports.tanggal_kejadian`.
- Filter `kondisi` against `asset_reports.kondisi_baru`.
- Filter `status` against `asset_reports.status`.
- Filter `unit_id` against `asset_reports.unit_id`.
- Filter `category_id`: join/whereExists on `assets` where `category_id = $catId` or parent category matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/ReportQueryTest.php`

- [ ] **Step 5: Commit**

```bash
git add app/Services/ReportQuery.php tests/Feature/ReportQueryTest.php
git commit -m "feat: enhance ReportQuery filters for Laporan Rusak & Hilang"
```

---

## Task 2: `AssetReportRecapService`

**Files:**
- Create: `app/Services/AssetReportRecapService.php`
- Test: `tests/Feature/Services/AssetReportRecapServiceTest.php`

**Interfaces:**
- Produces: `AssetReportRecapService::for(User $user, array $filters): array` returning:
  - `ringkasan`: `jumlah_laporan`, `disetujui`, `nilai_perolehan`, `nilai_buku`, `rata_lama_proses`, `terlama_proses`
  - `status`: list of 4 items (`pending`, `approved`, `rejected`, `cancelled`) with `status`, `label`, `jumlah`, `persen`
  - `kondisi`: list of 3 items (`rusak_ringan`, `rusak_berat`, `hilang`) with `kondisi`, `label`, `jumlah`, `persen`
  - `tren`: monthly list (`bulan` = `YYYY-MM`, `jumlah`, `nilai_perolehan`) for approved reports
  - `sebaran_unit`: matrix of units (`id`, `name`, `jumlah_rusak`, `jumlah_hilang`, `total`, `nilai_buku`), null if user scope is single unit
  - `masih_berjalan`: up to 20 pending reports with processing details
  - `jumlah_masih_berjalan`: int

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Services/AssetReportRecapServiceTest.php` testing:
- Summary counts and valuation matching approved reports.
- Zero valuations when only pending/rejected reports are selected.
- Status and condition compositions summing up to `jumlah_laporan`.
- In-flight pending list with processing step and assignee.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Services/AssetReportRecapServiceTest.php`

- [ ] **Step 3: Implement `AssetReportRecapService`**

Implement `app/Services/AssetReportRecapService.php` using `ReportQuery::build('rusak-hilang', $filters)` and database aggregates. Ensure processing days use `Days::between()` unrounded, with average rounded at the end.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Services/AssetReportRecapServiceTest.php`

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetReportRecapService.php tests/Feature/Services/AssetReportRecapServiceTest.php
git commit -m "feat: add AssetReportRecapService for Rusak & Hilang analytics"
```

---

## Task 3: `AssetReportExcel` Workbook

**Files:**
- Create: `app/Services/AssetReportExcel.php`
- Modify: `app/Services/ReportSheetWriter.php` (add filter label support if needed)
- Test: `tests/Feature/AssetReportExcelTest.php`

**Interfaces:**
- Produces: `AssetReportExcel::build(Builder $query, array $filters, User $user): Spreadsheet`
- Generates single sheet "Daftar Rusak & Hilang" with official letterhead, 16 data columns, Total Semua Status row, and Total Disetujui row matching recap valuation.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/AssetReportExcelTest.php` verifying:
- Single sheet named `Daftar Rusak & Hilang`.
- Kop official header exists with Batam logo, scope, and filters.
- Data columns formatted properly (strings for codes, currency for values).
- Total rows match summary metrics.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetReportExcelTest.php`

- [ ] **Step 3: Implement `AssetReportExcel`**

Implement `app/Services/AssetReportExcel.php` using `ReportSheetWriter`. Apply optimized eager loading `->setEagerLoads([])->with(['asset.category', 'unit', 'pegawai', 'creator', 'approvalRequest.actions'])`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/AssetReportExcelTest.php`

- [ ] **Step 5: Commit**

```bash
git add app/Services/AssetReportExcel.php app/Services/ReportSheetWriter.php tests/Feature/AssetReportExcelTest.php
git commit -m "feat: add AssetReportExcel workbook generator"
```

---

## Task 4: Form Request, Controller, and Routes

**Files:**
- Create: `app/Http/Requests/LaporanRusakHilangRequest.php`
- Create: `app/Http/Controllers/LaporanRusakHilangController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/LaporanRusakHilangControllerTest.php`

**Interfaces:**
- Produces:
  - `GET /laporan-rusak-hilang` -> `LaporanRusakHilangController@index`
  - `GET /laporan-rusak-hilang/unduh` -> `LaporanRusakHilangController@unduh`
  - Whitelisted sort columns: `nomor_laporan`, `tanggal_kejadian`, `nama_aset`, `kondisi_baru`, `nilai_perolehan`, `nilai_buku`, `status`.

- [ ] **Step 1: Write the failing controller tests**

Create `tests/Feature/LaporanRusakHilangControllerTest.php`:
- Authenticated access required.
- Props delivered to Inertia: `filters`, `sort`, `ringkasan`, `status`, `kondisi`, `tren`, `sebaran_unit`, `masih_berjalan`, `jumlah_masih_berjalan`, `reports` (paginated 25 items), `unitOptions`, `categoryOptions`, `kondisiOptions`, `statusOptions`.
- Download endpoint returns 422 if 0 rows, otherwise streamed `.xlsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/LaporanRusakHilangControllerTest.php`

- [ ] **Step 3: Implement Request, Controller, and Routes**

- Create `app/Http/Requests/LaporanRusakHilangRequest.php`.
- Create `app/Http/Controllers/LaporanRusakHilangController.php`.
- Register routes in `routes/web.php`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/LaporanRusakHilangControllerTest.php`

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/LaporanRusakHilangRequest.php app/Http/Controllers/LaporanRusakHilangController.php routes/web.php tests/Feature/LaporanRusakHilangControllerTest.php
git commit -m "feat: add LaporanRusakHilangController and endpoints"
```

---

## Task 5: Retire Legacy `/laporan` Code

**Files:**
- Delete: `app/Http/Controllers/ReportController.php`
- Delete: `app/Http/Requests/ReportRequest.php`
- Delete: `resources/js/Pages/Report/Index.tsx`
- Modify: `routes/web.php` (remove `/laporan` and `/laporan/{laporan}/unduh`)
- Modify: `tests/Feature/ReportDownloadTest.php` (remove legacy download test or adapt)

- [ ] **Step 1: Remove legacy routes and controller**

In `routes/web.php`, delete lines 87-90 (`/laporan` and `/laporan/{laporan}/unduh`).
Delete `app/Http/Controllers/ReportController.php`, `app/Http/Requests/ReportRequest.php`, `resources/js/Pages/Report/Index.tsx`.
Delete obsolete methods in `ReportExporter.php` or retire the file if no longer referenced.

- [ ] **Step 2: Run tests to verify no regressions**

Run: `php artisan test`

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "refactor: retire legacy /laporan route and controller"
```

---

## Task 6: Frontend Components & Charts

**Files:**
- Create: `resources/js/Components/Charts/TrenInsidenChart.tsx`
- Modify: `resources/js/types/index.d.ts` (add types for Rusak Hilang report data)

- [ ] **Step 1: Create `TrenInsidenChart.tsx`**

Build `resources/js/Components/Charts/TrenInsidenChart.tsx` using Chart.js bar chart for monthly incidents and valuation.

- [ ] **Step 2: Verify TypeScript types**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add resources/js/Components/Charts/TrenInsidenChart.tsx resources/js/types/index.d.ts
git commit -m "feat: add TrenInsidenChart component and types"
```

---

## Task 7: Frontend Page & Sidebar Menu

**Files:**
- Create: `resources/js/Pages/LaporanRusakHilang/Index.tsx`
- Modify: `resources/js/config/navigation.ts`
- Test: Full test suite & build check

- [ ] **Step 1: Create `Pages/LaporanRusakHilang/Index.tsx`**

Implement complete page layout:
- Accessible filter form with `<label htmlFor="...">` and `<select id="...">`.
- 5 summary stat cards.
- 2 DonutCharts (Status and Kondisi).
- `TrenInsidenChart`.
- Sebaran Unit table.
- Masih Berjalan pending approvals panel.
- Expandable sortable detail table with pagination.

- [ ] **Step 2: Update sidebar navigation**

In `resources/js/config/navigation.ts`, update `Laporan Rusak & Hilang` href to `/laporan-rusak-hilang`.

- [ ] **Step 3: Full TypeScript & Build Check**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Run full Pest test suite**

Run: `php artisan test`

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/LaporanRusakHilang/Index.tsx resources/js/config/navigation.ts
git commit -m "feat: build Laporan Rusak & Hilang page and activate menu"
```
