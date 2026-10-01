# Dashboard Rekap & Laporan Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every role gets a dashboard (asset recap, work queue, recent activity, asset value) limited to the units they may see, and a "Laporan" page that downloads three Excel reports (asset list, mutation history, damaged/lost assets) limited the same way.

**Architecture:** `DashboardService` computes everything with aggregate queries from the user's unit scope (`User::accessibleUnitIds()`); `DashboardController` + `Dashboard.tsx` render it. `ReportQuery` is the single place that applies scope and filters for each report, used both by the page (row count) and by `ReportExporter` (PhpSpreadsheet, one sheet per download). `ReportRequest` validates filters and refuses units outside the user's scope.

**Tech Stack:** Laravel 13, Inertia 2 + React 18 + TypeScript, Tailwind v3, Pest 5, `phpoffice/phpspreadsheet` (new composer dependency).

**Spec:** `docs/superpowers/specs/2026-10-04-dashboard-laporan-design.md`

## Global Constraints

- Scope is always `User::accessibleUnitIds()` (`null` = all units: Kasubag; camat = own unit + child kelurahan; others own unit; no role / no unit = `[]`, sees nothing). Never trust a `unit_id` from the client.
- Dashboard `unit_id` filter: applied only when the scope has more than one unit and the id is in scope; otherwise ignored (full scope). Report `unit_id` outside scope: HTTP 422.
- Dashboard activity feed: 10 newest `asset_histories` whose `unit_id` is in scope; the per-unit table always shows the full scope (not narrowed by the unit filter).
- Reports: Daftar aset = `Asset::visibleTo`; Riwayat mutasi = mutations whose origin OR destination unit is in scope; Aset rusak & hilang = reports whose `unit_id` is in scope. Dates are inclusive.
- Excel: one sheet; rows 1-4 title / `Cakupan:` / `Filter:` / `Dicetak:`; row 6 headings (bold, frozen below); data from row 7. **Every text cell is written as an explicit string** (keeps `0007` and numeric-looking `kode_barang`, and prevents formula injection from user-entered text); money as numbers with `#,##0`; dates as Excel dates with `dd/mm/yyyy`. File name `laporan-{aset|mutasi|rusak-hilang}-{Y-m-d}.xlsx`.
- A report with zero rows is never downloaded: `GET /laporan/{laporan}/unduh` answers 422; the page disables the button.
- The report kind query parameter on the page is `laporan` (not `jenis`, which is already a filter of the rusak-hilang report) — see Rulings below.
- Charts are CSS bars; no chart library. UI copy in Bahasa Indonesia. `/scan`-style mobile-first spacing; `AuthenticatedLayout` on every page.
- PHP ^8.3, MySQL in dev/prod, SQLite `:memory:` in tests: aggregate SQL must work on both (`COALESCE`, `SUM`, `GROUP BY` only).
- No JS test runner: frontend is verified by `tsc`, `npm run build` and manual browser checks.
- **Commits: plain message only. Never add a `Co-Authored-By` (or any Claude attribution) line. Stage files by explicit path (never `git add docs` / `git add .`): the untracked `docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx` must stay out of commits.**

**Rulings made while planning (spec deviations, to be written into the spec in Task 6):**
- Page param `laporan` instead of `jenis` (name clash with the rusak-hilang `jenis` filter).
- The mutation queue card links to `/asset-mutations` without a status filter (that index has none); other cards link with filters that exist.

## Review Focus

- **Dashboard figures, per-unit table and activity feed must never include a unit outside the user's scope**, even with a crafted `unit_id` (other kelurahan, another kecamatan). → Tasks 1, 2.
- **Report rows are limited to scope**; a mutation touching the user's unit on only one side is included, one touching none is not; a crafted `unit_id` gets 422. → Tasks 4, 5.
- **Leading zeros and numeric-looking codes survive** in the xlsx (`0007`, `1.3.2.05.02.04.004`), and a name starting with `=` stays text. → Task 5.
- **Zero rows**: no empty file is served (422) and the page shows the count 0 with a disabled button. → Tasks 5, 6.
- **The count on the page equals the data rows in the downloaded file** for the same filters. → Task 5.

## File Structure

| File | Responsibility |
|---|---|
| `app/Services/DashboardService.php` (new) | all dashboard numbers from the user's scope |
| `app/Http/Controllers/DashboardController.php` (new), `routes/web.php` | `GET /dashboard` |
| `resources/js/Pages/Dashboard.tsx`, `types/index.d.ts` | dashboard UI + `DashboardData` type |
| `app/Services/ReportQuery.php` (new) | scope + filters per report kind |
| `app/Http/Requests/ReportRequest.php` (new) | filter validation, scope check for `unit_id` |
| `app/Services/ReportExporter.php` (new) | PhpSpreadsheet writing + streamed download |
| `app/Http/Controllers/ReportController.php` (new), `routes/web.php` | `report.index`, `report.download` |
| `resources/js/Pages/Report/Index.tsx`, `config/navigation.ts`, `Components/NavIcon.tsx` | report page, menu item, `bar-chart` icon |

---

## Task 1: `DashboardService`

**Files:**
- Create: `app/Services/DashboardService.php`
- Test: `tests/Feature/DashboardServiceTest.php`

**Interfaces:**
- Consumes: `User::accessibleUnitIds(): ?array`, `ApprovalWorkflowService::pendingFor(User): Collection`, `AssetRequestService::canFulfill(User, AssetRequest): bool`.
- Produces: `DashboardService::for(User $user, ?int $unitId = null): array` with keys `totals` (`jumlah_aset` int, `nilai_perolehan` float, `nilai_buku` float), `per_kondisi` (`baik|rusak_ringan|rusak_berat|hilang` => int), `per_kategori` (list of `{id, nama, jumlah, nilai_buku}` by top-level category, count desc then name), `per_unit` (list of `{id, name, jumlah, kondisi{4}, nilai_buku}` or `null` when scope is a single unit), `antrean` (`persetujuan_menunggu`, `permohonan_menunggu_pemenuhan`, `laporan_pending`, `mutasi_pending`: ints), `aktivitas` (list of `{id, aset, event, pelaku, waktu}`), `units` (list of `{id, name}` or `[]`), `selected_unit_id` (int|null).

- [ ] **Step 1: Write the failing test**

`tests/Feature/DashboardServiceTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetHistory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\DashboardService;

function dashAsset(object $t, $unit, $category, string $kondisi, float $buku): Asset
{
    return Asset::factory()->create([
        'unit_id' => $unit->id,
        'category_id' => $category->id,
        'kondisi' => $kondisi,
        'nilai_buku' => $buku,
        'nilai_perolehan' => $buku * 2,
    ]);
}

function dashHistory(Asset $asset, string $event, int $minutesAgo): AssetHistory
{
    return AssetHistory::create([
        'asset_id' => $asset->id,
        'event' => $event,
        'unit_id' => $asset->unit_id,
        'kondisi' => 'baik',
        'created_at' => now()->subMinutes($minutesAgo),
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

    $this->mejaKec = dashAsset($this, $this->kec, $this->meja, 'baik', 1000);
    $this->kursiA = dashAsset($this, $this->kelA, $this->kursi, 'baik', 2000);
    $this->laptopA = dashAsset($this, $this->kelA, $this->laptop, 'rusak_berat', 3000);
    $this->laptopB = dashAsset($this, $this->kelB, $this->laptop, 'hilang', 500);
    $this->mejaOther = dashAsset($this, $this->otherKec, $this->meja, 'baik', 9000);

    $this->service = app(DashboardService::class);
});

it('gives the kasubag the whole picture', function () {
    $data = $this->service->for(userWithRole('kasubag'));

    expect($data['totals'])->toBe(['jumlah_aset' => 5, 'nilai_perolehan' => 31000.0, 'nilai_buku' => 15500.0])
        ->and($data['per_kondisi'])->toBe(['baik' => 3, 'rusak_ringan' => 0, 'rusak_berat' => 1, 'hilang' => 1])
        ->and($data['per_unit'])->toHaveCount(4)
        ->and($data['units'])->toHaveCount(4)
        ->and($data['per_kategori'][0])->toBe(['id' => $this->alat->id, 'nama' => 'ALAT KANTOR', 'jumlah' => 3, 'nilai_buku' => 12000.0])
        ->and($data['per_kategori'][1])->toBe(['id' => $this->elektronik->id, 'nama' => 'ELEKTRONIK', 'jumlah' => 2, 'nilai_buku' => 3500.0]);
});

it('limits the camat to the kecamatan and its kelurahan', function () {
    $data = $this->service->for(userWithRole('camat', $this->kec));

    expect($data['totals']['jumlah_aset'])->toBe(4)
        ->and($data['totals']['nilai_buku'])->toBe(6500.0)
        ->and($data['per_unit'])->toHaveCount(3)
        ->and(collect($data['per_unit'])->pluck('id')->all())->not->toContain($this->otherKec->id);
});

it('narrows cards but not the per-unit table with a unit filter, and ignores units out of scope', function () {
    $camat = userWithRole('camat', $this->kec);

    $filtered = $this->service->for($camat, $this->kelA->id);
    expect($filtered['totals']['jumlah_aset'])->toBe(2)
        ->and($filtered['totals']['nilai_buku'])->toBe(5000.0)
        ->and($filtered['per_unit'])->toHaveCount(3)
        ->and($filtered['selected_unit_id'])->toBe($this->kelA->id);

    $foreign = $this->service->for($camat, $this->otherKec->id);
    expect($foreign['totals']['jumlah_aset'])->toBe(4)
        ->and($foreign['selected_unit_id'])->toBeNull();
});

it('shows a single-unit user only their unit, with no per-unit table or unit list, and ignores a crafted unit', function () {
    foreach ([userWithRole('admin_kelurahan', $this->kelA), userWithRole('lurah', $this->kelA)] as $user) {
        $data = $this->service->for($user, $this->kelB->id);

        expect($data['totals']['jumlah_aset'])->toBe(2)
            ->and($data['totals']['nilai_buku'])->toBe(5000.0)
            ->and($data['per_unit'])->toBeNull()
            ->and($data['units'])->toBe([])
            ->and($data['selected_unit_id'])->toBeNull();
    }

    $adminKec = $this->service->for(userWithRole('admin_kecamatan', $this->kec));
    expect($adminKec['totals']['jumlah_aset'])->toBe(1)
        ->and($adminKec['per_unit'])->toBeNull();
});

it('lists the newest activity within scope only', function () {
    dashHistory($this->kursiA, 'dibuat', 3);
    dashHistory($this->kursiA, 'mutasi', 2);
    dashHistory($this->laptopA, 'laporan_rusak', 1);
    dashHistory($this->laptopB, 'dibuat', 5);
    dashHistory($this->mejaOther, 'dibuat', 4);

    $adminA = $this->service->for(userWithRole('admin_kelurahan', $this->kelA));
    expect(collect($adminA['aktivitas'])->pluck('event')->all())->toBe(['laporan_rusak', 'mutasi', 'dibuat'])
        ->and($adminA['aktivitas'][0]['aset'])->toBe($this->laptopA->nama_aset);

    expect($this->service->for(userWithRole('camat', $this->kec))['aktivitas'])->toHaveCount(4)
        ->and($this->service->for(userWithRole('kasubag'))['aktivitas'])->toHaveCount(5);
});

it('caps the activity feed at ten entries', function () {
    foreach (range(1, 12) as $i) {
        dashHistory($this->kursiA, 'mutasi', $i);
    }

    expect($this->service->for(userWithRole('admin_kelurahan', $this->kelA))['aktivitas'])->toHaveCount(10);
});

it('counts the work queue within scope', function () {
    AssetReport::factory()->create(['asset_id' => $this->kursiA->id, 'unit_id' => $this->kelA->id, 'status' => 'pending']);
    AssetReport::factory()->create(['asset_id' => $this->laptopB->id, 'unit_id' => $this->kelB->id, 'status' => 'pending']);
    AssetReport::factory()->create(['asset_id' => $this->laptopA->id, 'unit_id' => $this->kelA->id, 'status' => 'approved']);

    $creator = userWithRole('admin_kecamatan', $this->kec);
    foreach ([[$this->kec, $this->kelA, 'M1'], [$this->kec, $this->kelB, 'M2']] as [$origin, $dest, $no]) {
        AssetMutation::create([
            'nomor_mutasi' => $no, 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $origin->id,
            'destination_unit_id' => $dest->id, 'tanggal_mutasi' => '2026-10-01', 'status' => 'pending', 'created_by' => $creator->id,
        ]);
    }

    AssetRequest::factory()->create([
        'status' => 'approved', 'unit_id' => $this->kelA->id,
        'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kelA->id])->id,
    ]);

    $adminA = $this->service->for(userWithRole('admin_kelurahan', $this->kelA))['antrean'];
    expect($adminA['laporan_pending'])->toBe(1)
        ->and($adminA['mutasi_pending'])->toBe(1)
        ->and($adminA['permohonan_menunggu_pemenuhan'])->toBe(1)
        ->and($adminA['persetujuan_menunggu'])->toBeInt();

    $adminB = $this->service->for(userWithRole('admin_kelurahan', $this->kelB))['antrean'];
    expect($adminB['laporan_pending'])->toBe(1)
        ->and($adminB['mutasi_pending'])->toBe(1)
        ->and($adminB['permohonan_menunggu_pemenuhan'])->toBe(0);

    $camat = $this->service->for(userWithRole('camat', $this->kec))['antrean'];
    expect($camat['laporan_pending'])->toBe(2)
        ->and($camat['mutasi_pending'])->toBe(2)
        ->and($camat['permohonan_menunggu_pemenuhan'])->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DashboardServiceTest.php`
Expected: FAIL (`Target class [App\Services\DashboardService] does not exist`).

- [ ] **Step 3: Implement**

`app/Services/DashboardService.php`:

```php
<?php

namespace App\Services;

use App\Enums\AssetReportStatus;
use App\Enums\AssetRequestStatus;
use App\Enums\Kondisi;
use App\Enums\MutationStatus;
use App\Models\AssetHistory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\AssetRequest;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function __construct(
        private readonly ApprovalWorkflowService $workflow,
        private readonly AssetRequestService $requests,
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user, ?int $unitId = null): array
    {
        $accessible = $user->accessibleUnitIds();
        $scope = Unit::query()
            ->when($accessible !== null, fn ($q) => $q->whereIn('id', $accessible))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        $scopeIds = $scope->pluck('id')->map(fn ($id) => (int) $id)->all();
        $multi = count($scopeIds) > 1;
        $selected = $multi && $unitId !== null && in_array($unitId, $scopeIds, true) ? $unitId : null;
        $ids = $selected !== null ? [$selected] : $scopeIds;

        return [
            ...$this->recap($scope, $scopeIds, $ids, $multi),
            'per_kategori' => $this->perKategori($ids),
            'antrean' => $this->antrean($user, $scopeIds),
            'aktivitas' => $this->aktivitas($scopeIds),
            'units' => $multi ? $scope->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name])->all() : [],
            'selected_unit_id' => $selected,
        ];
    }

    /**
     * @param  list<int>  $scopeIds
     * @param  list<int>  $ids
     * @return array<string, mixed>
     */
    private function recap($scope, array $scopeIds, array $ids, bool $multi): array
    {
        $zero = array_fill_keys(array_map(fn (Kondisi $k) => $k->value, Kondisi::cases()), 0);
        $totals = ['jumlah_aset' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0];
        $perKondisi = $zero;
        $perUnit = [];

        foreach ($scope as $unit) {
            $perUnit[(int) $unit->id] = ['id' => (int) $unit->id, 'name' => $unit->name, 'jumlah' => 0, 'kondisi' => $zero, 'nilai_buku' => 0.0];
        }

        $rows = DB::table('assets')
            ->whereIn('unit_id', $scopeIds)
            ->selectRaw('unit_id, kondisi, COUNT(*) as jumlah, COALESCE(SUM(nilai_perolehan), 0) as nilai_perolehan, COALESCE(SUM(nilai_buku), 0) as nilai_buku')
            ->groupBy('unit_id', 'kondisi')
            ->get();

        foreach ($rows as $row) {
            $unit = (int) $row->unit_id;
            $perUnit[$unit]['jumlah'] += (int) $row->jumlah;
            $perUnit[$unit]['kondisi'][$row->kondisi] += (int) $row->jumlah;
            $perUnit[$unit]['nilai_buku'] += (float) $row->nilai_buku;

            if (in_array($unit, $ids, true)) {
                $totals['jumlah_aset'] += (int) $row->jumlah;
                $totals['nilai_perolehan'] += (float) $row->nilai_perolehan;
                $totals['nilai_buku'] += (float) $row->nilai_buku;
                $perKondisi[$row->kondisi] += (int) $row->jumlah;
            }
        }

        return [
            'totals' => $totals,
            'per_kondisi' => $perKondisi,
            'per_unit' => $multi ? array_values($perUnit) : null,
        ];
    }

    /**
     * @param  list<int>  $ids
     * @return list<array{id: int, nama: string, jumlah: int, nilai_buku: float}>
     */
    private function perKategori(array $ids): array
    {
        return DB::table('assets')
            ->join('asset_categories as c', 'c.id', '=', 'assets.category_id')
            ->leftJoin('asset_categories as p', 'p.id', '=', 'c.parent_id')
            ->whereIn('assets.unit_id', $ids)
            ->selectRaw('COALESCE(p.id, c.id) as kategori_id, COALESCE(p.name, c.name) as kategori, COUNT(*) as jumlah, COALESCE(SUM(assets.nilai_buku), 0) as nilai_buku')
            ->groupByRaw('COALESCE(p.id, c.id), COALESCE(p.name, c.name)')
            ->orderByDesc('jumlah')
            ->orderBy('kategori')
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->kategori_id,
                'nama' => $r->kategori,
                'jumlah' => (int) $r->jumlah,
                'nilai_buku' => (float) $r->nilai_buku,
            ])
            ->all();
    }

    /**
     * @param  list<int>  $scopeIds
     * @return array<string, int>
     */
    private function antrean(User $user, array $scopeIds): array
    {
        return [
            'persetujuan_menunggu' => $this->workflow->pendingFor($user)->count(),
            'permohonan_menunggu_pemenuhan' => AssetRequest::with('unit')
                ->where('status', AssetRequestStatus::Approved)
                ->whereNull('mutation_id')
                ->get()
                ->filter(fn (AssetRequest $r) => $this->requests->canFulfill($user, $r))
                ->count(),
            'laporan_pending' => AssetReport::where('status', AssetReportStatus::Pending)
                ->whereIn('unit_id', $scopeIds)
                ->count(),
            'mutasi_pending' => AssetMutation::where('status', MutationStatus::Pending)
                ->where(fn (Builder $q) => $q->whereIn('origin_unit_id', $scopeIds)->orWhereIn('destination_unit_id', $scopeIds))
                ->count(),
        ];
    }

    /**
     * @param  list<int>  $scopeIds
     * @return list<array<string, mixed>>
     */
    private function aktivitas(array $scopeIds): array
    {
        return AssetHistory::with(['asset:id,nama_aset', 'user:id,name'])
            ->whereIn('unit_id', $scopeIds)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (AssetHistory $h) => [
                'id' => $h->id,
                'aset' => $h->asset?->nama_aset,
                'event' => $h->event,
                'pelaku' => $h->user?->name,
                'waktu' => $h->created_at?->toIso8601String(),
            ])
            ->all();
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/DashboardServiceTest.php`
Expected: PASS (7 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/Services/DashboardService.php tests/Feature/DashboardServiceTest.php
git commit -m "feat: add DashboardService with scoped recap, queue and activity"
```

---

## Task 2: Dashboard controller and route

**Files:**
- Create: `app/Http/Controllers/DashboardController.php`
- Modify: `routes/web.php` (replace the `/dashboard` closure)
- Test: `tests/Feature/DashboardControllerTest.php`

**Interfaces:**
- Consumes: `DashboardService::for` (Task 1).
- Produces: route `dashboard` → Inertia component `Dashboard` with prop `dashboard` (the array from Task 1); query `?unit_id=`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/DashboardControllerTest.php`:

```php
<?php

use App\Models\Asset;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    Asset::factory()->create(['unit_id' => $this->kelA->id]);
    Asset::factory()->count(2)->create(['unit_id' => $this->kelB->id]);
});

it('sends a guest to login', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

it('renders the dashboard for every role with scope-limited figures', function (string $role, ?string $unit, int $expected) {
    $user = userWithRole($role, $unit === null ? null : $this->{$unit});

    $this->actingAs($user)->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Dashboard')
            ->where('dashboard.totals.jumlah_aset', $expected)
            ->has('dashboard.per_kondisi')
            ->has('dashboard.antrean')
            ->has('dashboard.aktivitas'));
})->with([
    'kasubag' => ['kasubag', null, 3],
    'camat' => ['camat', 'kec', 3],
    'admin_kecamatan' => ['admin_kecamatan', 'kec', 0],
    'admin_kelurahan' => ['admin_kelurahan', 'kelA', 1],
    'lurah' => ['lurah', 'kelB', 2],
]);

it('passes the unit filter through and ignores a unit out of scope', function () {
    $camat = userWithRole('camat', $this->kec);

    $this->actingAs($camat)->get('/dashboard?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('dashboard.totals.jumlah_aset', 2)->where('dashboard.selected_unit_id', $this->kelB->id));

    $adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->actingAs($adminA)->get('/dashboard?unit_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('dashboard.totals.jumlah_aset', 1)->where('dashboard.selected_unit_id', null));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DashboardControllerTest.php`
Expected: FAIL (the closure renders `Dashboard` without a `dashboard` prop).

- [ ] **Step 3: Implement**

`app/Http/Controllers/DashboardController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardService $service): Response
    {
        return Inertia::render('Dashboard', [
            'dashboard' => $service->for($request->user(), $request->integer('unit_id') ?: null),
        ]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\DashboardController;` (alphabetical among the controller imports) and replace

```php
Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');
```

with

```php
Route::get('/dashboard', DashboardController::class)->middleware(['auth', 'verified'])->name('dashboard');
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/DashboardControllerTest.php`
Expected: PASS (7 tests: 1 guest + 5 role cases + 1 filter).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/DashboardController.php routes/web.php tests/Feature/DashboardControllerTest.php
git commit -m "feat: serve the scoped dashboard from DashboardController"
```

---

## Task 3: Dashboard page

**Files:**
- Modify: `resources/js/types/index.d.ts`
- Replace: `resources/js/Pages/Dashboard.tsx`

**Interfaces:**
- Consumes: page prop `dashboard` (Task 1/2 shape), `KONDISI_LABEL` from `@/lib/assetReport`, routes `dashboard`, `persetujuan.index`.
- Produces: type `DashboardData` in `@/types`.

- [ ] **Step 1: Types**

Append to `resources/js/types/index.d.ts`:

```ts

export interface DashboardData {
    totals: { jumlah_aset: number; nilai_perolehan: number; nilai_buku: number };
    per_kondisi: Record<'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang', number>;
    per_kategori: { id: number; nama: string; jumlah: number; nilai_buku: number }[];
    per_unit: { id: number; name: string; jumlah: number; kondisi: Record<string, number>; nilai_buku: number }[] | null;
    antrean: {
        persetujuan_menunggu: number;
        permohonan_menunggu_pemenuhan: number;
        laporan_pending: number;
        mutasi_pending: number;
    };
    aktivitas: { id: number; aset: string | null; event: string; pelaku: string | null; waktu: string | null }[];
    units: { id: number; name: string }[];
    selected_unit_id: number | null;
}
```

- [ ] **Step 2: Page**

`resources/js/Pages/Dashboard.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const KONDISI_BAR: Record<string, string> = {
    baik: 'bg-emerald-500',
    rusak_ringan: 'bg-amber-500',
    rusak_berat: 'bg-red-500',
    hilang: 'bg-slate-500',
};

const EVENT_LABEL: Record<string, string> = {
    dibuat: 'Aset dicatat',
    diterima: 'Aset diterima',
    mutasi: 'Mutasi aset',
    laporan_rusak: 'Laporan rusak',
    laporan_hilang: 'Laporan hilang',
    serah_terima: 'Serah terima ke pegawai',
};

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
    );
}

function Bar({ label, value, max, text, color = 'bg-blue-600' }: { label: string; value: number; max: number; text: string; color?: string }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-800">{label}</span>
                <span className="shrink-0 text-xs text-slate-500">{text}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
            </div>
        </div>
    );
}

export default function Dashboard({ dashboard: d, auth }: DashboardProps) {
    const kondisiMax = Math.max(1, ...Object.values(d.per_kondisi));
    const kategoriMax = Math.max(1, ...d.per_kategori.map((k) => k.jumlah));

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const queue: { label: string; value: number; href: string }[] = [
        { label: 'Persetujuan menunggu saya', value: d.antrean.persetujuan_menunggu, href: route('persetujuan.index') },
        { label: 'Permohonan menunggu pemenuhan', value: d.antrean.permohonan_menunggu_pemenuhan, href: '/asset-requests?menunggu_pemenuhan=1' },
        { label: 'Laporan rusak/hilang pending', value: d.antrean.laporan_pending, href: '/asset-reports?status=pending' },
        { label: 'Mutasi pending', value: d.antrean.mutasi_pending, href: '/asset-mutations' },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Selamat datang, {auth.user?.name}. Anda login sebagai <strong>{auth.user?.roles?.[0]}</strong> di {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}.
                        </p>
                    </div>
                    {d.units.length > 0 && (
                        <select value={d.selected_unit_id ?? ''} onChange={(e) => filterUnit(e.target.value)} className={SELECT} aria-label="Filter unit">
                            <option value="">Semua unit</option>
                            {d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Stat label="Total Aset" value={d.totals.jumlah_aset.toLocaleString('id-ID')} />
                    <Stat label="Nilai Perolehan" value={rupiah(d.totals.nilai_perolehan)} />
                    <Stat label="Nilai Buku" value={rupiah(d.totals.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {queue.map((q) => (
                        <Link key={q.label} href={q.href} className={`${CARD} block hover:border-blue-300`}>
                            <p className="text-3xl font-bold text-slate-900">{q.value}</p>
                            <p className="mt-1 text-sm text-slate-600">{q.label}</p>
                        </Link>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-base font-semibold text-slate-900">Aset per Kondisi</p>
                        <div className="space-y-3">
                            {Object.entries(d.per_kondisi).map(([k, n]) => (
                                <Bar key={k} label={KONDISI_LABEL[k] ?? k} value={n} max={kondisiMax} text={`${n} aset`} color={KONDISI_BAR[k]} />
                            ))}
                        </div>
                    </div>

                    <div className={CARD}>
                        <p className="mb-4 text-base font-semibold text-slate-900">Aset per Kategori</p>
                        {d.per_kategori.length === 0 ? (
                            <p className="text-sm text-slate-400">Belum ada aset.</p>
                        ) : (
                            <div className="space-y-3">
                                {d.per_kategori.map((k) => (
                                    <Bar key={k.id} label={k.nama} value={k.jumlah} max={kategoriMax} text={`${k.jumlah} aset · ${rupiah(k.nilai_buku)}`} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {d.per_unit && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <p className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Rekap per Unit</p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-3">Unit</th>
                                        <th className="px-4 py-3 text-right">Aset</th>
                                        {Object.keys(d.per_kondisi).map((k) => <th key={k} className="px-4 py-3 text-right">{KONDISI_LABEL[k] ?? k}</th>)}
                                        <th className="px-4 py-3 text-right">Nilai Buku</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {d.per_unit.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3 font-medium">{u.name}</td>
                                            <td className="px-4 py-3 text-right">{u.jumlah}</td>
                                            {Object.keys(d.per_kondisi).map((k) => <td key={k} className="px-4 py-3 text-right">{u.kondisi[k] ?? 0}</td>)}
                                            <td className="px-4 py-3 text-right">{rupiah(u.nilai_buku)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className={CARD}>
                    <p className="mb-4 text-base font-semibold text-slate-900">Aktivitas Terbaru</p>
                    {d.aktivitas.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada aktivitas.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {d.aktivitas.map((a) => (
                                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                                    <span>
                                        <span className="font-semibold text-slate-900">{a.aset ?? 'Aset'}</span>
                                        <span className="text-slate-600"> — {EVENT_LABEL[a.event] ?? a.event}</span>
                                        {a.pelaku && <span className="text-slate-500"> oleh {a.pelaku}</span>}
                                    </span>
                                    {a.waktu && (
                                        <span className="text-xs text-slate-500">
                                            {new Date(a.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
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

- [ ] **Step 4: Manual verification (browser)**

With dev DB migrated/seeded: as `kasubag` the dashboard shows the three totals, the four queue cards (links open the right pages), the kondisi/kategori bars, the "Rekap per Unit" table, the unit filter (choosing a kelurahan changes the cards/bars but not the table), and the activity list. As an `admin_kelurahan`: no unit filter and no per-unit table, only own-unit figures. Phone width: single column, table scrolls horizontally inside its card.

- [ ] **Step 5: Commit**

```bash
git add resources/js/types/index.d.ts resources/js/Pages/Dashboard.tsx
git commit -m "feat: build the dashboard page with recap, queue and activity"
```

---

## Task 4: Report scope/filters (`ReportQuery`) and request validation

**Files:**
- Modify: `composer.json` / `composer.lock` (`composer require phpoffice/phpspreadsheet`)
- Create: `app/Services/ReportQuery.php`, `app/Http/Requests/ReportRequest.php`
- Test: `tests/Feature/ReportQueryTest.php`

**Interfaces:**
- Produces: `ReportQuery::KINDS = ['aset', 'mutasi', 'rusak-hilang']`; `new ReportQuery(User $user)`; `->build(string $kind, array $filters): Illuminate\Database\Eloquent\Builder` (models `Asset`, `AssetMutation`, `AssetReport`; recognised filter keys: aset `unit_id, category_id, kondisi`; mutasi `unit_id, status, dari, sampai`; rusak-hilang `unit_id, jenis, status, dari, sampai`; other keys ignored). `ReportRequest` (rules for all keys + `laporan`; 422 on an out-of-scope `unit_id`, exercised over HTTP in Task 5; `filters(): array` = validated non-empty filter keys without `laporan`).

- [ ] **Step 1: Install the dependency**

Run: `composer require phpoffice/phpspreadsheet`
Expected: package added (PHP extensions `zip`, `gd`, `xml` are present).

- [ ] **Step 2: Write the failing test**

`tests/Feature/ReportQueryTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Services\ReportQuery;

function rqMutation(string $no, $origin, $dest, string $date, string $status, $creator): AssetMutation
{
    return AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $origin->id === $dest->id ? 'internal' : 'kec_ke_kel',
        'origin_unit_id' => $origin->id, 'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $creator->id,
    ]);
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
    $this->elektronik = AssetCategory::create(['name' => 'ELEKTRONIK']);
    $this->laptop = AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $this->elektronik->id]);

    $this->aKec = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik']);
    $this->aA1 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kondisi' => 'baik']);
    $this->aA2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->laptop->id, 'kondisi' => 'rusak_berat']);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->laptop->id, 'kondisi' => 'baik']);

    $this->m1 = rqMutation('M1', $this->kec, $this->kelA, '2026-10-01', 'pending', $this->camat);
    $this->m2 = rqMutation('M2', $this->kec, $this->kelB, '2026-10-05', 'approved', $this->camat);
    $this->m3 = rqMutation('M3', $this->kelB, $this->kelB, '2026-10-10', 'pending', $this->camat);

    $this->r1 = AssetReport::factory()->create(['asset_id' => $this->aA1->id, 'unit_id' => $this->kelA->id, 'jenis' => 'rusak', 'tanggal_kejadian' => '2026-10-02', 'status' => 'pending']);
    $this->r2 = AssetReport::factory()->create(['asset_id' => $this->aB->id, 'unit_id' => $this->kelB->id, 'jenis' => 'hilang', 'kondisi_baru' => 'hilang', 'tanggal_kejadian' => '2026-10-06', 'status' => 'approved']);
    $this->r3 = AssetReport::factory()->create(['asset_id' => $this->aKec->id, 'unit_id' => $this->kec->id, 'jenis' => 'rusak', 'tanggal_kejadian' => '2026-10-09', 'status' => 'pending']);
});

function rq(object $t, $user, string $kind, array $filters = []): array
{
    return (new ReportQuery($user))->build($kind, $filters)->pluck('id')->sort()->values()->all();
}

it('limits the asset list to scope and filters by unit, parent category and kondisi', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->kasubag, 'aset'))->toBe($ids($this->aKec, $this->aA1, $this->aA2, $this->aB))
        ->and(rq($this, $this->camat, 'aset'))->toBe($ids($this->aKec, $this->aA1, $this->aA2, $this->aB))
        ->and(rq($this, $this->adminA, 'aset'))->toBe($ids($this->aA1, $this->aA2))
        ->and(rq($this, $this->camat, 'aset', ['unit_id' => $this->kelB->id]))->toBe($ids($this->aB))
        ->and(rq($this, $this->camat, 'aset', ['category_id' => $this->alat->id]))->toBe($ids($this->aKec, $this->aA1))
        ->and(rq($this, $this->camat, 'aset', ['category_id' => $this->laptop->id]))->toBe($ids($this->aA2, $this->aB))
        ->and(rq($this, $this->camat, 'aset', ['kondisi' => 'rusak_berat']))->toBe($ids($this->aA2));
});

it('includes a mutation when either side is in scope and filters by unit, status and inclusive dates', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->camat, 'mutasi'))->toBe($ids($this->m1, $this->m2, $this->m3))
        ->and(rq($this, $this->adminA, 'mutasi'))->toBe($ids($this->m1))
        ->and(rq($this, $this->camat, 'mutasi', ['unit_id' => $this->kelB->id]))->toBe($ids($this->m2, $this->m3))
        ->and(rq($this, $this->camat, 'mutasi', ['status' => 'approved']))->toBe($ids($this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['dari' => '2026-10-05', 'sampai' => '2026-10-05']))->toBe($ids($this->m2))
        ->and(rq($this, $this->camat, 'mutasi', ['dari' => '2026-10-02']))->toBe($ids($this->m2, $this->m3));
});

it('limits damaged/lost reports to scope and filters by jenis, status and inclusive dates', function () {
    $ids = fn (...$a) => collect($a)->pluck('id')->sort()->values()->all();

    expect(rq($this, $this->camat, 'rusak-hilang'))->toBe($ids($this->r1, $this->r2, $this->r3))
        ->and(rq($this, $this->adminA, 'rusak-hilang'))->toBe($ids($this->r1))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['jenis' => 'hilang']))->toBe($ids($this->r2))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['status' => 'pending']))->toBe($ids($this->r1, $this->r3))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['unit_id' => $this->kec->id]))->toBe($ids($this->r3))
        ->and(rq($this, $this->camat, 'rusak-hilang', ['dari' => '2026-10-06', 'sampai' => '2026-10-09']))->toBe($ids($this->r2, $this->r3));
});

it('ignores filters that do not belong to the report kind', function () {
    expect(rq($this, $this->camat, 'mutasi', ['kondisi' => 'hilang', 'category_id' => 1]))->toHaveCount(3);
});

it('shows nothing to a user without a unit or role', function () {
    $nobody = App\Models\User::factory()->create();

    expect(rq($this, $nobody, 'aset'))->toBe([])
        ->and(rq($this, $nobody, 'mutasi'))->toBe([])
        ->and(rq($this, $nobody, 'rusak-hilang'))->toBe([]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test tests/Feature/ReportQueryTest.php`
Expected: FAIL (`Class "App\Services\ReportQuery" not found`).

- [ ] **Step 4: Implement**

`app/Services/ReportQuery.php`:

```php
<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The only place that applies unit scope and filters to the three reports.
 * Used by the page (row count) and by the exporter (rows), so both always agree.
 */
class ReportQuery
{
    public const KINDS = ['aset', 'mutasi', 'rusak-hilang'];

    public function __construct(private readonly User $user) {}

    /** @param  array<string, mixed>  $f */
    public function build(string $kind, array $f): Builder
    {
        return match ($kind) {
            'aset' => $this->aset($f),
            'mutasi' => $this->mutasi($f),
            'rusak-hilang' => $this->rusakHilang($f),
        };
    }

    /** @param  array<string, mixed>  $f */
    private function aset(array $f): Builder
    {
        return Asset::query()
            ->visibleTo($this->user)
            ->with(['category.parent', 'unit', 'currentHolder'])
            ->when($f['unit_id'] ?? null, fn (Builder $q, $id) => $q->where('unit_id', $id))
            ->when($f['category_id'] ?? null, fn (Builder $q, $id) => $q->whereIn('category_id', AssetCategory::query()
                ->where('id', $id)
                ->orWhere('parent_id', $id)
                ->pluck('id')))
            ->when($f['kondisi'] ?? null, fn (Builder $q, $kondisi) => $q->where('kondisi', $kondisi))
            ->orderBy('unit_id')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register');
    }

    /** @param  array<string, mixed>  $f */
    private function mutasi(array $f): Builder
    {
        $ids = $this->user->accessibleUnitIds();

        return AssetMutation::query()
            ->with(['originUnit', 'destinationUnit', 'creator', 'items.asset'])
            ->when($ids !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereIn('origin_unit_id', $ids)
                ->orWhereIn('destination_unit_id', $ids)))
            ->when($f['unit_id'] ?? null, fn (Builder $q, $id) => $q->where(fn (Builder $w) => $w
                ->where('origin_unit_id', $id)
                ->orWhere('destination_unit_id', $id)))
            ->when($f['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
            ->when($f['dari'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_mutasi', '>=', $date))
            ->when($f['sampai'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_mutasi', '<=', $date))
            ->orderByDesc('tanggal_mutasi')
            ->orderByDesc('id');
    }

    /** @param  array<string, mixed>  $f */
    private function rusakHilang(array $f): Builder
    {
        $ids = $this->user->accessibleUnitIds();

        return AssetReport::query()
            ->with(['asset', 'unit', 'pegawai', 'creator'])
            ->when($ids !== null, fn (Builder $q) => $q->whereIn('unit_id', $ids))
            ->when($f['unit_id'] ?? null, fn (Builder $q, $id) => $q->where('unit_id', $id))
            ->when($f['jenis'] ?? null, fn (Builder $q, $jenis) => $q->where('jenis', $jenis))
            ->when($f['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
            ->when($f['dari'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_kejadian', '>=', $date))
            ->when($f['sampai'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_kejadian', '<=', $date))
            ->orderByDesc('tanggal_kejadian')
            ->orderByDesc('id');
    }
}
```

`app/Http/Requests/ReportRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Unit;
use App\Services\ReportQuery;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReportRequest extends FormRequest
{
    private const FILTER_KEYS = ['unit_id', 'category_id', 'kondisi', 'dari', 'sampai', 'status', 'jenis'];

    public function authorize(): bool
    {
        return $this->user()->getRoleNames()->isNotEmpty();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'laporan' => ['nullable', Rule::in(ReportQuery::KINDS)],
            'unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'kondisi' => ['nullable', Rule::enum(Kondisi::class)],
            'dari' => ['nullable', 'date'],
            'sampai' => ['nullable', 'date', 'after_or_equal:dari'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'jenis' => ['nullable', Rule::enum(AssetReportType::class)],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator) {
            $unitId = $this->input('unit_id');

            if ($unitId === null || $unitId === '' || $validator->errors()->has('unit_id')) {
                return;
            }

            $unit = Unit::find($unitId);

            if ($unit === null || ! $this->user()->canAccessUnit($unit)) {
                $validator->errors()->add('unit_id', 'Unit di luar cakupan Anda.');
            }
        }];
    }

    /** @return array<string, mixed> */
    public function filters(): array
    {
        return array_filter(
            $this->safe()->only(self::FILTER_KEYS),
            fn ($value) => $value !== null && $value !== '',
        );
    }
}
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/ReportQueryTest.php`
Expected: PASS (5 tests). If `AssetMutation` has no `creator()` relation, the mutasi eager-load fails: add the relation `public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }` to `app/Models/AssetMutation.php` and ledger it as a ruling.

Run: `php artisan test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add composer.json composer.lock app/Services/ReportQuery.php app/Http/Requests/ReportRequest.php tests/Feature/ReportQueryTest.php
git commit -m "feat: add ReportQuery scope/filters and ReportRequest validation"
```

---

## Task 5: Excel exporter, controller and routes

**Files:**
- Create: `app/Services/ReportExporter.php`, `app/Http/Controllers/ReportController.php`
- Create (stub, replaced in Task 6): `resources/js/Pages/Report/Index.tsx`
- Modify: `routes/web.php`
- Test: `tests/Feature/ReportDownloadTest.php`

**Interfaces:**
- Consumes: `ReportQuery`, `ReportRequest` (Task 4).
- Produces: routes `report.index` (`GET /laporan`) → Inertia `Report/Index` with props `laporan` (string), `filters` (array), `rowCount` (int), `units` (`[{id,name,type}]`, empty when scope is a single unit), `categories` (`[{id,name}]` top-level), `kondisiOptions`; `report.download` (`GET /laporan/{laporan}/unduh`, `laporan` = `aset|mutasi|rusak-hilang`, same filter query) → xlsx stream, 422 when zero rows, 404 for an unknown kind. `ReportExporter::download(string $kind, Builder $query, array $filters, User $user): StreamedResponse`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/ReportDownloadTest.php`:

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

    $this->a1 = Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nomor_register' => 7,
        'nama_aset' => '=SUM(1+1)', 'kode_barang' => '1.3.2.05.02.04.004', 'nilai_perolehan' => 2000, 'nilai_buku' => 1500,
    ]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Kursi', 'nilai_perolehan' => 1000, 'nilai_buku' => 500]);
    $this->aB = Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja B', 'nilai_perolehan' => 3000, 'nilai_buku' => 2500]);
});

it('downloads the asset list as an xlsx limited to scope, with text kept as text', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan/aset/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-aset-'.now()->format('Y-m-d').'.xlsx');

    $rows = xlsxRows($response);
    expect($rows[0][0])->toBe('Laporan Daftar Aset')
        ->and($rows[1][0])->toBe('Cakupan: Kelurahan A')
        ->and($rows[2][0])->toBe('Filter: Tanpa filter')
        ->and($rows[3][0])->toStartWith('Dicetak: ')
        ->and($rows[5])->toContain('Kode Barang', 'No. Register', 'Nama Aset', 'Nilai Buku');

    $data = array_slice($rows, 6);
    expect($data)->toHaveCount(2);

    $heading = array_flip($rows[5]);
    $byName = collect($data)->keyBy(fn ($r) => $r[$heading['Nama Aset']]);
    expect($byName->has('=SUM(1+1)'))->toBeTrue()
        ->and($byName['=SUM(1+1)'][$heading['No. Register']])->toBe('0007')
        ->and($byName['=SUM(1+1)'][$heading['Kode Barang']])->toBe('1.3.2.05.02.04.004')
        ->and((float) $byName['=SUM(1+1)'][$heading['Nilai Buku']])->toBe(1500.0)
        ->and($byName['=SUM(1+1)'][$heading['Unit']])->toBe('Kelurahan A')
        ->and($byName->has('Meja B'))->toBeFalse();
});

it('labels the whole scope for kasubag and applies filters', function () {
    $rows = xlsxRows($this->actingAs($this->kasubag)->get('/laporan/aset/unduh?unit_id='.$this->kelB->id));

    expect($rows[1][0])->toBe('Cakupan: Kelurahan B')
        ->and(array_slice($rows, 6))->toHaveCount(1);

    $all = xlsxRows($this->actingAs($this->kasubag)->get('/laporan/aset/unduh'));
    expect($all[1][0])->toBe('Cakupan: Seluruh unit')
        ->and(array_slice($all, 6))->toHaveCount(3);
});

it('downloads the mutation history with its asset list and the damaged/lost report', function () {
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'MUT/2026/0001', 'jenis_mutasi' => 'kec_ke_kel', 'origin_unit_id' => $this->kec->id,
        'destination_unit_id' => $this->kelA->id, 'tanggal_mutasi' => '2026-10-03', 'status' => 'pending',
        'created_by' => $this->camat->id, 'keterangan' => 'Pengisian stok',
    ]);
    AssetMutationItem::create(['asset_mutation_id' => $mutation->id, 'asset_id' => $this->a2->id]);
    AssetReport::factory()->create(['asset_id' => $this->a2->id, 'unit_id' => $this->kelA->id, 'nomor_laporan' => 'LP/2026/0001', 'kronologi' => 'Patah kaki']);

    $mut = xlsxRows($this->actingAs($this->adminA)->get('/laporan/mutasi/unduh'));
    $heading = array_flip($mut[5]);
    expect($mut[0][0])->toBe('Laporan Riwayat Mutasi')
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

it('refuses a unit out of scope, an unknown report and an empty result', function () {
    $this->actingAs($this->adminA)->getJson('/laporan/aset/unduh?unit_id='.$this->kelB->id)->assertUnprocessable();
    $this->actingAs($this->adminA)->get('/laporan/lain/unduh')->assertNotFound();
    $this->actingAs($this->adminA)->getJson('/laporan/mutasi/unduh')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan/aset/unduh?kondisi=hilang')->assertUnprocessable();
});

it('validates report filters and refuses a unit out of scope', function () {
    $this->actingAs($this->adminA)->getJson('/laporan?unit_id='.$this->kelB->id)->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $this->actingAs($this->camat)->getJson('/laporan?unit_id='.$this->kelB->id)->assertOk();
    $this->actingAs($this->camat)->getJson('/laporan?kondisi=bukan')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan?laporan=lain')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan')->assertRedirect('/login');
    $this->get('/laporan/aset/unduh')->assertRedirect('/login');
});

it('shows the row count on the page and it equals the rows in the file', function () {
    $this->actingAs($this->camat)->get('/laporan?laporan=aset&category_id='.$this->alat->id)
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Report/Index')
            ->where('laporan', 'aset')
            ->where('rowCount', 3)
            ->has('units', 3)
            ->has('categories', 1)
            ->has('kondisiOptions', 4));

    $file = xlsxRows($this->actingAs($this->camat)->get('/laporan/aset/unduh?category_id='.$this->alat->id));
    expect(array_slice($file, 6))->toHaveCount(3);

    $this->actingAs($this->adminA)->get('/laporan')
        ->assertInertia(fn (Assert $p) => $p->where('rowCount', 2)->where('units', []));

    $this->actingAs($this->adminA)->get('/laporan?laporan=mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('laporan', 'mutasi')->where('rowCount', 0));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ReportDownloadTest.php`
Expected: FAIL (404 on `/laporan/aset/unduh`: routes do not exist yet).

- [ ] **Step 3: Implement**

`app/Services/ReportExporter.php`:

```php
<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExporter
{
    private const HEADER_ROW = 6;

    private const TITLES = [
        'aset' => 'Laporan Daftar Aset',
        'mutasi' => 'Laporan Riwayat Mutasi',
        'rusak-hilang' => 'Laporan Aset Rusak dan Hilang',
    ];

    /**
     * @param  array<string, mixed>  $filters
     */
    public function download(string $kind, Builder $query, array $filters, User $user): StreamedResponse
    {
        $spreadsheet = $this->build($kind, $query, $filters, $user);

        return response()->streamDownload(
            fn () => (new Xlsx($spreadsheet))->save('php://output'),
            "laporan-{$kind}-".now()->format('Y-m-d').'.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    /**
     * ponytail: built in memory by PhpSpreadsheet; fine to tens of thousands of rows,
     * beyond that switch to a streaming writer (chunked query + OpenSpout).
     *
     * @param  array<string, mixed>  $filters
     */
    private function build(string $kind, Builder $query, array $filters, User $user): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Laporan');

        $sheet->setCellValueExplicit('A1', self::TITLES[$kind], DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A2', 'Cakupan: '.$this->scopeLabel($user, $filters), DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A3', 'Filter: '.$this->filterLabel($filters), DataType::TYPE_STRING);
        $sheet->setCellValueExplicit('A4', 'Dicetak: '.now()->format('d/m/Y H:i'), DataType::TYPE_STRING);
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        $columns = $this->columns($kind);
        $headerRow = self::HEADER_ROW;

        foreach ($columns as $i => $column) {
            $sheet->setCellValueExplicit(Coordinate::stringFromColumnIndex($i + 1).$headerRow, $column[0], DataType::TYPE_STRING);
        }

        $row = $headerRow;
        foreach ($query->get() as $index => $model) {
            $row++;
            foreach ($columns as $i => $column) {
                $coordinate = Coordinate::stringFromColumnIndex($i + 1).$row;
                $value = $column[1]($model, $index);
                $type = $column[2] ?? 'text';

                if ($type === 'date' && $value !== null) {
                    $sheet->setCellValue($coordinate, Date::PHPToExcel($value));
                } elseif (in_array($type, ['money', 'number'], true) && $value !== null) {
                    $sheet->setCellValue($coordinate, $value);
                } else {
                    $sheet->setCellValueExplicit($coordinate, (string) ($value ?? ''), DataType::TYPE_STRING);
                }
            }
        }

        $this->style($sheet, $columns, $headerRow, $row);

        return $spreadsheet;
    }

    /** @param  list<array<int, mixed>>  $columns */
    private function style($sheet, array $columns, int $headerRow, int $lastRow): void
    {
        $lastColumn = Coordinate::stringFromColumnIndex(count($columns));

        $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
        ]);
        $sheet->freezePane('A'.($headerRow + 1));

        foreach ($columns as $i => $column) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);
            $type = $column[2] ?? 'text';

            if ($type === 'wrap') {
                $sheet->getColumnDimension($letter)->setWidth(45);
                if ($lastRow > $headerRow) {
                    $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$lastRow}")->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
                }
            } else {
                $sheet->getColumnDimension($letter)->setAutoSize(true);
            }

            if ($lastRow > $headerRow && in_array($type, ['money', 'date'], true)) {
                $sheet->getStyle("{$letter}".($headerRow + 1).":{$letter}{$lastRow}")
                    ->getNumberFormat()
                    ->setFormatCode($type === 'money' ? '#,##0' : 'dd/mm/yyyy');
            }
        }
    }

    /** @return list<array{0: string, 1: callable, 2?: string}> */
    private function columns(string $kind): array
    {
        return match ($kind) {
            'aset' => [
                ['No', fn (Asset $a, int $i) => $i + 1, 'number'],
                ['Kode Barang', fn (Asset $a) => $a->kode_barang],
                ['No. Register', fn (Asset $a) => $a->registerLabel()],
                ['Nama Aset', fn (Asset $a) => $a->nama_aset],
                ['Kategori', fn (Asset $a) => $a->category?->parent?->name ?? $a->category?->name],
                ['Subkategori', fn (Asset $a) => $a->category?->parent_id !== null ? $a->category->name : null],
                ['Merk/Tipe', fn (Asset $a) => $a->merk_type],
                ['Unit', fn (Asset $a) => $a->unit?->name],
                ['Pemegang', fn (Asset $a) => $a->currentHolder?->nama],
                ['Kondisi', fn (Asset $a) => $a->kondisi->label()],
                ['Status', fn (Asset $a) => $a->status->label()],
                ['Tanggal Perolehan', fn (Asset $a) => $a->tanggal_perolehan, 'date'],
                ['Sumber Perolehan', fn (Asset $a) => $a->sumber_perolehan],
                ['Nilai Perolehan', fn (Asset $a) => (float) $a->nilai_perolehan, 'money'],
                ['Nilai Buku', fn (Asset $a) => (float) $a->nilai_buku, 'money'],
                ['No. Dokumen', fn (Asset $a) => $a->no_dokumen],
                ['Keterangan', fn (Asset $a) => $a->keterangan, 'wrap'],
            ],
            'mutasi' => [
                ['No', fn (AssetMutation $m, int $i) => $i + 1, 'number'],
                ['Nomor Mutasi', fn (AssetMutation $m) => $m->nomor_mutasi],
                ['Jenis', fn (AssetMutation $m) => $m->jenis_mutasi->label()],
                ['Unit Asal', fn (AssetMutation $m) => $m->originUnit?->name],
                ['Unit Tujuan', fn (AssetMutation $m) => $m->destinationUnit?->name],
                ['Tanggal', fn (AssetMutation $m) => $m->tanggal_mutasi, 'date'],
                ['Status', fn (AssetMutation $m) => $m->status->label()],
                ['Jumlah Aset', fn (AssetMutation $m) => $m->items->count(), 'number'],
                ['Daftar Aset', fn (AssetMutation $m) => $m->items->map(fn ($item) => ($item->asset?->kode_barang ?? '-').' - '.($item->asset?->nama_aset ?? '-'))->implode("\n"), 'wrap'],
                ['Diajukan Oleh', fn (AssetMutation $m) => $m->creator?->name],
                ['Keterangan', fn (AssetMutation $m) => $m->keterangan, 'wrap'],
            ],
            'rusak-hilang' => [
                ['No', fn (AssetReport $r, int $i) => $i + 1, 'number'],
                ['Nomor Laporan', fn (AssetReport $r) => $r->nomor_laporan],
                ['Aset', fn (AssetReport $r) => $r->asset?->nama_aset],
                ['Kode Barang', fn (AssetReport $r) => $r->asset?->kode_barang],
                ['Unit', fn (AssetReport $r) => $r->unit?->name],
                ['Jenis', fn (AssetReport $r) => $r->jenis->label()],
                ['Kondisi Baru', fn (AssetReport $r) => $r->kondisi_baru->label()],
                ['Tanggal Kejadian', fn (AssetReport $r) => $r->tanggal_kejadian, 'date'],
                ['Status', fn (AssetReport $r) => $r->status->label()],
                ['Pelapor', fn (AssetReport $r) => $r->creator?->name],
                ['Pemegang', fn (AssetReport $r) => $r->pegawai?->nama],
                ['Kronologi', fn (AssetReport $r) => $r->kronologi, 'wrap'],
            ],
        };
    }

    /** @param  array<string, mixed>  $filters */
    private function scopeLabel(User $user, array $filters): string
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
    private function filterLabel(array $filters): string
    {
        $parts = [];

        if (! empty($filters['category_id'])) {
            $parts[] = 'Kategori: '.(AssetCategory::find($filters['category_id'])?->name ?? $filters['category_id']);
        }

        foreach (['kondisi' => 'Kondisi', 'status' => 'Status', 'jenis' => 'Jenis', 'dari' => 'Dari', 'sampai' => 'Sampai'] as $key => $label) {
            if (! empty($filters[$key])) {
                $parts[] = "{$label}: {$filters[$key]}";
            }
        }

        return $parts === [] ? 'Tanpa filter' : implode('; ', $parts);
    }
}
```

`app/Http/Controllers/ReportController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\Kondisi;
use App\Http\Requests\ReportRequest;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Services\ReportExporter;
use App\Services\ReportQuery;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(ReportRequest $request): Response
    {
        $user = $request->user();
        $kind = $request->input('laporan') ?: 'aset';
        $filters = $request->filters();
        $ids = $user->accessibleUnitIds();

        $units = Unit::query()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        return Inertia::render('Report/Index', [
            'laporan' => $kind,
            'filters' => $filters,
            'rowCount' => (new ReportQuery($user))->build($kind, $filters)->count(),
            'units' => $units->count() > 1 ? $units : [],
            'categories' => AssetCategory::whereNull('parent_id')->orderBy('name')->get(['id', 'name']),
            'kondisiOptions' => Kondisi::options(),
        ]);
    }

    public function download(ReportRequest $request, string $laporan, ReportExporter $exporter): StreamedResponse
    {
        $filters = $request->filters();
        $query = (new ReportQuery($request->user()))->build($laporan, $filters);

        abort_if($query->count() === 0, 422, 'Tidak ada data untuk diunduh.');

        return $exporter->download($laporan, $query, $filters, $request->user());
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\ReportController;` (alphabetical among the controller imports) and, inside the `auth` group after the `scan` routes:

```php
    Route::get('/laporan', [ReportController::class, 'index'])->name('report.index');
    Route::get('/laporan/{laporan}/unduh', [ReportController::class, 'download'])
        ->where('laporan', 'aset|mutasi|rusak-hilang')
        ->name('report.download');
```

Stub page so Inertia component checks pass (Task 6 replaces it):

```bash
mkdir -p resources/js/Pages/Report
printf "export default function Index() {\n    return null;\n}\n" > resources/js/Pages/Report/Index.tsx
```

- [ ] **Step 4: Run tests**

Run: `php artisan test tests/Feature/ReportDownloadTest.php`
Expected: PASS (7 tests).

Run: `php artisan test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/Services/ReportExporter.php app/Http/Controllers/ReportController.php routes/web.php resources/js/Pages/Report/Index.tsx tests/Feature/ReportDownloadTest.php
git commit -m "feat: add Excel report exporter, controller and routes"
```

---

## Task 6: Report page, menu, docs

**Files:**
- Replace stub: `resources/js/Pages/Report/Index.tsx`
- Modify: `resources/js/config/navigation.ts`, `resources/js/Components/NavIcon.tsx`
- Modify: `docs/superpowers/specs/2026-10-04-dashboard-laporan-design.md`, `docs/DETAIL_RBAC_SISTEM.md`

**Interfaces:**
- Consumes: page props from Task 5, routes `report.index`, `report.download`.

- [ ] **Step 1: Icon and menu**

In `resources/js/Components/NavIcon.tsx` add before `case 'qr-code':`:

```tsx
        case 'bar-chart':
            return (
                <svg
                    className={className}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                </svg>
            );

```

In `resources/js/config/navigation.ts` replace

```ts
        items: [{ label: 'Dashboard', href: '/dashboard', icon: 'grid' }],
```

with

```ts
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: 'grid' },
            { label: 'Laporan', href: '/laporan', icon: 'bar-chart' },
        ],
```

- [ ] **Step 2: Report page**

`resources/js/Pages/Report/Index.tsx`:

```tsx
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type Kind = 'aset' | 'mutasi' | 'rusak-hilang';
type Filters = Record<string, string | number | undefined>;

interface ReportProps extends PageProps {
    laporan: Kind;
    filters: Filters;
    rowCount: number;
    units: { id: number; name: string; type: string }[];
    categories: { id: number; name: string }[];
    kondisiOptions: { value: string; label: string }[];
}

const KINDS: { key: Kind; label: string }[] = [
    { key: 'aset', label: 'Daftar Aset' },
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

export default function Index({ laporan, filters, rowCount, units, categories, kondisiOptions }: ReportProps) {
    const [form, setForm] = useState<Filters>(filters);

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const apply = (kind: Kind, data: Filters) =>
        router.get(route('report.index'), clean({ ...data, laporan: kind }), { preserveScroll: true, replace: true });

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

                <div className="flex flex-wrap gap-2" role="tablist">
                    {KINDS.map((k) => (
                        <button
                            key={k.key}
                            type="button"
                            role="tab"
                            aria-selected={laporan === k.key}
                            onClick={() => switchKind(k.key)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${laporan === k.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            {k.label}
                        </button>
                    ))}
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply(laporan, form);
                    }}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {laporan === 'aset' && (
                            <>
                                {unitSelect}
                                {select('category_id', 'Kategori', categories.map((c) => ({ value: c.id, label: c.name })), 'Semua kategori')}
                                {select('kondisi', 'Kondisi', kondisiOptions, 'Semua kondisi')}
                            </>
                        )}
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
                            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{rowCount}</span> baris akan diunduh</p>
                            {rowCount > 0 ? (
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

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Docs**

In `docs/superpowers/specs/2026-10-04-dashboard-laporan-design.md`:
- change `Status: Menunggu review.` to `Status: Diimplementasikan (plan 2026-10-04-dashboard-laporan.md).`
- in §4.1 replace the sentence about the page parameter `jenis` (`aset`|`mutasi`|`rusak-hilang`) with: page parameter `laporan` (not `jenis`, which is a filter of the rusak-hilang report), and in the `report.download` route use `{laporan}`.
- in §3.2 change the mutation queue link from `/asset-mutations?status=pending` to `/asset-mutations` (that index has no status filter).

In `docs/DETAIL_RBAC_SISTEM.md` change the `**Laporan & Rekapitulasi Excel**` row's last cell from `⏳ *Next Roadmap*` to `✅ Selesai (`ReportQuery`, `/laporan`)` and the `**Dashboard Eksekutif**` row's last cell to `✅ Selesai (`DashboardService`, `Dashboard.tsx`)`.

- [ ] **Step 5: Manual verification (browser)**

With dev DB migrated/seeded: the sidebar shows "Laporan" for every role. As `kasubag`: Daftar Aset with a unit/category/kondisi filter shows the row count; Unduh Excel opens in Excel with title/cakupan/filter/dicetak rows, bold frozen header, `No. Register` like `0007`, numbers right-aligned with thousand separators and dates as `dd/mm/yyyy`. Mutasi and Rusak & Hilang tabs the same. A filter combination with no rows disables the download. As `admin_kelurahan`: no unit filter and only own-unit rows. Phone width: filters stack in one column.

- [ ] **Step 6: Commit**

```bash
git add resources/js/Pages/Report/Index.tsx resources/js/config/navigation.ts resources/js/Components/NavIcon.tsx docs/superpowers/specs/2026-10-04-dashboard-laporan-design.md docs/DETAIL_RBAC_SISTEM.md
git commit -m "feat: add Laporan page and menu, document dashboard and reports"
```
