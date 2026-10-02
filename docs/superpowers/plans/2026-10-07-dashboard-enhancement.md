# Dashboard Enhancement & Chart.js Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the SIBIMA Dashboard from static HTML bars to 4 interactive Chart.js visualizations (Donut Kondisi, Horizontal Bar Kategori, Stacked Bar Sebaran Unit, and Grouped Bar Tren Aktivitas) along with a 4-way tabbed recent transactions feed.

**Architecture:** `DashboardService` is enhanced to aggregate 6-month transaction frequency (`trenAktivitas`) across Penerimaan, Mutasi, Rusak/Hilang, and Permohonan, as well as fetch top 5 recent transactions per type. The frontend introduces 3 new focused Chart.js components (`KategoriAsetChart`, `SebaranUnitChart`, `TrenAktivitasChart`) alongside existing `DonutChart`, while `Dashboard.tsx` adopts a 2x2 chart grid and a Preline-safe tabbed activity feed.

**Tech Stack:** Laravel 12, Inertia.js (React 19 + TypeScript), Tailwind CSS, Chart.js (`react-chartjs-2`, `chartjs-plugin-datalabels`), Pest PHP.

**Spec:** [`docs/superpowers/specs/2026-10-07-dashboard-enhancement-design.md`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/superpowers/specs/2026-10-07-dashboard-enhancement-design.md)

## Global Constraints

- Never use `role="tablist"` or `role="tab"` (Preline UI `autoInit()` hijacks and breaks them). Use native buttons with React state `useState('semua')`.
- Maintain strict dual-layer unit scoping: Superadmin/Kasubag access all units; Camat accesses kecamatan + sub-kelurahan; Admin/Lurah only their unit.
- Ensure all chart components provide accessible hidden table fallbacks (`table.sr-only`) and aria-labels.
- Plain commit messages only without AI attribution lines.

---

## Task 1: Backend Aggregations & DashboardTest

**Files:**
- Modify: `app/Services/DashboardService.php`
- Modify: `tests/Feature/DashboardTest.php`

**Interfaces:**
- Produces:
  - `DashboardService::trenAktivitas(array $scopeIds, int $months = 6): array` returning 6 chronological entries with keys `bulan`, `penerimaan`, `mutasi`, `rusak_hilang`, `permohonan`.
  - `DashboardService::transaksi(array $scopeIds): array` returning up to 20 normalized recent transactions across 4 types with keys `id`, `jenis`, `nomor`, `ringkasan`, `tanggal`, `status`, `status_label`, `url`, `created_at`.
  - `dashboard.tren_aktivitas` and expanded `dashboard.transaksi` in Inertia props.

- [x] **Step 1: Write the failing tests in `DashboardTest.php`**

Extend `tests/Feature/DashboardTest.php` to verify:
- `dashboard.tren_aktivitas` exists and has exactly 6 chronological months.
- `dashboard.tren_aktivitas.0` contains keys `bulan`, `penerimaan`, `mutasi`, `rusak_hilang`, `permohonan`.
- `dashboard.transaksi` contains items representing all 4 transaction types when present.
- Filter `?unit_id=...` correctly scopes `tren_aktivitas` and `transaksi`.

- [x] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DashboardTest.php`
Expected: FAIL with missing keys `tren_aktivitas`.

- [x] **Step 3: Implement `trenAktivitas` and expand `transaksi` in `DashboardService.php`**

- In `DashboardService::for()`, add `'tren_aktivitas' => $this->trenAktivitas($ids, 6)`.
- Implement `trenAktivitas(array $scopeIds, int $months = 6): array`:
  - Calculate 6 months list from `$months - 1` months ago up to current month (`Y-m`).
  - Query counts per `Y-m` for:
    - `BeritaAcaraPenerimaan` (where `unit_id` in scope, `status = submitted`).
    - `AssetMutation` (where `origin_unit_id` in scope or `destination_unit_id` in scope).
    - `AssetReport` (where `unit_id` in scope).
    - `AssetRequest` (where `unit_id` in scope).
  - Merge into 6 filled monthly rows.
- Expand `transaksi(array $scopeIds): array`:
  - Fetch 5 latest `AssetMutation`.
  - Fetch 5 latest `BeritaAcaraPenerimaan`.
  - Fetch 5 latest `AssetReport`.
  - Fetch 5 latest `AssetRequest`.
  - Normalize each to `{ id, jenis, nomor, ringkasan, tanggal, status, status_label, url, created_at }`.
  - Sort merged collection by `created_at` desc.

- [x] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/DashboardTest.php`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/Services/DashboardService.php tests/Feature/DashboardTest.php
git commit -m "feat: expand DashboardService with 6-month trend and 4-way recent transactions"
```

---

## Task 2: Frontend Types & Modular Chart Components

**Files:**
- Modify: `resources/js/types/index.d.ts`
- Create: `resources/js/Components/Charts/KategoriAsetChart.tsx`
- Create: `resources/js/Components/Charts/SebaranUnitChart.tsx`
- Create: `resources/js/Components/Charts/TrenAktivitasChart.tsx`

**Interfaces:**
- Produces:
  - Updated `DashboardData` interface in `resources/js/types/index.d.ts` including `tren_aktivitas` and updated `transaksi`.
  - `<KategoriAsetChart data={per_kategori} />` (horizontal bar).
  - `<SebaranUnitChart data={per_unit} perKondisi={per_kondisi} />` (stacked bar).
  - `<TrenAktivitasChart data={tren_aktivitas} />` (grouped bar).

- [x] **Step 1: Update TypeScript types in `resources/js/types/index.d.ts`**

Define:
```typescript
export interface TrenAktivitasItem {
    bulan: string;
    penerimaan: number;
    mutasi: number;
    rusak_hilang: number;
    permohonan: number;
}

export interface DashboardTransaksiItem {
    id: number | string;
    jenis: 'penerimaan' | 'mutasi' | 'rusak_hilang' | 'permohonan';
    nomor: string;
    ringkasan: string;
    tanggal: string | null;
    status: string;
    status_label: string;
    url: string;
    created_at: string;
}
```
Update `DashboardData` to include `tren_aktivitas: TrenAktivitasItem[]` and `transaksi: DashboardTransaksiItem[]`.

- [x] **Step 2: Create `KategoriAsetChart.tsx`**

Implement horizontal bar chart (`indexAxis: 'y'`) using Chart.js `Bar`:
- Displays top 6–8 categories.
- Bars in blue `#2563EB`.
- Tooltip shows number of assets and total book value (`rupiah(nilai_buku)`).
- Accessible hidden table fallback.

- [x] **Step 3: Create `SebaranUnitChart.tsx`**

Implement stacked bar chart using Chart.js `Bar`:
- Sumbu X: unit names.
- Dataset 1: "Kondisi Baik" (`#047857`).
- Dataset 2: "Bermasalah (Rusak/Hilang)" (`#B91C1C`).
- Scales: `x: { stacked: true }, y: { stacked: true, beginAtZero: true }`.
- If single-unit mode, render single unit breakdown cleanly.
- Accessible hidden table fallback.

- [x] **Step 4: Create `TrenAktivitasChart.tsx`**

Implement grouped bar chart using Chart.js `Bar`:
- Sumbu X: 6 months formatted with `bulanLabel()`.
- 4 Datasets:
  - Penerimaan (`#2563EB`)
  - Mutasi (`#4F46E5`)
  - Rusak & Hilang (`#DC2626`)
  - Permohonan (`#D97706`)
- Interactive legend for toggling datasets.
- Accessible hidden table fallback.

- [x] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add resources/js/types/index.d.ts resources/js/Components/Charts/KategoriAsetChart.tsx resources/js/Components/Charts/SebaranUnitChart.tsx resources/js/Components/Charts/TrenAktivitasChart.tsx
git commit -m "feat: add KategoriAsetChart, SebaranUnitChart, and TrenAktivitasChart components"
```

---

## Task 3: Dashboard View Refactor & Tabbed Activity Feed

**Files:**
- Modify: `resources/js/Pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `DonutChart`, `KategoriAsetChart`, `SebaranUnitChart`, `TrenAktivitasChart`.
- Produces: 2x2 interactive chart grid, 5-tab recent activity feed with client-side filtering, status badges, and direct links.

- [x] **Step 1: Refactor `Dashboard.tsx`**

- Replace static HTML `<Bar>` progress bars with the 4 Chart.js components in a 2x2 grid:
  - Card 1: `DonutChart` (Kondisi Aset) + Legend.
  - Card 2: `KategoriAsetChart` (Top Kategori Aset).
  - Card 3: `SebaranUnitChart` (Sebaran Aset per Unit).
  - Card 4: `TrenAktivitasChart` (Tren Aktivitas 6 Bulan).
- Refactor the "Transaksi Terbaru" section into a Tabbed Activity Feed:
  - State: `const [activeTab, setActiveTab] = useState<'semua' | 'penerimaan' | 'mutasi' | 'rusak_hilang' | 'permohonan'>('semua')`.
  - Filter items: `const filteredTransaksi = activeTab === 'semua' ? d.transaksi : d.transaksi.filter(t => t.jenis === activeTab)`.
  - Tab buttons with item counters (e.g. `Semua (${d.transaksi.length})`, `Penerimaan (${count})`, etc.).
  - Transaction badges:
    - Penerimaan: Blue (`bg-blue-50 text-blue-700 border-blue-200`)
    - Mutasi: Indigo (`bg-indigo-50 text-indigo-700 border-indigo-200`)
    - Rusak & Hilang: Red (`bg-red-50 text-red-700 border-red-200`)
    - Permohonan: Amber (`bg-amber-50 text-amber-700 border-amber-200`)
  - Status badges with unified labels.
  - Desktop table + Mobile card list.
  - Clickable link directly navigating to document details.

- [x] **Step 2: Run TypeScript check and Vite build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors and successful bundle creation.

- [x] **Step 3: Run full Pest test suite**

Run: `php artisan test`
Expected: 462+ passed, 0 failures.

- [x] **Step 4: Commit**

```bash
git add resources/js/Pages/Dashboard.tsx
git commit -m "feat: integrate Chart.js grid and tabbed activity feed into Dashboard"
```
