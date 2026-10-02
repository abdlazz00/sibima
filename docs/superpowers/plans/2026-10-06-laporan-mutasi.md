# Laporan Mutasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Laporan Mutasi" page (`/laporan-mutasi`) under the LAPORAN sidebar group: summary, status and type composition, monthly trend, flow between units, approval performance (average/longest processing time plus the still-pending list) and a sortable paginated detail list with expandable assets and approval history, plus a one-sheet Excel download ("Daftar Mutasi") with the official letterhead. Everything is limited to the units the user may see.

**Architecture:** `ReportQuery::build('mutasi', …)` stays the single source of scope + filters (columns now table-qualified so it can be joined). `MutationRecapService` aggregates it; `LaporanMutasiController` renders the page (recap + paginated list) and streams the workbook from `MutationExcel`, built on the existing `ReportSheetWriter`. The old tabbed `/laporan` page stops serving "mutasi" and keeps only "rusak-hilang". `KondisiChart` is generalised to `DonutChart` so Aset and Mutasi share it.

**Tech Stack:** Laravel 13, Inertia 2 + React 18 + TypeScript, Tailwind v3, Pest 5, `phpoffice/phpspreadsheet`, `chart.js` + `react-chartjs-2` + `chartjs-plugin-datalabels` (all already installed).

**Spec:** `docs/superpowers/specs/2026-10-06-laporan-mutasi-design.md`

## Global Constraints

- Scope is always `User::accessibleUnitIds()` through `ReportQuery` (`null` = all units; `[]` = nothing): a mutation is visible when its origin OR destination unit is in scope. `asal_id` / `tujuan_id` filters only narrow already-scoped rows and are NOT checked against scope (they must still be existing units: 422 otherwise).
- Filters (mutasi): `dari`, `sampai` (inclusive, `tanggal_mutasi`), `jenis_mutasi` (`MutationType` value), `status` (`pending|approved|rejected|cancelled`), `asal_id`, `tujuan_id`. The old `unit_id` filter for mutasi is removed.
- Movement numbers (Aset Berpindah, nilai, tren, arus, processing time) count **only mutations with status `approved`**. `jumlah_mutasi` and the status/type compositions count every status inside the filter.
- Aggregates must run on SQLite (tests) and MySQL: only `COUNT`, `COUNT(DISTINCT)`, `SUM`, `COALESCE`, `GROUP BY`; months are bucketed in PHP; processing days are computed in PHP. Every column in `ReportQuery::mutasi` is qualified `asset_mutations.*` because the recap joins `assets` (which also has `status`, `unit_id`, …).
- Service output keys (exact): `ringkasan {jumlah_mutasi, disetujui, aset_berpindah, nilai_perolehan, rata_lama_proses, terlama_proses}` (`nilai_perolehan` float; the two durations are float days with 1 decimal or `null`); `status [{status,label,jumlah,persen}]` in `MutationStatus` enum order (pending, approved, rejected, cancelled); `jenis [{jenis,label,jumlah,persen}]` in `MutationType` enum order; `persen` rounded to 1 decimal (`0.0` when empty); `tren [{bulan:'YYYY-MM',jumlah_mutasi,aset_berpindah}]` ascending, gap months zero-filled only when the span is ≤ 60 months; `arus {baris:[{asal_id,asal,tujuan_id,tujuan,jumlah_mutasi,aset,nilai}], total{jumlah_mutasi,aset,nilai}}` sorted by `aset` desc then names; `masih_berjalan [{id,nomor,jenis,asal,tujuan,langkah,menunggu,umur_hari,url}]` oldest first, max 20; `jumlah_masih_berjalan` int. Totals agree: status sum = jenis sum = `jumlah_mutasi`; `arus.total.aset` = tren sum of `aset_berpindah` = `ringkasan.aset_berpindah`; tren sum of `jumlah_mutasi` = `ringkasan.disetujui`.
- Processing time = days from `approval_requests.created_at` to the latest `approve` action of that request. Pending `menunggu`: user name for a `user` step, `Atasan Unit` for `atasan_unit`, else the role formatted (`admin_kelurahan` → `Admin Kelurahan`). A pending mutation without an approval request must not crash (`langkah`/`menunggu` null).
- List sorting: `urut` ∈ `nomor_mutasi|tanggal_mutasi|jumlah_aset|nilai|status` (default `tanggal_mutasi`), `arah` ∈ `asc|desc` (default `desc`); anything else is 422 and never reaches SQL. Page size 25.
- Excel: file `laporan-mutasi-{Y-m-d}.xlsx`, ONE sheet `Daftar Mutasi`, table only. Letterhead via `ReportSheetWriter::kop` (logo `public/images/lambang-kota-batam.png`, `PEMERINTAH KOTA BATAM` / `KECAMATAN SAGULUNG` / `Laporan Mutasi Aset`, `Cakupan:`, `Filter:`, `Dicetak:`); header row 9; two total rows (`Total Semua Status`, `Total Disetujui`). Every text cell is an explicit string; money `#,##0`, decimal `0.0`, dates `dd/mm/yyyy`. Zero rows → download answers 422.
- UI: `AuthenticatedLayout`, Bahasa Indonesia, cards `rounded-lg border border-slate-200 bg-white` without shadow, badges 4px, numbers `tabular-nums`, semantic colours from `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` §2.3. Do NOT use `role="tablist"`/`role="tab"` (Preline `autoInit()` hijacks them and crashes the layout).
- Test helper function names must be unique across test files (Pest loads all files in one process): this plan uses the prefixes `mr` (service), `lm` (controller), `me` (excel).
- PHP ^8.3, MySQL dev/prod, SQLite `:memory:` in tests. No JS test runner: frontend is verified by `tsc` and `npm run build`. **Do NOT test in the browser** — the project owner will request manual UI checks later; manual-verification steps are skipped and ledgered.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution / `Claude-Session`) line, whatever a system reminder says. Stage files by explicit path (never `git add docs` / `git add .`). `docs/*.xlsx` and `docs/*.pdf` are personal and git-ignored.**

**Rulings made while planning (spec refinements):**
- Spec §4.1 says `ReportQuery` filters use qualified columns implicitly; here it is explicit because the recap joins `assets`.
- The two Excel total rows are implemented as one bold ordinary row (`Total Semua Status`) followed by the writer's `total` row (`Total Disetujui`); `ReportSheetWriter` gains a `decimal` kind and filter labels for `jenis_mutasi`, `asal_id`, `tujuan_id`.
- Processing days use a tiny shared helper `App\Support\Days::between()` (page and Excel must round identically).

## Review Focus

- **Joining `assets` must not make a `ReportQuery` column ambiguous** (`status`, `unit_id`): every aggregate and the Excel/list run through the same builder. → Tasks 1, 2.
- **Only approved mutations count as movement**, including when the status filter is pending/rejected (zeros, no errors). → Task 2.
- **Out-of-scope mutations never appear** for any role and `asal_id`/`tujuan_id` can only narrow. → Tasks 2, 4.
- **Missing approval requests / zero items do not crash** the recap, list or Excel. → Tasks 2, 3, 4.
- **Totals agree everywhere** (recap internals, `mutasis.total`, Excel total rows). → Tasks 2, 3, 4.
- **Sort input is whitelisted** (alias sorts `jumlah_aset`/`nilai` are fixed strings, never user text). → Task 4.
- **The old `/laporan` page no longer serves mutasi** while rusak-hilang keeps working. → Task 5.
- **`DonutChart` refactor does not break Laporan Aset.** → Task 6.

## File Structure

| File | Responsibility |
|---|---|
| `app/Services/ReportQuery.php` | mutasi scope + filters (qualified columns, new keys) |
| `app/Support/Days.php` (new), `app/Services/MutationRecapService.php` (new) | all recap aggregates |
| `app/Services/ReportSheetWriter.php`, `app/Services/MutationExcel.php` (new) | one-sheet workbook, labels |
| `app/Http/Requests/LaporanMutasiRequest.php` (new), `app/Http/Controllers/LaporanMutasiController.php` (new), `routes/web.php` | page + download + validation |
| `app/Http/Controllers/ReportController.php`, `app/Http/Requests/ReportRequest.php`, `app/Services/ReportExporter.php`, `resources/js/Pages/Report/Index.tsx` | retire mutasi from the old page |
| `resources/js/lib/chartColors.ts`, `resources/js/lib/format.ts`, `types/index.d.ts`, `Components/Charts/{DonutChart,TrenMutasiChart}.tsx` (KondisiChart removed) | frontend foundations |
| `resources/js/Pages/LaporanMutasi/Index.tsx`, `config/navigation.ts`, `Pages/LaporanAset/Index.tsx` | the page, menu, Aset page migrated to `DonutChart` |

---

## Task 1: `ReportQuery` mutation filters

**Files:**
- Modify: `app/Services/ReportQuery.php`
- Test: `tests/Feature/ReportQueryTest.php`

**Interfaces:**
- Produces: `ReportQuery::build('mutasi', $f)` recognises `dari`, `sampai`, `jenis_mutasi`, `status`, `asal_id`, `tujuan_id` (no `unit_id`); all columns qualified `asset_mutations.*`; eager loads `originUnit`, `destinationUnit`, `creator`, `items.asset.category.parent`, `items.targetHolder`, `approvalRequest.steps`, `approvalRequest.actions.user`; default order `tanggal_mutasi desc, id desc`.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/ReportQueryTest.php`, replace the line

```php
        ->and(rq($this, $this->camat, 'mutasi', ['unit_id' => $this->kelB->id]))->toBe($ids($this->m2, $this->m3))
```

with

```php
        ->and(rq($this, $this->camat, 'mutasi', ['asal_id' => $this->kec->id]))->toBe($ids($this->m1, $this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['tujuan_id' => $this->kelB->id]))->toBe($ids($this->m2, $this->m3))
        ->and(rq($this, $this->camat, 'mutasi', ['asal_id' => $this->kelB->id, 'tujuan_id' => $this->kelB->id]))->toBe($ids($this->m3))
        ->and(rq($this, $this->camat, 'mutasi', ['jenis_mutasi' => 'internal']))->toBe($ids($this->m3))
        ->and(rq($this, $this->adminA, 'mutasi', ['asal_id' => $this->kelB->id]))->toBe([])
```

and append this test at the end of the file:

```php

it('can be joined with assets without ambiguous columns', function () {
    $count = (new ReportQuery($this->camat))
        ->build('mutasi', ['status' => 'approved', 'dari' => '2026-10-01', 'asal_id' => $this->kec->id])
        ->reorder()
        ->toBase()
        ->join('asset_mutation_items as mi', 'mi.asset_mutation_id', '=', 'asset_mutations.id')
        ->join('assets as ma', 'ma.id', '=', 'mi.asset_id')
        ->count();

    expect($count)->toBe(0);
});
```

(`use App\Services\ReportQuery;` is already imported in that file.)

- [ ] **Step 2: Run to verify it fails**

Run: `php artisan test tests/Feature/ReportQueryTest.php`
Expected: FAIL (`asal_id` ignored so 3 rows are returned; the join test errors with an ambiguous `status` column).

- [ ] **Step 3: Implement**

In `app/Services/ReportQuery.php` replace the whole `mutasi()` method with:

```php
    /** @param  array<string, mixed>  $f */
    private function mutasi(array $f): Builder
    {
        $ids = $this->user->accessibleUnitIds();

        return AssetMutation::query()
            ->with([
                'originUnit', 'destinationUnit', 'creator',
                'items.asset.category.parent', 'items.targetHolder',
                'approvalRequest.steps', 'approvalRequest.actions.user',
            ])
            ->when($ids !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereIn('asset_mutations.origin_unit_id', $ids)
                ->orWhereIn('asset_mutations.destination_unit_id', $ids)))
            ->when($f['asal_id'] ?? null, fn (Builder $q, $id) => $q->where('asset_mutations.origin_unit_id', $id))
            ->when($f['tujuan_id'] ?? null, fn (Builder $q, $id) => $q->where('asset_mutations.destination_unit_id', $id))
            ->when($f['jenis_mutasi'] ?? null, fn (Builder $q, $jenis) => $q->where('asset_mutations.jenis_mutasi', $jenis))
            ->when($f['status'] ?? null, fn (Builder $q, $status) => $q->where('asset_mutations.status', $status))
            ->when($f['dari'] ?? null, fn (Builder $q, $date) => $q->whereDate('asset_mutations.tanggal_mutasi', '>=', $date))
            ->when($f['sampai'] ?? null, fn (Builder $q, $date) => $q->whereDate('asset_mutations.tanggal_mutasi', '<=', $date))
            ->orderByDesc('asset_mutations.tanggal_mutasi')
            ->orderByDesc('asset_mutations.id');
    }
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/ReportQueryTest.php`
Expected: PASS (6 tests).

Run: `php artisan test`
Expected: all green except nothing else should break (the old Report page still passes `unit_id` for mutasi in its test only through the page; `ReportDownloadTest` mutasi cases use no unit filter, so they stay green until Task 5).

- [ ] **Step 5: Commit**

```bash
git add app/Services/ReportQuery.php tests/Feature/ReportQueryTest.php
git commit -m "feat: add asal, tujuan and jenis filters to the mutation report query"
```

---

## Task 2: `MutationRecapService`

**Files:**
- Create: `app/Support/Days.php`, `app/Services/MutationRecapService.php`
- Test: `tests/Feature/MutationRecapServiceTest.php`

**Interfaces:**
- Consumes: `ReportQuery::build('mutasi', …)` (Task 1), `ApprovalWorkflowService::submit`.
- Produces: `Days::between(CarbonInterface $from, CarbonInterface $to): float` (1-decimal days); `MutationRecapService::for(User $user, array $filters): array` with the exact keys in Global Constraints.

- [ ] **Step 1: Write the failing test**

`tests/Feature/MutationRecapServiceTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\ApprovalAction;
use App\Models\ApprovalRequestStep;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use App\Services\MutationRecapService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Role;

function mrWorkflow(string $jenis): string
{
    return ['kec_ke_kel' => 'mutasi_kec_ke_kel', 'antar_kel' => 'mutasi_antar_kel', 'internal' => 'mutasi_internal_kel'][$jenis];
}

/** @param  list<Asset>  $assets */
function mrMutation(object $t, string $no, string $jenis, $origin, $dest, string $date, string $status, array $assets, ?string $diajukan = null): AssetMutation
{
    $m = AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $jenis, 'origin_unit_id' => $origin->id,
        'destination_unit_id' => $dest->id, 'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $t->camat->id,
    ]);

    foreach ($assets as $asset) {
        AssetMutationItem::create(['asset_mutation_id' => $m->id, 'asset_id' => $asset->id]);
    }

    if ($diajukan !== null) {
        app(ApprovalWorkflowService::class)->submit($m, mrWorkflow($jenis), $t->camat);
        $m->approvalRequest()->first()->forceFill(['created_at' => $diajukan])->save();
        $m->forceFill(['created_at' => $diajukan])->save();
    }

    return $m;
}

function mrApprove(AssetMutation $m, int $step, string $at): void
{
    $request = $m->approvalRequest()->first();
    $action = ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => $step, 'user_id' => $m->created_by, 'action' => 'approve']);
    $action->forceFill(['created_at' => $at])->save();
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->otherKec = makeKecamatan('Kecamatan Lain');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 1000]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 3000]);
    $this->a4 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'nilai_perolehan' => 500]);
    $this->a5 = Asset::factory()->create(['unit_id' => $this->otherKec->id, 'nilai_perolehan' => 4000]);

    $this->m1 = mrMutation($this, 'M-1', 'kec_ke_kel', $this->kec, $this->kelA, '2026-08-10', 'approved', [$this->a1, $this->a2], '2026-08-10 09:00:00');
    mrApprove($this->m1, 1, '2026-08-12 09:00:00');

    $this->m2 = mrMutation($this, 'M-2', 'kec_ke_kel', $this->kec, $this->kelB, '2026-10-05', 'approved', [$this->a3], '2026-10-05 08:00:00');
    mrApprove($this->m2, 1, '2026-10-05 20:00:00');
    mrApprove($this->m2, 2, '2026-10-08 08:00:00');

    $this->m3 = mrMutation($this, 'M-3', 'antar_kel', $this->kelA, $this->kelB, '2026-10-07', 'pending', [$this->a4], '2026-10-07 10:00:00');
    $this->m4 = mrMutation($this, 'M-4', 'internal', $this->kelB, $this->kelB, '2026-10-09', 'rejected', [$this->a4]);
    $this->m5 = mrMutation($this, 'M-5', 'internal', $this->otherKec, $this->otherKec, '2026-09-01', 'approved', [$this->a5]);

    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));
    $this->service = app(MutationRecapService::class);
});

it('summarises the camat scope, counting movement only from approved mutations', function () {
    $r = $this->service->for($this->camat, [])['ringkasan'];

    expect($r)->toBe([
        'jumlah_mutasi' => 4, 'disetujui' => 2, 'aset_berpindah' => 3, 'nilai_perolehan' => 6000.0,
        'rata_lama_proses' => 2.5, 'terlama_proses' => 3.0,
    ]);
});

it('limits a kelurahan admin to mutations touching the own unit on either side', function () {
    $r = $this->service->for($this->adminA, []);

    expect($r['ringkasan']['jumlah_mutasi'])->toBe(2)
        ->and($r['ringkasan']['disetujui'])->toBe(1)
        ->and($r['ringkasan']['aset_berpindah'])->toBe(2)
        ->and($r['ringkasan']['nilai_perolehan'])->toBe(3000.0)
        ->and($this->service->for($this->kasubag, [])['ringkasan']['jumlah_mutasi'])->toBe(5);
});

it('composes by status and by type in enum order with percentages', function () {
    $recap = $this->service->for($this->camat, []);

    expect(collect($recap['status'])->pluck('status')->all())->toBe(['pending', 'approved', 'rejected', 'cancelled'])
        ->and(collect($recap['status'])->pluck('jumlah')->all())->toBe([1, 2, 1, 0])
        ->and(collect($recap['status'])->pluck('persen')->all())->toBe([25.0, 50.0, 25.0, 0.0])
        ->and($recap['status'][1]['label'])->toBe('Disetujui')
        ->and(collect($recap['jenis'])->pluck('jenis')->all())->toBe(['kec_ke_kel', 'antar_kel', 'retur_kel_ke_kec', 'internal'])
        ->and(collect($recap['jenis'])->pluck('jumlah')->all())->toBe([2, 1, 0, 1])
        ->and(collect($recap['jenis'])->pluck('persen')->all())->toBe([50.0, 25.0, 0.0, 25.0]);
});

it('builds the monthly trend from approved mutations with zero-filled gaps', function () {
    expect($this->service->for($this->camat, [])['tren'])->toBe([
        ['bulan' => '2026-08', 'jumlah_mutasi' => 1, 'aset_berpindah' => 2],
        ['bulan' => '2026-09', 'jumlah_mutasi' => 0, 'aset_berpindah' => 0],
        ['bulan' => '2026-10', 'jumlah_mutasi' => 1, 'aset_berpindah' => 1],
    ]);
});

it('does not zero-fill an absurd month span caused by a mistyped date', function () {
    mrMutation($this, 'M-OLD', 'internal', $this->kelA, $this->kelA, '0202-05-05', 'approved', [$this->a4]);

    $tren = $this->service->for($this->camat, [])['tren'];

    expect(collect($tren)->pluck('bulan')->all())->toBe(['0202-05', '2026-08', '2026-10'])
        ->and(collect($tren)->sum('jumlah_mutasi'))->toBe(3);
});

it('builds the flow between units from approved mutations sorted by assets', function () {
    $arus = $this->service->for($this->camat, [])['arus'];

    expect($arus['baris'])->toBe([
        ['asal_id' => $this->kec->id, 'asal' => $this->kec->name, 'tujuan_id' => $this->kelA->id, 'tujuan' => 'Kelurahan A', 'jumlah_mutasi' => 1, 'aset' => 2, 'nilai' => 3000.0],
        ['asal_id' => $this->kec->id, 'asal' => $this->kec->name, 'tujuan_id' => $this->kelB->id, 'tujuan' => 'Kelurahan B', 'jumlah_mutasi' => 1, 'aset' => 1, 'nilai' => 3000.0],
    ])->and($arus['total'])->toBe(['jumlah_mutasi' => 2, 'aset' => 3, 'nilai' => 6000.0]);
});

it('applies the asal, tujuan, jenis, status and date filters', function () {
    $count = fn (array $f) => $this->service->for($this->camat, $f)['ringkasan']['jumlah_mutasi'];

    expect($count(['asal_id' => $this->kec->id]))->toBe(2)
        ->and($count(['tujuan_id' => $this->kelB->id]))->toBe(2)
        ->and($count(['jenis_mutasi' => 'internal']))->toBe(1)
        ->and($count(['status' => 'pending']))->toBe(1)
        ->and($count(['dari' => '2026-10-01', 'sampai' => '2026-10-06']))->toBe(1)
        ->and($count(['dari' => '2026-10-05', 'sampai' => '2026-10-05']))->toBe(1);
});

it('reports zero movement without errors when the status filter excludes approved mutations', function () {
    $recap = $this->service->for($this->camat, ['status' => 'pending']);

    expect($recap['ringkasan'])->toBe([
        'jumlah_mutasi' => 1, 'disetujui' => 0, 'aset_berpindah' => 0, 'nilai_perolehan' => 0.0,
        'rata_lama_proses' => null, 'terlama_proses' => null,
    ])->and($recap['tren'])->toBe([])
        ->and($recap['arus'])->toBe(['baris' => [], 'total' => ['jumlah_mutasi' => 0, 'aset' => 0, 'nilai' => 0.0]]);
});

it('lists the pending mutations with step, waiting party and age', function () {
    $recap = $this->service->for($this->camat, []);

    expect($recap['jumlah_masih_berjalan'])->toBe(1)
        ->and($recap['masih_berjalan'])->toBe([[
            'id' => $this->m3->id, 'nomor' => 'M-3', 'jenis' => 'Mutasi Antar Kelurahan', 'asal' => 'Kelurahan A',
            'tujuan' => 'Kelurahan B', 'langkah' => 'Persetujuan Lurah Asal', 'menunggu' => 'Lurah', 'umur_hari' => 5,
            'url' => route('asset-mutations.show', $this->m3),
        ]]);

    $user = User::factory()->create(['name' => 'Budi Approver']);
    ApprovalRequestStep::where('approval_request_id', $this->m3->approvalRequest()->first()->id)->where('step_order', 1)
        ->update(['approver_type' => 'user', 'approver_user_id' => $user->id]);

    expect($this->service->for($this->camat, [])['masih_berjalan'][0]['menunggu'])->toBe('Budi Approver');
});

it('caps the pending list at twenty, oldest first, and tolerates a missing approval request', function () {
    foreach (range(1, 22) as $i) {
        mrMutation($this, "P-{$i}", 'internal', $this->kelA, $this->kelA, '2026-10-10', 'pending', [$this->a4]);
    }

    $recap = $this->service->for($this->camat, []);

    expect($recap['masih_berjalan'])->toHaveCount(20)
        ->and($recap['jumlah_masih_berjalan'])->toBe(23)
        ->and($recap['masih_berjalan'][0]['nomor'])->toBe('M-3')
        ->and(collect($recap['masih_berjalan'])->last()['langkah'])->toBeNull()
        ->and(collect($recap['masih_berjalan'])->last()['menunggu'])->toBeNull();
});

it('keeps every total in agreement', function () {
    foreach ([[], ['asal_id' => $this->kec->id], ['status' => 'approved']] as $filters) {
        $r = $this->service->for($this->camat, $filters);

        expect(collect($r['status'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah_mutasi'])
            ->and(collect($r['jenis'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah_mutasi'])
            ->and($r['arus']['total']['aset'])->toBe($r['ringkasan']['aset_berpindah'])
            ->and(collect($r['tren'])->sum('aset_berpindah'))->toBe($r['ringkasan']['aset_berpindah'])
            ->and(collect($r['tren'])->sum('jumlah_mutasi'))->toBe($r['ringkasan']['disetujui'])
            ->and($r['arus']['total']['nilai'])->toBe($r['ringkasan']['nilai_perolehan']);
    }
});

it('returns zeros and empty lists for a user who sees nothing', function () {
    $recap = $this->service->for(User::factory()->create(), []);

    expect($recap['ringkasan']['jumlah_mutasi'])->toBe(0)
        ->and($recap['ringkasan']['rata_lama_proses'])->toBeNull()
        ->and(collect($recap['status'])->pluck('persen')->all())->toBe([0.0, 0.0, 0.0, 0.0])
        ->and($recap['tren'])->toBe([])
        ->and($recap['masih_berjalan'])->toBe([])
        ->and($recap['jumlah_masih_berjalan'])->toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `php artisan test tests/Feature/MutationRecapServiceTest.php`
Expected: FAIL (`Target class [App\Services\MutationRecapService] does not exist`).

- [ ] **Step 3: Implement**

`app/Support/Days.php`:

```php
<?php

namespace App\Support;

use Carbon\CarbonInterface;

class Days
{
    /** Days from $from to $to with one decimal (both the page and the Excel use this so they round alike). */
    public static function between(CarbonInterface $from, CarbonInterface $to): float
    {
        return round(($to->getTimestamp() - $from->getTimestamp()) / 86400, 1);
    }
}
```

`app/Services/MutationRecapService.php`:

```php
<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\ApproverType;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequestStep;
use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MutationRecapService
{
    private const MAX_FILLED_SPAN_MONTHS = 60;

    private const PENDING_LIMIT = 20;

    private const MOVED = 'COUNT(DISTINCT asset_mutations.id) as mutasi, COUNT(mi.id) as aset, COALESCE(SUM(ma.nilai_perolehan), 0) as nilai';

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function for(User $user, array $filters): array
    {
        $query = new ReportQuery($user);
        $base = fn (): QueryBuilder => $query->build('mutasi', $filters)->reorder()->toBase();
        $approved = fn (): QueryBuilder => $base()->where('asset_mutations.status', MutationStatus::Approved->value);
        $moved = fn (): QueryBuilder => $approved()
            ->join('asset_mutation_items as mi', 'mi.asset_mutation_id', '=', 'asset_mutations.id')
            ->join('assets as ma', 'ma.id', '=', 'mi.asset_id');

        $jumlah = $base()->count();
        $totals = $moved()->selectRaw(self::MOVED)->first();
        $durations = $this->durations($approved);

        $pending = fn () => $query->build('mutasi', $filters)->where('asset_mutations.status', MutationStatus::Pending->value);

        return [
            'ringkasan' => [
                'jumlah_mutasi' => $jumlah,
                'disetujui' => $approved()->count(),
                'aset_berpindah' => (int) $totals->aset,
                'nilai_perolehan' => (float) $totals->nilai,
                'rata_lama_proses' => $durations === [] ? null : round(array_sum($durations) / count($durations), 1),
                'terlama_proses' => $durations === [] ? null : max($durations),
            ],
            'status' => $this->komposisi(
                MutationStatus::cases(), 'status',
                $base()->selectRaw('asset_mutations.status as k, COUNT(*) as n')->groupBy('asset_mutations.status')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'jenis' => $this->komposisi(
                MutationType::cases(), 'jenis',
                $base()->selectRaw('asset_mutations.jenis_mutasi as k, COUNT(*) as n')->groupBy('asset_mutations.jenis_mutasi')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'tren' => $this->tren($moved()->selectRaw('asset_mutations.tanggal_mutasi as tanggal, '.self::MOVED)->groupBy('asset_mutations.tanggal_mutasi')->get()),
            'arus' => $this->arus($moved()
                ->selectRaw('asset_mutations.origin_unit_id as asal_id, asset_mutations.destination_unit_id as tujuan_id, '.self::MOVED)
                ->groupBy('asset_mutations.origin_unit_id', 'asset_mutations.destination_unit_id')
                ->get()),
            'masih_berjalan' => $this->masihBerjalan($pending),
            'jumlah_masih_berjalan' => $pending()->count(),
        ];
    }

    /**
     * @param  list<\BackedEnum&object>  $cases
     * @param  array<string, int>  $counts
     * @return list<array<string, mixed>>
     */
    private function komposisi(array $cases, string $key, array $counts, int $total): array
    {
        return array_map(function ($case) use ($key, $counts, $total) {
            $n = (int) ($counts[$case->value] ?? 0);

            return [
                $key => $case->value,
                'label' => $case->label(),
                'jumlah' => $n,
                'persen' => $total > 0 ? round($n / $total * 100, 1) : 0.0,
            ];
        }, $cases);
    }

    /** @return list<float> */
    private function durations(callable $approved): array
    {
        return DB::table('approval_requests as r')
            ->join('approval_actions as a', 'a.approval_request_id', '=', 'r.id')
            ->where('r.approvable_type', (new AssetMutation)->getMorphClass())
            ->whereIn('r.approvable_id', $approved()->select('asset_mutations.id'))
            ->where('a.action', ApprovalActionType::Approve->value)
            ->groupBy('r.id', 'r.created_at')
            ->selectRaw('r.created_at as diajukan, MAX(a.created_at) as selesai')
            ->get()
            ->map(fn ($row) => Days::between(Carbon::parse($row->diajukan), Carbon::parse($row->selesai)))
            ->all();
    }

    /** @return list<array{bulan: string, jumlah_mutasi: int, aset_berpindah: int}> */
    private function tren($rows): array
    {
        $months = [];
        foreach ($rows as $row) {
            $key = substr((string) $row->tanggal, 0, 7);
            $months[$key] ??= ['jumlah_mutasi' => 0, 'aset_berpindah' => 0];
            $months[$key]['jumlah_mutasi'] += (int) $row->mutasi;
            $months[$key]['aset_berpindah'] += (int) $row->aset;
        }

        if ($months === []) {
            return [];
        }

        ksort($months);
        $index = fn (string $ym) => ((int) substr($ym, 0, 4)) * 12 + (int) substr($ym, 5, 2);
        $first = $index(array_key_first($months));
        $last = $index(array_key_last($months));

        // ponytail: a mistyped date (e.g. 0202) would zero-fill thousands of months, so gaps are only filled for a plausible span.
        if ($last - $first > self::MAX_FILLED_SPAN_MONTHS) {
            return array_map(fn (string $ym) => ['bulan' => $ym] + $months[$ym], array_keys($months));
        }

        $result = [];
        for ($i = $first; $i <= $last; $i++) {
            $ym = sprintf('%04d-%02d', intdiv($i - 1, 12), ($i - 1) % 12 + 1);
            $result[] = ['bulan' => $ym] + ($months[$ym] ?? ['jumlah_mutasi' => 0, 'aset_berpindah' => 0]);
        }

        return $result;
    }

    /** @return array{baris: list<array<string, mixed>>, total: array<string, int|float>} */
    private function arus($rows): array
    {
        $names = Unit::whereIn('id', $rows->pluck('asal_id')->merge($rows->pluck('tujuan_id'))->unique())->pluck('name', 'id');
        $total = ['jumlah_mutasi' => 0, 'aset' => 0, 'nilai' => 0.0];

        $baris = $rows->map(function ($row) use ($names, &$total) {
            $total['jumlah_mutasi'] += (int) $row->mutasi;
            $total['aset'] += (int) $row->aset;
            $total['nilai'] += (float) $row->nilai;

            return [
                'asal_id' => (int) $row->asal_id, 'asal' => $names[$row->asal_id] ?? '-',
                'tujuan_id' => (int) $row->tujuan_id, 'tujuan' => $names[$row->tujuan_id] ?? '-',
                'jumlah_mutasi' => (int) $row->mutasi, 'aset' => (int) $row->aset, 'nilai' => (float) $row->nilai,
            ];
        })->sort(fn ($a, $b) => [$b['aset'], $a['asal'], $a['tujuan']] <=> [$a['aset'], $b['asal'], $b['tujuan']])->values()->all();

        return ['baris' => $baris, 'total' => $total];
    }

    /** @return list<array<string, mixed>> */
    private function masihBerjalan(callable $pending): array
    {
        return $pending()
            ->setEagerLoads([])
            ->with(['originUnit', 'destinationUnit', 'approvalRequest.steps.approverUser'])
            ->reorder('asset_mutations.created_at')
            ->orderBy('asset_mutations.id')
            ->limit(self::PENDING_LIMIT)
            ->get()
            ->map(function (AssetMutation $m) {
                $request = $m->approvalRequest;
                $step = $request?->steps->firstWhere('step_order', $request->current_step);

                return [
                    'id' => $m->id,
                    'nomor' => $m->nomor_mutasi,
                    'jenis' => $m->jenis_mutasi->label(),
                    'asal' => $m->originUnit?->name,
                    'tujuan' => $m->destinationUnit?->name,
                    'langkah' => $step?->label,
                    'menunggu' => $step ? $this->menunggu($step) : null,
                    'umur_hari' => max(0, (int) floor((now()->getTimestamp() - $m->created_at->getTimestamp()) / 86400)),
                    'url' => route('asset-mutations.show', $m),
                ];
            })
            ->all();
    }

    private function menunggu(ApprovalRequestStep $step): ?string
    {
        return match ($step->approver_type) {
            ApproverType::User => $step->approverUser?->name,
            ApproverType::AtasanUnit => 'Atasan Unit',
            ApproverType::Role => ucwords(str_replace('_', ' ', (string) $step->approver_role)),
        };
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/MutationRecapServiceTest.php`
Expected: PASS (11 tests). If the trend bucket for `0202-05-05` parses as year `202` instead of `0202`, the `sprintf('%04d')` fill is skipped anyway because the span exceeds 60 months; the keys come from `substr(..., 0, 7)` of the raw string, so they stay `0202-05`.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/Support/Days.php app/Services/MutationRecapService.php tests/Feature/MutationRecapServiceTest.php
git commit -m "feat: add MutationRecapService for the Laporan Mutasi recap"
```

---

## Task 3: One-sheet Excel (`MutationExcel`) and writer extensions

**Files:**
- Modify: `app/Services/ReportSheetWriter.php`
- Create: `app/Services/MutationExcel.php`
- Test: `tests/Feature/MutationExcelTest.php`

**Interfaces:**
- Consumes: `ReportQuery::build('mutasi', …)` (Task 1), `Days::between` (Task 2), `ReportSheetWriter::kop/table/scopeLabel/filterLabel`.
- Produces: `ReportSheetWriter` kind `decimal` (`0.0`) and filter labels for `jenis_mutasi`, `asal_id`, `tujuan_id` (order: category, kondisi, jenis, jenis_mutasi, status, asal_id, tujuan_id, dari, sampai); `MutationExcel::download(Illuminate\Database\Eloquent\Builder $query, array $filters, User $user): StreamedResponse`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/MutationExcelTest.php`:

```php
<?php

use App\Models\ApprovalAction;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Services\ApprovalWorkflowService;
use App\Services\MutationExcel;
use App\Services\MutationRecapService;
use App\Services\ReportQuery;
use Database\Seeders\WorkflowDefinitionSeeder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Spatie\Permission\Models\Role;

function meBuild($user, array $filters = []): Spreadsheet
{
    $query = (new ReportQuery($user))->build('mutasi', $filters);
    $response = app(MutationExcel::class)->download($query, $filters, $user);

    ob_start();
    $response->sendContent();
    $content = ob_get_clean();

    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $content);
    $spreadsheet = IOFactory::load($path);
    unlink($path);

    return $spreadsheet;
}

function meRows(Spreadsheet $book): array
{
    return $book->getActiveSheet()->toArray(null, true, false, false);
}

function meDate(mixed $serial): string
{
    return Date::excelToDateTimeObject($serial)->format('Y-m-d');
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);

    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004', 'nilai_perolehan' => 1000]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => 'Kursi', 'kode_barang' => '1.3.2.10.01.02.001', 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nama_aset' => 'Meja', 'nilai_perolehan' => 3000]);

    $this->m1 = AssetMutation::create([
        'nomor_mutasi' => 'M-1', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelA->id,
        'tanggal_mutasi' => '2026-08-10', 'status' => 'approved', 'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    foreach ([$this->a1, $this->a2] as $a) {
        AssetMutationItem::create(['asset_mutation_id' => $this->m1->id, 'asset_id' => $a->id]);
    }
    app(ApprovalWorkflowService::class)->submit($this->m1, 'mutasi_kec_ke_kel', $this->camat);
    $request = $this->m1->approvalRequest()->first();
    $request->forceFill(['created_at' => '2026-08-10 09:00:00'])->save();
    $action = ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => 1, 'user_id' => $this->camat->id, 'action' => 'approve']);
    $action->forceFill(['created_at' => '2026-08-12 09:00:00'])->save();

    $this->m2 = AssetMutation::create([
        'nomor_mutasi' => 'M-2', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelB->id,
        'tanggal_mutasi' => '2026-10-05', 'status' => 'pending', 'created_by' => $this->camat->id,
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $this->m2->id, 'asset_id' => $this->a3->id]);
});

it('writes exactly one sheet named Daftar Mutasi with the letterhead', function () {
    $book = meBuild($this->camat);
    $rows = meRows($book);

    expect($book->getSheetCount())->toBe(1)
        ->and($book->getActiveSheet()->getTitle())->toBe('Daftar Mutasi')
        ->and($rows[0][1])->toBe('PEMERINTAH KOTA BATAM')
        ->and($rows[1][1])->toBe('KECAMATAN SAGULUNG')
        ->and($rows[2][1])->toBe('Laporan Mutasi Aset')
        ->and($rows[4][0])->toStartWith('Cakupan: ')
        ->and($rows[5][0])->toBe('Filter: Tanpa filter')
        ->and($rows[6][0])->toStartWith('Dicetak: ')
        ->and($book->getActiveSheet()->getDrawingCollection())->toHaveCount(1)
        ->and(array_slice($rows[8], 0, 15))->toBe([
            'No', 'Nomor Mutasi', 'Tanggal', 'Jenis', 'Unit Asal', 'Unit Tujuan', 'Jumlah Aset', 'Daftar Aset',
            'Nilai Perolehan', 'Status', 'Diajukan Oleh', 'Tanggal Diajukan', 'Tanggal Selesai', 'Lama Proses (hari)', 'Keterangan',
        ]);
});

it('lists one row per mutation, newest first, with assets, dates and processing time', function () {
    $rows = meRows(meBuild($this->camat));
    $h = array_flip($rows[8]);

    expect($rows[9][$h['Nomor Mutasi']])->toBe('M-2')
        ->and($rows[10][$h['Nomor Mutasi']])->toBe('M-1');

    $m1 = $rows[10];
    expect($m1[$h['Jenis']])->toBe('Mutasi Kecamatan ke Kelurahan')
        ->and($m1[$h['Unit Tujuan']])->toBe('Kelurahan A')
        ->and((int) $m1[$h['Jumlah Aset']])->toBe(2)
        ->and($m1[$h['Daftar Aset']])->toContain('1.3.2.05.02.04.004 - =SUM(1+1)')
        ->and($m1[$h['Daftar Aset']])->toContain('1.3.2.10.01.02.001 - Kursi')
        ->and((float) $m1[$h['Nilai Perolehan']])->toBe(3000.0)
        ->and($m1[$h['Status']])->toBe('Disetujui')
        ->and($m1[$h['Keterangan']])->toBe('Pengisian stok')
        ->and(meDate($m1[$h['Tanggal']]))->toBe('2026-08-10')
        ->and(meDate($m1[$h['Tanggal Diajukan']]))->toBe('2026-08-10')
        ->and(meDate($m1[$h['Tanggal Selesai']]))->toBe('2026-08-12')
        ->and((float) $m1[$h['Lama Proses (hari)']])->toBe(2.0);

    $pending = $rows[9];
    expect($pending[$h['Tanggal Selesai']])->toBeNull()
        ->and($pending[$h['Lama Proses (hari)']])->toBeNull();
});

it('writes both total rows and they match the recap', function () {
    $rows = meRows(meBuild($this->camat));
    $h = array_flip($rows[8]);
    $recap = app(MutationRecapService::class)->for($this->camat, []);

    expect($rows[11][1])->toBe('Total Semua Status')
        ->and((int) $rows[11][$h['Jumlah Aset']])->toBe(3)
        ->and((float) $rows[11][$h['Nilai Perolehan']])->toBe(6000.0)
        ->and($rows[12][1])->toBe('Total Disetujui')
        ->and((int) $rows[12][$h['Jumlah Aset']])->toBe($recap['ringkasan']['aset_berpindah'])
        ->and((float) $rows[12][$h['Nilai Perolehan']])->toBe($recap['ringkasan']['nilai_perolehan']);
});

it('keeps mutation numbers and special text as text, and limits rows to the user scope', function () {
    $rows = meRows(meBuild($this->adminA));

    expect(array_slice($rows, 9, 1)[0][1])->toBe('M-1')
        ->and($rows[10][1])->toBe('Total Semua Status');

    $other = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $secret = AssetMutation::create([
        'nomor_mutasi' => '=HYPERLINK("x")', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kelA->id,
        'tanggal_mutasi' => '2026-10-20', 'status' => 'pending', 'created_by' => $this->camat->id,
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $secret->id, 'asset_id' => $other->id]);

    expect(meRows(meBuild($this->camat))[9][1])->toBe('=HYPERLINK("x")');
});

it('labels the filters in readable words', function () {
    $rows = meRows(meBuild($this->camat, [
        'jenis_mutasi' => 'kec_ke_kel', 'status' => 'approved', 'asal_id' => $this->kec->id, 'tujuan_id' => $this->kelA->id,
        'dari' => '2026-08-01', 'sampai' => '2026-10-31',
    ]));

    expect($rows[5][0])->toBe('Filter: Jenis Mutasi: Mutasi Kecamatan ke Kelurahan; Status: Disetujui; Unit Asal: '.$this->kec->name.'; Unit Tujuan: Kelurahan A; Dari: 2026-08-01; Sampai: 2026-10-31')
        ->and($rows[9][1])->toBe('M-1');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `php artisan test tests/Feature/MutationExcelTest.php`
Expected: FAIL (`Target class [App\Services\MutationExcel] does not exist`).

- [ ] **Step 3: Extend the writer**

In `app/Services/ReportSheetWriter.php`:

1. Add the import `use App\Enums\MutationType;` (alphabetical, after `use App\Enums\Kondisi;`).
2. Replace the `FORMATS` constant line with:

```php
    private const FORMATS = ['int' => '#,##0', 'money' => '#,##0', 'percent' => '0.0', 'decimal' => '0.0', 'year' => '0', 'date' => 'dd/mm/yyyy'];
```

3. In `writeRow`, replace `'int', 'money', 'percent', 'year' => $sheet->setCellValue($coordinate, $value),` with:

```php
                'int', 'money', 'percent', 'decimal', 'year' => $sheet->setCellValue($coordinate, $value),
```

4. In `filterLabel`, replace the line `        if (! empty($filters['status'])) {` with:

```php
        if (! empty($filters['jenis_mutasi'])) {
            $parts[] = 'Jenis Mutasi: '.(MutationType::tryFrom($filters['jenis_mutasi'])?->label() ?? $filters['jenis_mutasi']);
        }
        if (! empty($filters['status'])) {
```

and replace the line `        foreach (['dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {` with:

```php
        foreach (['asal_id' => 'Unit Asal', 'tujuan_id' => 'Unit Tujuan'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: ".(Unit::find($filters[$key])?->name ?? $filters[$key]);
            }
        }
        foreach (['dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {
```

- [ ] **Step 4: Implement the workbook**

`app/Services/MutationExcel.php`:

```php
<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\MutationStatus;
use App\Models\AssetMutation;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MutationExcel
{
    public function __construct(private readonly ReportSheetWriter $writer) {}

    /** @param  array<string, mixed>  $filters */
    public function download(Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            'laporan-mutasi-'.now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to a few thousand mutations, beyond that use a streaming writer.
     *
     * @param  array<string, mixed>  $filters
     */
    private function build(Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Daftar Mutasi');

        $columns = [
            ['No', 'int'], ['Nomor Mutasi', 'text'], ['Tanggal', 'date'], ['Jenis', 'text'], ['Unit Asal', 'text'],
            ['Unit Tujuan', 'text'], ['Jumlah Aset', 'int'], ['Daftar Aset', 'wrap'], ['Nilai Perolehan', 'money'],
            ['Status', 'text'], ['Diajukan Oleh', 'text'], ['Tanggal Diajukan', 'date'], ['Tanggal Selesai', 'date'],
            ['Lama Proses (hari)', 'decimal'], ['Keterangan', 'wrap'],
        ];

        $rows = [];
        $all = ['aset' => 0, 'nilai' => 0.0];
        $approved = ['aset' => 0, 'nilai' => 0.0];

        foreach ($query->get() as $index => $m) {
            /** @var AssetMutation $m */
            $jumlah = $m->items->count();
            $nilai = (float) $m->items->sum(fn ($item) => (float) ($item->asset?->nilai_perolehan ?? 0));
            $request = $m->approvalRequest;
            $diajukan = $request?->created_at;
            $selesai = $m->status === MutationStatus::Approved
                ? $request?->actions->where('action', ApprovalActionType::Approve)->max('created_at')
                : null;

            $all['aset'] += $jumlah;
            $all['nilai'] += $nilai;
            if ($m->status === MutationStatus::Approved) {
                $approved['aset'] += $jumlah;
                $approved['nilai'] += $nilai;
            }

            $rows[] = [
                $index + 1, $m->nomor_mutasi, $m->tanggal_mutasi, $m->jenis_mutasi->label(),
                $m->originUnit?->name, $m->destinationUnit?->name, $jumlah,
                $m->items->map(fn ($item) => ($item->asset?->kode_barang ?? '-').' - '.($item->asset?->nama_aset ?? '-'))->implode("\n"),
                $nilai, $m->status->label(), $m->creator?->name, $diajukan, $selesai,
                $diajukan !== null && $selesai !== null ? Days::between($diajukan, $selesai) : null,
                $m->keterangan,
            ];
        }

        $rows[] = [null, 'Total Semua Status', null, null, null, null, $all['aset'], null, $all['nilai']];
        $boldRows = [count($rows) - 1];
        $total = [null, 'Total Disetujui', null, null, null, null, $approved['aset'], null, $approved['nilai']];

        $start = $this->writer->kop(
            $sheet,
            'Laporan Mutasi Aset',
            $this->writer->scopeLabel($user, []),
            $this->writer->filterLabel($filters),
            count($columns),
        );
        $this->writer->table($sheet, $start, $columns, $rows, $total, $boldRows, true);

        return $spreadsheet;
    }
}
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/MutationExcelTest.php`
Expected: PASS (5 tests). The labelled-filter test passes `unit_id`-free filters, so the `Cakupan:` line is the user's whole scope (`scopeLabel` is called with `[]` because mutasi no longer has a `unit_id` filter).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/Services/ReportSheetWriter.php app/Services/MutationExcel.php tests/Feature/MutationExcelTest.php
git commit -m "feat: add the one-sheet Laporan Mutasi workbook"
```

---

## Task 4: Request, controller and routes

**Files:**
- Create: `app/Http/Requests/LaporanMutasiRequest.php`, `app/Http/Controllers/LaporanMutasiController.php`
- Create (stub, replaced in Task 7): `resources/js/Pages/LaporanMutasi/Index.tsx`
- Modify: `routes/web.php`
- Test: `tests/Feature/LaporanMutasiControllerTest.php`

**Interfaces:**
- Consumes: `MutationRecapService::for` (Task 2), `MutationExcel::download` (Task 3), `ReportQuery`.
- Produces: routes `laporan-mutasi.index` (`GET /laporan-mutasi`) → Inertia `LaporanMutasi/Index` with props `filters`, `sort{urut,arah}`, `ringkasan`, `status`, `jenis`, `tren`, `arus`, `masih_berjalan`, `jumlah_masih_berjalan`, `mutasis` (paginator), `unitOptions [{id,name,type}]`, `jenisOptions [{value,label}]`, `statusOptions [{value,label}]`; `laporan-mutasi.download` (`GET /laporan-mutasi/unduh`) → xlsx or 422. List row keys: `id, nomor_mutasi, tanggal_mutasi, jenis, jenis_label, asal, tujuan, jumlah_aset, nilai, status, pengaju, detail{keterangan, aset[{kode_barang,nama_aset,kategori,kondisi,nilai_perolehan,pemegang_tujuan,catatan}], persetujuan[{langkah,aksi,oleh,waktu,catatan}]}`. `LaporanMutasiRequest::SORTABLE`, `filters()`, `sorting()`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/LaporanMutasiControllerTest.php`:

```php
<?php

use App\Models\ApprovalAction;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function lmMutation(object $t, string $no, string $jenis, $origin, $dest, string $date, string $status, array $assets = []): AssetMutation
{
    $m = AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $jenis, 'origin_unit_id' => $origin->id, 'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $t->camat->id, 'keterangan' => "Ket {$no}",
    ]);

    foreach ($assets as $asset) {
        AssetMutationItem::create(['asset_mutation_id' => $m->id, 'asset_id' => $asset->id, 'catatan' => "Cat {$no}"]);
    }

    return $m;
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->otherKec = makeKecamatan('Kecamatan Lain');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->holder = Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'nama' => 'Budi Santoso']);
    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 1000, 'nama_aset' => 'Meja A']);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'nilai_perolehan' => 500]);

    $this->m1 = lmMutation($this, 'M-1', 'kec_ke_kel', $this->kec, $this->kelA, '2026-08-10', 'approved', [$this->a1, $this->a2]);
    AssetMutationItem::where('asset_mutation_id', $this->m1->id)->where('asset_id', $this->a1->id)->update(['target_holder_id' => $this->holder->id]);
    app(ApprovalWorkflowService::class)->submit($this->m1, 'mutasi_kec_ke_kel', $this->camat);
    $request = $this->m1->approvalRequest()->first();
    ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => 1, 'user_id' => $this->camat->id, 'action' => 'approve', 'note' => 'Setuju']);

    $this->m2 = lmMutation($this, 'M-2', 'kec_ke_kel', $this->kec, $this->kelB, '2026-10-05', 'approved', [$this->a2]);
    $this->m3 = lmMutation($this, 'M-3', 'antar_kel', $this->kelA, $this->kelB, '2026-10-07', 'pending', [$this->a3]);
    $this->m4 = lmMutation($this, 'M-4', 'internal', $this->kelB, $this->kelB, '2026-10-09', 'rejected', [$this->a3]);
    $this->m5 = lmMutation($this, 'M-5', 'internal', $this->otherKec, $this->otherKec, '2026-09-01', 'approved', [$this->a3]);
});

it('renders the page with recap, list rows and option lists for the camat', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('LaporanMutasi/Index')
            ->where('ringkasan.jumlah_mutasi', 4)
            ->where('mutasis.total', 4)
            ->has('status', 4)
            ->has('jenis', 4)
            ->has('tren')
            ->where('arus.total.jumlah_mutasi', 2)
            ->where('jumlah_masih_berjalan', 1)
            ->has('masih_berjalan', 1)
            ->has('jenisOptions', 4)
            ->has('statusOptions', 4)
            ->where('sort', ['urut' => 'tanggal_mutasi', 'arah' => 'desc']));
});

it('gives a list row its columns, the asset list and the approval history', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=nomor_mutasi&arah=asc')
        ->assertInertia(fn (Assert $p) => $p
            ->where('mutasis.data.0', fn ($row) => $row['nomor_mutasi'] === 'M-1'
                && $row['jenis'] === 'kec_ke_kel'
                && $row['jenis_label'] === 'Mutasi Kecamatan ke Kelurahan'
                && $row['asal'] === $this->kec->name
                && $row['tujuan'] === 'Kelurahan A'
                && $row['jumlah_aset'] === 2
                && $row['nilai'] == 3000
                && $row['status'] === 'approved'
                && $row['detail']['keterangan'] === 'Ket M-1'
                && count($row['detail']['aset']) === 2
                && collect($row['detail']['aset'])->contains(fn ($a) => $a['nama_aset'] === 'Meja A'
                    && $a['pemegang_tujuan'] === 'Budi Santoso' && $a['catatan'] === 'Cat M-1' && $a['nilai_perolehan'] == 1000)
                && count($row['detail']['persetujuan']) === 1
                && $row['detail']['persetujuan'][0]['aksi'] === 'approve'
                && $row['detail']['persetujuan'][0]['catatan'] === 'Setuju'));
});

it('limits a kelurahan admin to mutations touching the own unit and lists the counterpart units as options', function () {
    $this->actingAs($this->adminA)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p
            ->where('mutasis.total', 2)
            ->where('ringkasan.jumlah_mutasi', 2)
            ->where('unitOptions', fn ($units) => collect($units)->pluck('name')->sort()->values()->all() === collect([$this->kec->name, 'Kelurahan A', 'Kelurahan B'])->sort()->values()->all()));
});

it('lets the asal and tujuan filters only narrow, never widen', function () {
    $this->actingAs($this->adminA)->get('/laporan-mutasi?asal_id='.$this->kelB->id)
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 0)->where('ringkasan.jumlah_mutasi', 0));

    $this->actingAs($this->camat)->get('/laporan-mutasi?asal_id='.$this->kec->id.'&tujuan_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 1)->where('mutasis.data.0.nomor_mutasi', 'M-2'));
});

it('paginates 25 rows per page', function () {
    foreach (range(1, 28) as $i) {
        lmMutation($this, "P-{$i}", 'internal', $this->kelA, $this->kelA, '2026-10-10', 'pending');
    }

    $this->actingAs($this->adminA)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 30)->has('mutasis.data', 25)->where('mutasis.last_page', 2));
    $this->actingAs($this->adminA)->get('/laporan-mutasi?page=2')
        ->assertInertia(fn (Assert $p) => $p->has('mutasis.data', 5));
});

it('sorts by a whitelisted column and refuses anything else', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=jumlah_aset&arah=desc')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.data.0.nomor_mutasi', 'M-1')->where('sort', ['urut' => 'jumlah_aset', 'arah' => 'desc']));
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=nilai&arah=asc')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.data.3.nomor_mutasi', 'M-1'));

    $this->actingAs($this->camat)->getJson('/laporan-mutasi?urut=password')->assertUnprocessable()->assertJsonValidationErrors('urut');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?urut=nilai;drop table assets')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?arah=sideways')->assertUnprocessable()->assertJsonValidationErrors('arah');
});

it('validates the filters', function () {
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable()->assertJsonValidationErrors('sampai');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?jenis_mutasi=bogus')->assertUnprocessable()->assertJsonValidationErrors('jenis_mutasi');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?status=bogus')->assertUnprocessable()->assertJsonValidationErrors('status');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?asal_id=999999')->assertUnprocessable()->assertJsonValidationErrors('asal_id');
});

it('keeps the page total equal to the summary and handles an empty result', function () {
    $this->actingAs($this->kasubag)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 5)->where('ringkasan.jumlah_mutasi', 5));

    $this->actingAs($this->camat)->get('/laporan-mutasi?status=cancelled')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 0)->where('ringkasan.jumlah_mutasi', 0)->where('tren', []));
});

it('downloads the workbook and refuses an empty download', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan-mutasi/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-mutasi-'.now()->format('Y-m-d').'.xlsx');

    $this->actingAs($this->adminA)->getJson('/laporan-mutasi/unduh?status=cancelled')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan-mutasi/unduh?jenis_mutasi=bogus')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan-mutasi')->assertRedirect('/login');
    $this->get('/laporan-mutasi/unduh')->assertRedirect('/login');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `php artisan test tests/Feature/LaporanMutasiControllerTest.php`
Expected: FAIL (404 on `/laporan-mutasi`: route not defined).

- [ ] **Step 3: Request**

`app/Http/Requests/LaporanMutasiRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\MutationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LaporanMutasiRequest extends FormRequest
{
    public const SORTABLE = ['nomor_mutasi', 'tanggal_mutasi', 'jumlah_aset', 'nilai', 'status'];

    private const FILTER_KEYS = ['dari', 'sampai', 'jenis_mutasi', 'status', 'asal_id', 'tujuan_id'];

    public function authorize(): bool
    {
        return $this->user()->getRoleNames()->isNotEmpty();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'dari' => ['nullable', 'date'],
            'sampai' => ['nullable', 'date', 'after_or_equal:dari'],
            'jenis_mutasi' => ['nullable', Rule::enum(MutationType::class)],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'asal_id' => ['nullable', 'integer', 'exists:units,id'],
            'tujuan_id' => ['nullable', 'integer', 'exists:units,id'],
            'urut' => ['nullable', Rule::in(self::SORTABLE)],
            'arah' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }

    /** @return array<string, mixed> */
    public function filters(): array
    {
        return array_filter(
            $this->safe()->only(self::FILTER_KEYS),
            fn ($value) => $value !== null && $value !== '',
        );
    }

    /** @return array{urut: string, arah: string} */
    public function sorting(): array
    {
        return [
            'urut' => $this->validated('urut') ?: 'tanggal_mutasi',
            'arah' => $this->validated('arah') ?: 'desc',
        ];
    }
}
```

- [ ] **Step 4: Controller, routes, stub page**

`app/Http/Controllers/LaporanMutasiController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Http\Requests\LaporanMutasiRequest;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Unit;
use App\Services\MutationExcel;
use App\Services\MutationRecapService;
use App\Services\ReportQuery;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanMutasiController extends Controller
{
    private const PER_PAGE = 25;

    /** Fixed map: user input only picks a key, it never becomes SQL. */
    private const SORT_COLUMNS = [
        'nomor_mutasi' => 'asset_mutations.nomor_mutasi',
        'tanggal_mutasi' => 'asset_mutations.tanggal_mutasi',
        'jumlah_aset' => 'jumlah_aset',
        'nilai' => 'nilai',
        'status' => 'asset_mutations.status',
    ];

    public function index(LaporanMutasiRequest $request, MutationRecapService $recap): Response
    {
        $user = $request->user();
        $filters = $request->filters();
        $sort = $request->sorting();
        $query = new ReportQuery($user);

        $mutasis = $query->build('mutasi', $filters)
            ->select('asset_mutations.*')
            ->selectSub(
                AssetMutationItem::query()->selectRaw('COUNT(*)')->whereColumn('asset_mutation_items.asset_mutation_id', 'asset_mutations.id'),
                'jumlah_aset',
            )
            ->selectSub(
                DB::table('asset_mutation_items as mi')->join('assets as ma', 'ma.id', '=', 'mi.asset_id')
                    ->selectRaw('COALESCE(SUM(ma.nilai_perolehan), 0)')->whereColumn('mi.asset_mutation_id', 'asset_mutations.id'),
                'nilai',
            )
            ->reorder(self::SORT_COLUMNS[$sort['urut']], $sort['arah'])
            ->orderByDesc('asset_mutations.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (AssetMutation $m) => $this->row($m));

        $visible = fn () => $query->build('mutasi', [])->reorder()->toBase()->distinct();
        $unitIds = $visible()->pluck('asset_mutations.origin_unit_id')->merge($visible()->pluck('asset_mutations.destination_unit_id'))->unique();

        return Inertia::render('LaporanMutasi/Index', [
            'filters' => $filters,
            'sort' => $sort,
            ...$recap->for($user, $filters),
            'mutasis' => $mutasis,
            'unitOptions' => Unit::whereIn('id', $unitIds)->orderBy('type')->orderBy('name')->get(['id', 'name', 'type']),
            'jenisOptions' => array_map(fn (MutationType $c) => ['value' => $c->value, 'label' => $c->label()], MutationType::cases()),
            'statusOptions' => array_map(fn (MutationStatus $c) => ['value' => $c->value, 'label' => $c->label()], MutationStatus::cases()),
        ]);
    }

    public function unduh(LaporanMutasiRequest $request, MutationExcel $excel): StreamedResponse
    {
        $filters = $request->filters();
        $query = (new ReportQuery($request->user()))->build('mutasi', $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $excel->download($query, $filters, $request->user());
    }

    /** @return array<string, mixed> */
    private function row(AssetMutation $m): array
    {
        $steps = $m->approvalRequest?->steps ?? collect();

        return [
            'id' => $m->id,
            'nomor_mutasi' => $m->nomor_mutasi,
            'tanggal_mutasi' => $m->tanggal_mutasi?->format('Y-m-d'),
            'jenis' => $m->jenis_mutasi->value,
            'jenis_label' => $m->jenis_mutasi->label(),
            'asal' => $m->originUnit?->name,
            'tujuan' => $m->destinationUnit?->name,
            'jumlah_aset' => (int) $m->getAttribute('jumlah_aset'),
            'nilai' => (float) $m->getAttribute('nilai'),
            'status' => $m->status->value,
            'pengaju' => $m->creator?->name,
            'detail' => [
                'keterangan' => $m->keterangan,
                'aset' => $m->items->map(fn ($item) => [
                    'kode_barang' => $item->asset?->kode_barang,
                    'nama_aset' => $item->asset?->nama_aset,
                    'kategori' => $item->asset?->category?->parent?->name ?? $item->asset?->category?->name,
                    'kondisi' => $item->asset?->kondisi->value,
                    'nilai_perolehan' => (float) ($item->asset?->nilai_perolehan ?? 0),
                    'pemegang_tujuan' => $item->targetHolder?->nama,
                    'catatan' => $item->catatan,
                ])->values()->all(),
                'persetujuan' => ($m->approvalRequest?->actions ?? collect())->sortBy('id')->map(fn ($a) => [
                    'langkah' => $steps->firstWhere('step_order', $a->step_order)?->label,
                    'aksi' => $a->action->value,
                    'oleh' => $a->user?->name,
                    'waktu' => $a->created_at?->toIso8601String(),
                    'catatan' => $a->note,
                ])->values()->all(),
            ],
        ];
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\LaporanMutasiController;` (right after the `LaporanAsetController` import) and, inside the `auth` group right after the `laporan-aset` routes:

```php
    Route::get('/laporan-mutasi', [LaporanMutasiController::class, 'index'])->name('laporan-mutasi.index');
    Route::get('/laporan-mutasi/unduh', [LaporanMutasiController::class, 'unduh'])->name('laporan-mutasi.download');
```

Stub page (Task 7 replaces it):

```bash
mkdir -p resources/js/Pages/LaporanMutasi
printf "export default function Index() {\n    return null;\n}\n" > resources/js/Pages/LaporanMutasi/Index.tsx
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/LaporanMutasiControllerTest.php`
Expected: PASS (10 tests). If sorting by the alias `jumlah_aset`/`nilai` fails on SQLite with "no such column", the alias must be used unquoted: fall back to `reorder(DB::raw($column), $dir)` — the value still comes only from the fixed `SORT_COLUMNS` map — and ledger a ruling.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Requests/LaporanMutasiRequest.php app/Http/Controllers/LaporanMutasiController.php routes/web.php resources/js/Pages/LaporanMutasi/Index.tsx tests/Feature/LaporanMutasiControllerTest.php
git commit -m "feat: add the Laporan Mutasi page and download endpoints"
```

---

## Task 5: Retire "mutasi" from the old tabbed Laporan page

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`, `app/Http/Requests/ReportRequest.php`, `app/Services/ReportExporter.php`, `routes/web.php`, `resources/js/Pages/Report/Index.tsx`
- Replace: `tests/Feature/ReportDownloadTest.php`

**Interfaces:**
- Produces: `/laporan` serves only `rusak-hilang` (default); `ReportRequest::PAGE_KINDS = ['rusak-hilang']`; download route constraint `rusak-hilang` (`/laporan/mutasi/unduh` and `/laporan/aset/unduh` → 404; `?laporan=mutasi` → 422).

- [ ] **Step 1: Rewrite the old download test (RED against the current code)**

Replace `tests/Feature/ReportDownloadTest.php` with:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
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

    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);

    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B']);
});

it('downloads the damaged/lost report limited to the user scope', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2026/0002']);

    $response = $this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh');
    expect($response->headers->get('content-disposition'))->toContain('laporan-rusak-hilang-'.now()->format('Y-m-d').'.xlsx');

    $rep = xlsxRows($response);
    $heading = array_flip($rep[5]);
    expect($rep[0][0])->toBe('Laporan Aset Rusak dan Hilang')
        ->and($rep[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($rep[2][0])->toBe('Filter: Tanpa filter')
        ->and(array_slice($rep, 6))->toHaveCount(1)
        ->and($rep[6][$heading['Nomor Laporan']])->toBe('LP/2026/0001')
        ->and($rep[6][$heading['Kronologi']])->toBe('Patah kaki');
});

it('labels filters with their readable names in the file header', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'status' => 'approved']);

    $rows = xlsxRows($this->actingAs($this->adminA)->get('/laporan/rusak-hilang/unduh?jenis=hilang&status=approved'));

    expect($rows[2][0])->toBe('Filter: Jenis: Hilang; Status: Disetujui');
});

it('refuses a unit out of scope, retired or unknown reports and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/aset/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->get('/laporan/mutasi/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/rusak-hilang/unduh')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?jenis=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=aset')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=mutasi')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/rusak-hilang/unduh')->assertRedirect('/login');
});

it('defaults to the damaged/lost report and its row count equals the rows in the file', function () {
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/1']);
    AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'nomor_laporan' => 'LP/2']);

    $this->actingAs($this->camat)->get('/laporan')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'rusak-hilang')
            ->where('rowCount', 2)
            ->has('units', 3)
            ->missing('categories')
            ->missing('kondisiOptions'));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/rusak-hilang/unduh'));
    expect(array_slice($file, 6))->toHaveCount(2);

    $this->actingAs($this->adminA)->get('/laporan?laporan=rusak-hilang')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 1)->where('units', []));
});
```

Run: `php artisan test tests/Feature/ReportDownloadTest.php`
Expected: FAIL (the old code still serves mutasi: `?laporan=mutasi` is accepted and `/laporan/mutasi/unduh` is not 404).

- [ ] **Step 2: Backend changes**

`app/Http/Requests/ReportRequest.php`: change `public const PAGE_KINDS = ['mutasi', 'rusak-hilang'];` to

```php
    public const PAGE_KINDS = ['rusak-hilang'];
```

`app/Http/Controllers/ReportController.php`: change `$kind = $request->input('laporan') ?: 'mutasi';` to

```php
        $kind = $request->input('laporan') ?: 'rusak-hilang';
```

`routes/web.php`: change the download constraint `->where('laporan', 'mutasi|rusak-hilang')` to

```php
        ->where('laporan', 'rusak-hilang')
```

`app/Services/ReportExporter.php`:
- remove the `'mutasi' => 'Laporan Riwayat Mutasi',` entry from `TITLES`;
- delete the whole `'mutasi' => [ … ],` arm of `columns()` (from `'mutasi' => [` through its closing `],`);
- remove the now-unused `use App\Models\AssetMutation;`.

- [ ] **Step 3: Frontend: the old page keeps only Rusak & Hilang**

Replace `resources/js/Pages/Report/Index.tsx` with:

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Filters = Record<string, string | number | undefined>;

interface ReportProps extends PageProps {
    laporan: 'rusak-hilang';
    filters: Filters;
    rowCount: number;
    units: { id: number; name: string; type: string }[];
}

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
    const apply = (data: Filters) =>
        router.get(route('report.index'), clean({ ...data, laporan }), { preserveScroll: true, preserveState: 'errors', replace: true });

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

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset Rusak & Hilang" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Rusak &amp; Hilang</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Aset Rusak &amp; Hilang</h1>
                </div>

                {errorMessages.length > 0 && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {errorMessages.map((m) => <p key={m}>{m}</p>)}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply(form);
                    }}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {date('dari', 'Dari tanggal kejadian')}
                        {date('sampai', 'Sampai tanggal kejadian')}
                        {units.length > 0 && select('unit_id', 'Unit', units.map((u) => ({ value: u.id, label: u.name })), 'Semua unit')}
                        {select('jenis', 'Jenis', [{ value: 'rusak', label: 'Rusak' }, { value: 'hilang', label: 'Hilang' }], 'Semua jenis')}
                        {select('status', 'Status', STATUS_OPTIONS, 'Semua status')}
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
Expected: all green (`ReportQueryTest` still builds the `mutasi` and `aset` queries directly).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ReportController.php app/Http/Requests/ReportRequest.php app/Services/ReportExporter.php routes/web.php resources/js/Pages/Report/Index.tsx tests/Feature/ReportDownloadTest.php
git commit -m "refactor: retire the mutasi report from the old tabbed Laporan page"
```

---

## Task 6: Frontend foundations (colours, DonutChart, TrenMutasiChart, types)

**Files:**
- Create: `resources/js/lib/chartColors.ts`, `resources/js/Components/Charts/DonutChart.tsx`, `resources/js/Components/Charts/TrenMutasiChart.tsx`
- Delete: `resources/js/Components/Charts/KondisiChart.tsx`
- Modify: `resources/js/Pages/LaporanAset/Index.tsx`, `resources/js/lib/format.ts`, `resources/js/types/index.d.ts`

**Interfaces:**
- Produces: `KONDISI_COLOR`, `STATUS_COLOR`, `JENIS_COLOR` from `@/lib/chartColors`; `<DonutChart data={DonutSlice[]} ariaLabel={string} />` (`DonutSlice = {label, jumlah, persen, color}`); `<TrenMutasiChart data={LaporanMutasiData['tren']} />`; `bulanLabel(ym: string): string` in `@/lib/format`; types `LaporanMutasiRow`, `LaporanMutasiData`.

- [ ] **Step 1: Colours and format helper**

`resources/js/lib/chartColors.ts`:

```ts
export const KONDISI_COLOR: Record<string, string> = {
    baik: '#047857',
    rusak_ringan: '#B45309',
    rusak_berat: '#B91C1C',
    hilang: '#4B5563',
};

export const STATUS_COLOR: Record<string, string> = {
    approved: '#047857',
    pending: '#B45309',
    rejected: '#B91C1C',
    cancelled: '#4B5563',
};

export const JENIS_COLOR: Record<string, string> = {
    kec_ke_kel: '#1E40AF',
    antar_kel: '#60A5FA',
    retur_kel_ke_kec: '#94A3B8',
    internal: '#334155',
};
```

Append to `resources/js/lib/format.ts`:

```ts

/** "2026-10" -> "Okt 2026". */
export const bulanLabel = (ym: string): string => {
    const [year, month] = ym.split('-').map(Number);

    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
};
```

- [ ] **Step 2: Generic donut and Laporan Aset migration**

`resources/js/Components/Charts/DonutChart.tsx`:

```tsx
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

export interface DonutSlice {
    label: string;
    jumlah: number;
    persen: number;
    color: string;
}

export default function DonutChart({ data, ariaLabel, unit = 'aset' }: { data: DonutSlice[]; ariaLabel: string; unit?: string }) {
    const total = data.reduce((sum, s) => sum + s.jumlah, 0);

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    return (
        <div className="mx-auto h-56 w-56">
            <Doughnut
                data={{
                    labels: data.map((s) => s.label),
                    datasets: [{ data: data.map((s) => s.jumlah), backgroundColor: data.map((s) => s.color), borderWidth: 2, borderColor: '#FFFFFF' }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${data[ctx.dataIndex].jumlah} ${unit} (${data[ctx.dataIndex].persen}%)` } },
                    },
                }}
                aria-label={ariaLabel}
                role="img"
            />
        </div>
    );
}
```

Delete `resources/js/Components/Charts/KondisiChart.tsx` (`git rm resources/js/Components/Charts/KondisiChart.tsx`).

In `resources/js/Pages/LaporanAset/Index.tsx`:
- replace the first import line `import KondisiChart, { KONDISI_COLOR } from '@/Components/Charts/KondisiChart';` with

```tsx
import DonutChart from '@/Components/Charts/DonutChart';
```

- add (anywhere among the other imports, e.g. right after `import { KONDISI_LABEL } from '@/lib/assetReport';`)

```tsx
import { KONDISI_COLOR } from '@/lib/chartColors';
```

- replace `<KondisiChart data={kondisi} />` with

```tsx
<DonutChart
    ariaLabel="Grafik persentase aset menurut kondisi"
    data={kondisi.map((k) => ({ label: k.label, jumlah: k.jumlah, persen: k.persen, color: KONDISI_COLOR[k.kondisi] }))}
/>
```

- [ ] **Step 3: Trend chart**

`resources/js/Components/Charts/TrenMutasiChart.tsx`:

```tsx
import { bulanLabel } from '@/lib/format';
import { LaporanMutasiData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Tren = LaporanMutasiData['tren'];

export default function TrenMutasiChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada mutasi yang disetujui.</p>;
    }

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 40 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => items[0].label,
                    label: (ctx) => {
                        const row = data[ctx.dataIndex];
                        return [`${row.jumlah_mutasi} mutasi disetujui`, `${row.aset_berpindah} aset berpindah`];
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
                    return [`${row.jumlah_mutasi} mutasi`, `${row.aset_berpindah} aset`];
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
                        labels: data.map((d) => bulanLabel(d.bulan)),
                        datasets: [{ data: data.map((d) => d.jumlah_mutasi), backgroundColor: '#1E40AF', borderRadius: 2, barPercentage: 0.6 }],
                    }}
                    options={options}
                    plugins={[ChartDataLabels]}
                    aria-label="Grafik jumlah mutasi disetujui per bulan"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Mutasi disetujui per bulan</caption>
                <thead><tr><th>Bulan</th><th>Mutasi</th><th>Aset berpindah</th></tr></thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.bulan}><td>{bulanLabel(d.bulan)}</td><td>{d.jumlah_mutasi}</td><td>{d.aset_berpindah}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 4: Types**

Append to `resources/js/types/index.d.ts`:

```ts

export interface LaporanMutasiRow {
    id: number;
    nomor_mutasi: string;
    tanggal_mutasi: string;
    jenis: MutationType;
    jenis_label: string;
    asal: string | null;
    tujuan: string | null;
    jumlah_aset: number;
    nilai: number;
    status: MutationStatus;
    pengaju: string | null;
    detail: {
        keterangan: string | null;
        aset: {
            kode_barang: string | null;
            nama_aset: string | null;
            kategori: string | null;
            kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang' | null;
            nilai_perolehan: number;
            pemegang_tujuan: string | null;
            catatan: string | null;
        }[];
        persetujuan: {
            langkah: string | null;
            aksi: 'approve' | 'reject' | 'cancel' | 'reassign';
            oleh: string | null;
            waktu: string | null;
            catatan: string | null;
        }[];
    };
}

export interface LaporanMutasiData {
    filters: Record<string, string | number>;
    sort: { urut: string; arah: 'asc' | 'desc' };
    ringkasan: {
        jumlah_mutasi: number;
        disetujui: number;
        aset_berpindah: number;
        nilai_perolehan: number;
        rata_lama_proses: number | null;
        terlama_proses: number | null;
    };
    status: { status: MutationStatus; label: string; jumlah: number; persen: number }[];
    jenis: { jenis: MutationType; label: string; jumlah: number; persen: number }[];
    tren: { bulan: string; jumlah_mutasi: number; aset_berpindah: number }[];
    arus: {
        baris: { asal_id: number; asal: string; tujuan_id: number; tujuan: string; jumlah_mutasi: number; aset: number; nilai: number }[];
        total: { jumlah_mutasi: number; aset: number; nilai: number };
    };
    masih_berjalan: {
        id: number;
        nomor: string;
        jenis: string;
        asal: string | null;
        tujuan: string | null;
        langkah: string | null;
        menunggu: string | null;
        umur_hari: number;
        url: string;
    }[];
    jumlah_masih_berjalan: number;
    mutasis: Paginated<LaporanMutasiRow>;
    unitOptions: { id: number; name: string; type: string }[];
    jenisOptions: { value: string; label: string }[];
    statusOptions: { value: string; label: string }[];
}
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/chartColors.ts resources/js/lib/format.ts resources/js/types/index.d.ts resources/js/Components/Charts/DonutChart.tsx resources/js/Components/Charts/TrenMutasiChart.tsx resources/js/Pages/LaporanAset/Index.tsx
git commit -m "refactor: share a generic DonutChart and add the mutation trend chart"
```

(The deletion of `KondisiChart.tsx` is already staged by the earlier `git rm`.)

---

## Task 7: The Laporan Mutasi page, menu and docs

**Files:**
- Replace stub: `resources/js/Pages/LaporanMutasi/Index.tsx`
- Modify: `resources/js/config/navigation.ts`, `docs/superpowers/specs/2026-10-06-laporan-mutasi-design.md`, `docs/DETAIL_RBAC_SISTEM.md`

**Interfaces:**
- Consumes: props from Task 4 (`LaporanMutasiData`), `DonutChart`, `TrenMutasiChart`, `STATUS_COLOR`/`JENIS_COLOR`, `rupiah`, `pageNumbersWithGaps`, `KONDISI_LABEL`, routes `laporan-mutasi.index`, `laporan-mutasi.download`, `dashboard`.

- [ ] **Step 1: Menu**

In `resources/js/config/navigation.ts` change

```ts
            { label: 'Laporan Mutasi', href: '/laporan?laporan=mutasi', icon: 'shuffle' },
```

to

```ts
            { label: 'Laporan Mutasi', href: '/laporan-mutasi', icon: 'shuffle' },
```

- [ ] **Step 2: Page**

`resources/js/Pages/LaporanMutasi/Index.tsx`:

```tsx
import DonutChart from '@/Components/Charts/DonutChart';
import TrenMutasiChart from '@/Components/Charts/TrenMutasiChart';
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { JENIS_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { LaporanMutasiData, PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useState } from 'react';

type Filters = Record<string, string | number | undefined>;

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

const STATUS_BADGE: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-300',
};

const AKSI_LABEL: Record<string, string> = {
    approve: 'Disetujui',
    reject: 'Ditolak',
    cancel: 'Dibatalkan',
    reassign: 'Approver dialihkan',
};

const COLUMNS: { key: string; label: string; sort?: string; align?: 'right' }[] = [
    { key: 'nomor', label: 'Nomor', sort: 'nomor_mutasi' },
    { key: 'tanggal', label: 'Tanggal', sort: 'tanggal_mutasi' },
    { key: 'jenis', label: 'Jenis' },
    { key: 'asal', label: 'Asal' },
    { key: 'tujuan', label: 'Tujuan' },
    { key: 'jumlah', label: 'Jumlah Aset', sort: 'jumlah_aset', align: 'right' },
    { key: 'nilai', label: 'Nilai', sort: 'nilai', align: 'right' },
    { key: 'status', label: 'Status', sort: 'status' },
    { key: 'pengaju', label: 'Pengaju' },
];

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

const tanggal = (value: string | null) => (value ? new Date(value).toLocaleDateString('id-ID') : '—');

function Badge({ label, style }: { label: string; style: string }) {
    return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}

function Legend({ items }: { items: { label: string; jumlah: number; persen: number; color: string }[] }) {
    return (
        <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-800">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
                        {i.label}
                    </span>
                    <span className="tabular-nums text-slate-600">{i.jumlah.toLocaleString('id-ID')} mutasi · {i.persen.toLocaleString('id-ID')}%</span>
                </li>
            ))}
        </ul>
    );
}

export default function Index(props: PageProps & LaporanMutasiData) {
    const { filters, sort, ringkasan, status, jenis, tren, arus, masih_berjalan: masihBerjalan, jumlah_masih_berjalan: jumlahBerjalan, mutasis, unitOptions, jenisOptions, statusOptions } = props;
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    const [form, setForm] = useState<Filters>(filters);
    const [open, setOpen] = useState<number | null>(null);
    const dirty = signature(form) !== signature(filters);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));

    const visit = (extra: Filters, base: Filters = filters) =>
        router.get(route('laporan-mutasi.index'), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });

    const downloadUrl = `${route('laporan-mutasi.download')}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const pages = pageNumbersWithGaps(mutasis.current_page, mutasis.last_page);

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

    const unitOpts = unitOptions.map((u) => ({ value: u.id, label: u.name }));

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Mutasi" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Mutasi</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Mutasi</h1>
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
                        {date('dari', 'Dari tanggal')}
                        {date('sampai', 'Sampai tanggal')}
                        {select('jenis_mutasi', 'Jenis', jenisOptions, 'Semua jenis')}
                        {select('status', 'Status', statusOptions, 'Semua status')}
                        {select('asal_id', 'Unit Asal', unitOpts, 'Semua unit asal')}
                        {select('tujuan_id', 'Unit Tujuan', unitOpts, 'Semua unit tujuan')}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900 tabular-nums">{mutasis.total}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {mutasis.total > 0 && !dirty ? (
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Stat label="Jumlah Mutasi" value={ringkasan.jumlah_mutasi.toLocaleString('id-ID')} note="Semua status" />
                    <Stat label="Mutasi Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <Stat label="Aset Berpindah" value={ringkasan.aset_berpindah.toLocaleString('id-ID')} note="Hanya mutasi Disetujui" />
                    <Stat label="Nilai Perolehan Aset Berpindah" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya mutasi Disetujui" />
                    <Stat label="Rata-rata Lama Proses" value={ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Status</p>
                        <DonutChart
                            unit="mutasi"
                            ariaLabel="Grafik komposisi mutasi menurut status"
                            data={status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }))}
                        />
                        <Legend items={status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }))} />
                    </div>
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Jenis Mutasi</p>
                        <DonutChart
                            unit="mutasi"
                            ariaLabel="Grafik komposisi mutasi menurut jenis"
                            data={jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }))}
                        />
                        <Legend items={jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }))} />
                    </div>
                </div>

                <div className={CARD}>
                    <p className="mb-1 text-lg font-semibold text-slate-900">Tren Mutasi per Bulan</p>
                    <p className="mb-4 text-xs text-slate-500">Hanya mutasi Disetujui, menurut tanggal mutasi.</p>
                    <TrenMutasiChart data={tren} />
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Arus Antar Unit</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Unit Asal</th>
                                    <th className={TH}>Unit Tujuan</th>
                                    <th className={`${TH} text-right`}>Mutasi</th>
                                    <th className={`${TH} text-right`}>Aset</th>
                                    <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {arus.baris.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada mutasi yang disetujui.</td></tr>
                                )}
                                {arus.baris.map((r) => (
                                    <tr key={`${r.asal_id}-${r.tujuan_id}`}>
                                        <td className="px-4 py-3 font-medium">{r.asal}</td>
                                        <td className="px-4 py-3">{r.tujuan}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.jumlah_mutasi.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.aset.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.nilai)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                    <td className="px-4 py-3" colSpan={2}>Total</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{arus.total.jumlah_mutasi.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{arus.total.aset.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{rupiah(arus.total.nilai)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <p className="text-lg font-semibold text-slate-900">Kinerja Persetujuan</p>
                        <p className="text-sm text-slate-600 tabular-nums">
                            Rata-rata {ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`}
                            {' · '}
                            Terlama {ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`}
                        </p>
                    </div>
                    <p className="px-5 pt-4 text-sm font-semibold text-slate-900">Masih Berjalan</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Nomor</th>
                                    <th className={TH}>Jenis</th>
                                    <th className={TH}>Asal → Tujuan</th>
                                    <th className={TH}>Langkah</th>
                                    <th className={TH}>Menunggu</th>
                                    <th className={`${TH} text-right`}>Umur</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {masihBerjalan.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Tidak ada mutasi yang masih berjalan.</td></tr>
                                )}
                                {masihBerjalan.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-3 font-medium tabular-nums">
                                            <Link href={m.url} className="text-blue-700 hover:underline">{m.nomor}</Link>
                                        </td>
                                        <td className="px-4 py-3">{m.jenis}</td>
                                        <td className="px-4 py-3">{m.asal} → {m.tujuan}</td>
                                        <td className="px-4 py-3">{m.langkah ?? '—'}</td>
                                        <td className="px-4 py-3">{m.menunggu ?? '—'}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{m.umur_hari} hari</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} mutasi yang masih berjalan.
                        </p>
                    )}
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Daftar Rinci</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>No</th>
                                    {COLUMNS.map((c) => (
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
                                {mutasis.data.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Tidak ada mutasi yang cocok.</td></tr>
                                )}
                                {mutasis.data.map((m, i) => (
                                    <Fragment key={m.id}>
                                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === m.id ? null : m.id)}>
                                            <td className="px-4 py-3 tabular-nums">
                                                <button type="button" aria-expanded={open === m.id} aria-label={`Detail ${m.nomor_mutasi}`} className="mr-2 text-slate-400 hover:text-blue-700">
                                                    {open === m.id ? '▾' : '▸'}
                                                </button>
                                                {(mutasis.from ?? 1) + i}
                                            </td>
                                            <td className="px-4 py-3 font-medium tabular-nums">{m.nomor_mutasi}</td>
                                            <td className="px-4 py-3 tabular-nums">{tanggal(m.tanggal_mutasi)}</td>
                                            <td className="px-4 py-3">{m.jenis_label}</td>
                                            <td className="px-4 py-3">{m.asal}</td>
                                            <td className="px-4 py-3">{m.tujuan}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{m.jumlah_aset}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(m.nilai)}</td>
                                            <td className="px-4 py-3"><Badge label={statusLabel[m.status] ?? m.status} style={STATUS_BADGE[m.status]} /></td>
                                            <td className="px-4 py-3">{m.pengaju ?? '—'}</td>
                                        </tr>
                                        {open === m.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={10} className="space-y-4 px-4 py-4">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase text-slate-500">Keterangan</p>
                                                        <p className="whitespace-pre-line text-sm text-slate-900">{m.detail.keterangan ?? '—'}</p>
                                                    </div>

                                                    <div>
                                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Aset yang dimutasi</p>
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                            <table className="w-full border-collapse text-left text-xs">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                                        <th className="px-3 py-2">Kode Barang</th>
                                                                        <th className="px-3 py-2">Nama Aset</th>
                                                                        <th className="px-3 py-2">Kategori</th>
                                                                        <th className="px-3 py-2">Kondisi</th>
                                                                        <th className="px-3 py-2 text-right">Nilai</th>
                                                                        <th className="px-3 py-2">Pemegang Tujuan</th>
                                                                        <th className="px-3 py-2">Catatan</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                                                    {m.detail.aset.map((a, idx) => (
                                                                        <tr key={`${a.kode_barang}-${idx}`}>
                                                                            <td className="px-3 py-2 tabular-nums">{a.kode_barang ?? '—'}</td>
                                                                            <td className="px-3 py-2 font-medium">{a.nama_aset ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.kategori ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.kondisi ? (KONDISI_LABEL[a.kondisi] ?? a.kondisi) : '—'}</td>
                                                                            <td className="px-3 py-2 text-right tabular-nums">{rupiah(a.nilai_perolehan)}</td>
                                                                            <td className="px-3 py-2">{a.pemegang_tujuan ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.catatan ?? '—'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Riwayat persetujuan</p>
                                                        {m.detail.persetujuan.length === 0 ? (
                                                            <p className="text-sm text-slate-500">Belum ada aksi persetujuan.</p>
                                                        ) : (
                                                            <ol className="space-y-2 border-l border-slate-200 pl-4 text-sm">
                                                                {m.detail.persetujuan.map((p, idx) => (
                                                                    <li key={idx}>
                                                                        <p className="font-medium text-slate-900">
                                                                            {AKSI_LABEL[p.aksi] ?? p.aksi}{p.langkah ? ` — ${p.langkah}` : ''}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {p.oleh ?? '—'}
                                                                            {p.waktu && ` · ${new Date(p.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`}
                                                                        </p>
                                                                        {p.catatan && <p className="text-xs text-slate-600">{p.catatan}</p>}
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        )}
                                                    </div>
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
                            Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{mutasis.from ?? 0}-{mutasis.to ?? 0}</span> dari{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">{mutasis.total}</span> mutasi
                        </p>
                        {mutasis.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => visit({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === mutasis.current_page ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
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

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Docs**

In `docs/superpowers/specs/2026-10-06-laporan-mutasi-design.md` change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-10-06-laporan-mutasi.md).`

In `docs/DETAIL_RBAC_SISTEM.md` change the end of the `**Laporan & Rekapitulasi Excel**` row from `Mutasi dan Rusak & Hilang menyusul` to `Laporan Mutasi (`/laporan-mutasi`, `MutationRecapService`); Rusak & Hilang menyusul`.

- [ ] **Step 5: Manual verification (browser)** — **SKIPPED by instruction.** The project owner asked for no browser testing until they say so; ledger it. Checklist for later: sidebar `Laporan Mutasi` opens `/laporan-mutasi`; the page for Kasubag, Camat and a kelurahan admin (unit option lists include the counterpart unit); donuts and the monthly trend labels (mutasi + aset), horizontal scroll with many months; Arus table and totals; Masih Berjalan links open the mutation; row click opens the detail with assets and approval history; sort headers and pagination; Unduh Excel opens in Excel with the logo letterhead, one sheet `Daftar Mutasi`, the two total rows and wrapped `Daftar Aset` cells; `Laporan Aset` donut still renders after the `DonutChart` refactor.

- [ ] **Step 6: Full regression and commit**

Run: `php artisan test`
Expected: all green.

```bash
git add resources/js/Pages/LaporanMutasi/Index.tsx resources/js/config/navigation.ts docs/superpowers/specs/2026-10-06-laporan-mutasi-design.md docs/DETAIL_RBAC_SISTEM.md
git commit -m "feat: build the Laporan Mutasi page and point the menu to it"
```
