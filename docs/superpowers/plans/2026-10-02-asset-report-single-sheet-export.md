# Single-Sheet Asset Report Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the asset report Excel export into a single-sheet workbook ("Daftar Aset") with 19 standardized columns matching the official Sagulung asset template and SIBIMA database fields.

**Architecture:** Refactor `AssetRecapWorkbook::build()` to generate only one worksheet ("Daftar Aset"), removing the multi-sheet breakdown (`Ringkasan`, `Rekap Kategori`, `Rekap Unit`, `Tren Tahunan`). Populate the 19 columns with model data and relation attributes, retaining the official Batam government letterhead and summary totals row at the bottom.

**Tech Stack:** PHP 8.3, Laravel 12, PhpOffice\PhpSpreadsheet, Pest PHP.

**Spec:** `docs/superpowers/specs/2026-10-02-asset-report-single-sheet-export.md`

## Global Constraints

- Generate exactly 1 worksheet titled `Daftar Aset`.
- No new external packages; reuse existing `phpoffice/phpspreadsheet` and `ReportSheetWriter`.
- Exclude photo column as explicitly requested.
- Maintain formula injection safety and numeric formatting (`money` format `#,##0` for currency columns).
- All Pest tests must pass with 0 errors.

---

### Task 1: Update Test Suite for Single-Sheet Export

**Files:**
- Modify: `tests/Feature/AssetRecapWorkbookTest.php`

**Interfaces:**
- Produces: Updated assertions expecting exactly 1 sheet titled `Daftar Aset`, with 19 columns and correct mapping.

- [x] **Step 1: Write the updated/failing tests in `AssetRecapWorkbookTest.php`**

Update `tests/Feature/AssetRecapWorkbookTest.php`:
- Change sheet assertion from `['Ringkasan', 'Daftar Rinci', 'Rekap Kategori', 'Rekap Unit', 'Tren Tahunan']` to `['Daftar Aset']`.
- Assert header row contains all 19 columns:
  `'No'`, `'ID Aset'`, `'Kode Barang'`, `'No. Register'`, `'Nama Aset'`, `'Kategori'`, `'Subkategori'`, `'Merk/Tipe'`, `'Tahun Perolehan'`, `'Tanggal Perolehan'`, `'Sumber Perolehan'`, `'Harga Perolehan'`, `'Nilai Buku'`, `'Kondisi'`, `'Status Aset'`, `'Unit Kerja'`, `'Penanggung Jawab'`, `'No. Dokumen'`, `'Keterangan'`.
- Assert totals row at the bottom accumulates `Harga Perolehan` and `Nilai Buku`.
- Assert formula sanitization on `Nama Aset` (`'=SUM(1+1)'`) remains safe.

- [x] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/AssetRecapWorkbookTest.php`
Expected: FAIL (currently generates 5 sheets instead of 1).

---

### Task 2: Refactor `AssetRecapWorkbook.php` to Single-Sheet 19-Column Layout

**Files:**
- Modify: `app/Services/AssetRecapWorkbook.php`

**Interfaces:**
- Consumes: `ReportSheetWriter`, `Asset` model, `AssetRecapService` recap data array.
- Produces: Streamed Excel workbook containing a single sheet (`Daftar Aset`) with 19 columns.

- [x] **Step 1: Refactor `build()` and `daftar()` in `AssetRecapWorkbook.php`**

- In `build()`:
  - Remove calls to `ringkasan()`, `rekapKategori()`, `rekapUnit()`, and `tren()`.
  - Create only one sheet titled `'Daftar Aset'` at index 0.
  - Call `$this->daftar(...)` on that sheet.
- In `daftar()`:
  - Define the 19 columns:
    ```php
    $columns = [
        ['No', 'int'],
        ['ID Aset', 'text'],
        ['Kode Barang', 'text'],
        ['No. Register', 'text'],
        ['Nama Aset', 'text'],
        ['Kategori', 'text'],
        ['Subkategori', 'text'],
        ['Merk/Tipe', 'text'],
        ['Tahun Perolehan', 'year'],
        ['Tanggal Perolehan', 'date'],
        ['Sumber Perolehan', 'text'],
        ['Harga Perolehan', 'money'],
        ['Nilai Buku', 'money'],
        ['Kondisi', 'text'],
        ['Status Aset', 'text'],
        ['Unit Kerja', 'text'],
        ['Penanggung Jawab', 'text'],
        ['No. Dokumen', 'text'],
        ['Keterangan', 'wrap'],
    ];
    ```
  - Map each asset row into the 19 values:
    ```php
    $rows[] = [
        $index + 1,
        $a->category?->code ?? $a->category?->formatted_code ?? '-',
        $a->kode_barang,
        $a->registerLabel(),
        $a->nama_aset,
        $a->category?->parent?->name ?? $a->category?->name ?? '-',
        $a->category?->parent_id !== null ? $a->category->name : '-',
        $a->merk_type ?? '-',
        $a->tanggal_perolehan?->format('Y') ?? '-',
        $a->tanggal_perolehan,
        $a->sumber_perolehan ?? '-',
        (float) $a->nilai_perolehan,
        (float) $a->nilai_buku,
        $a->kondisi->label(),
        $a->status->label(),
        $a->unit?->name ?? '-',
        $a->currentHolder?->nama ?? '-',
        $a->no_dokumen ?? '-',
        $a->keterangan ?? '-',
    ];
    ```
  - Set totals row at index 11 (`Harga Perolehan`) and 12 (`Nilai Buku`):
    ```php
    $total = array_fill(0, count($columns), null);
    $total[1] = 'TOTAL';
    $total[11] = $recap['ringkasan']['nilai_perolehan'];
    $total[12] = $recap['ringkasan']['nilai_buku'];
    ```
- Clean up any unused private helper methods (`ringkasan`, `rekapKategori`, `rekapUnit`, `tren`).

- [x] **Step 2: Run test to verify it passes**

Run: `php artisan test tests/Feature/AssetRecapWorkbookTest.php`
Expected: PASS with all assertions green.

- [x] **Step 3: Run full application test suite**

Run: `php artisan test`
Expected: 460+ passed, 0 failures.

- [x] **Step 4: Commit**

```bash
git add app/Services/AssetRecapWorkbook.php tests/Feature/AssetRecapWorkbookTest.php docs/superpowers/specs/2026-10-02-asset-report-single-sheet-export.md docs/superpowers/plans/2026-10-02-asset-report-single-sheet-export.md
git commit -m "feat: export asset report as single-sheet with 19 columns"
```
