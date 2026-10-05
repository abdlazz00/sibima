# Pengembalian Aset ke Inventaris Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pegawai dapat mengembalikan aset yang dipegangnya ke inventaris unit lewat jenis baru "Pengembalian ke Inventaris" di Mutasi Aset, dengan alur persetujuan Atasan Unit sendiri.

**Architecture:** Jenis baru `MutationType::Pengembalian` memakai ulang tabel, penguncian aset, mesin persetujuan, riwayat, notifikasi, halaman, dan Laporan Mutasi milik Mutasi Aset. Alur persetujuan `pengembalian_aset` (satu langkah `atasan_unit`) didaftarkan terpisah dari mutasi internal. Efek persetujuan (yang sudah mengosongkan pemegang dari `target_holder_id` kosong) hanya diberi event riwayat `pengembalian`.

**Tech Stack:** Laravel 13, Pest (SQLite `:memory:`, queue `sync`), Inertia + React/TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-05-pengembalian-aset-design.md`

## Global Constraints

- Jenis baru bernilai `'pengembalian'`, label "Pengembalian ke Inventaris"; kolom `asset_mutations.jenis_mutasi` sudah `string(30)`, tidak ada migrasi.
- Alur persetujuan: kode `pengembalian_aset`, nama "Pengembalian Aset ke Inventaris", satu langkah `atasanUnit('Persetujuan Atasan Unit')`, efek `AssetMutationEffect`, kapabilitas `subject`. Tidak memakai `mutasi_internal_kec`/`mutasi_internal_kel`.
- Izin memakai `mutasi.create`/`mutasi.view`; tidak ada permission baru.
- Unit asal = unit tujuan; `target_holder_id` item selalu kosong; setiap aset harus sedang dipegang pegawai; kondisi aset tidak diubah.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude** (aturan tetap pengguna), jangan push.
- Jangan menguji lewat browser kecuali pengguna memerintahkan; frontend diverifikasi dengan `npx tsc --noEmit` dan `npm run build`.
- Nama fungsi helper Pest harus unik antar berkas; helper baru berawalan `pg`.
- Edit berkas PHP bernamespace dengan alat Edit (backslash ganda hilang di skrip Python via heredoc/Write); skrip TSX tanpa backslash boleh lewat Python dari berkas.
- `php artisan test` penuh lebih dari 2 menit: jalankan di latar belakang atau pakai `--filter`.

## Review Focus

Input/kondisi yang tersirat di spec tetapi tidak disebut tegas, urut dari yang paling mungkin terjadi pada pengguna:

1. **Aset yang sudah di inventaris (pemegang kosong) dipilih untuk dikembalikan:** ditolak dengan pesan jelas. Diuji di Task 2.
2. **Dua pengembalian untuk aset yang sama** (yang pertama masih menunggu): ditolak karena aset sudah `dalam_proses`. Diuji di Task 2.
3. **Definisi alur `pengembalian_aset` belum di-seed di suatu lingkungan:** pesan jelas, bukan 404. Diuji di Task 1.
4. **Pengembalian ditolak atau dibatalkan:** aset kembali aktif dan pemegangnya tidak berubah. Diuji di Task 2.
5. **Camat menyetujui pengembalian unit kelurahan atau Lurah menyetujui unit kecamatan, dan pembuat menyetujui miliknya sendiri:** ditolak. Diuji di Task 2.
6. **Aset berkondisi hilang yang masih tercatat dipegang pegawai:** ditolak. Diuji di Task 2.

---

## File Structure

| Berkas | Perubahan |
|---|---|
| `app/Support/WorkflowDefaults.php` | Tambah definisi `pengembalian_aset`. |
| `config/workflow.php` | Daftarkan efek dan kapabilitas `pengembalian_aset`. |
| `app/Models/AssetMutation.php` | Tambah relasi `unit()` (unit asal). |
| `app/Services/ApprovalWorkflowService.php` | `submit` memberi pesan jelas bila definisi alur hilang. |
| `app/Enums/MutationType.php` | Tambah case `Pengembalian`. |
| `app/Services/AssetMutationService.php` | Aturan pengembalian + `resolveWorkflowCode`. |
| `app/Services/AssetMutationEffect.php` | Event riwayat `pengembalian` dan keterangan pemegang lama. |
| `app/Http/Requests/StoreAssetMutationRequest.php` | `keterangan` wajib dan `target_holder_id` dilarang untuk pengembalian. |
| `resources/js/types/index.d.ts`, `lib/chartColors.ts`, `Pages/AssetMutations/{Create,Index,Show}.tsx` | Jenis, label, warna, form, dan tampilan baru. |
| `tests/Feature/PengembalianWorkflowTest.php`, `PengembalianAsetTest.php` | Pengujian baru. |
| `tests/Feature/WorkflowSettingsTest.php` | Jumlah alur 9 menjadi 10. |

---

### Task 1: Alur persetujuan `pengembalian_aset` dan pengerasan definisi hilang

**Files:**
- Create: `tests/Feature/PengembalianWorkflowTest.php`
- Modify: `app/Support/WorkflowDefaults.php`, `config/workflow.php`, `app/Models/AssetMutation.php`, `app/Services/ApprovalWorkflowService.php:25-30`, `tests/Feature/WorkflowSettingsTest.php:41`

**Interfaces:**
- Produces: alur dengan kode `pengembalian_aset` (seeder membuatnya); `AssetMutation::unit(): BelongsTo` (unit asal); `ApprovalWorkflowService::submit` melempar `InvalidArgumentException` berpesan "Alur persetujuan '{kode}' belum dikonfigurasi. Jalankan WorkflowDefinitionSeeder." bila definisi tidak ada.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/PengembalianWorkflowTest.php`:

```php
<?php

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\AssetMutation;
use App\Models\User;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationEffect;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
});

function pgMutation(object $t): AssetMutation
{
    return AssetMutation::create([
        'nomor_mutasi' => 'PGW/'.uniqid(), 'jenis_mutasi' => 'internal',
        'origin_unit_id' => $t->kec->id, 'destination_unit_id' => $t->kec->id,
        'tanggal_mutasi' => '2026-10-05', 'status' => 'pending', 'created_by' => $t->adminKec->id,
    ]);
}

it('seeds the pengembalian_aset workflow with one atasan unit step', function () {
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();
    $step = $definition->steps->sole();

    expect($definition->name)->toBe('Pengembalian Aset ke Inventaris')
        ->and($step->label)->toBe('Persetujuan Atasan Unit')
        ->and($step->approver_type)->toBe(ApproverType::AtasanUnit)
        ->and($step->unit_scope)->toBe(UnitScope::Subject)
        ->and(config('workflow.effects.pengembalian_aset'))->toBe(AssetMutationEffect::class)
        ->and(config('workflow.capabilities.pengembalian_aset'))->toBe('subject');
});

it('lists the workflow in settings and lets its atasan unit step be saved', function () {
    $definition = WorkflowDefinition::where('code', 'pengembalian_aset')->firstOrFail();

    $this->actingAs($this->kasubag)->get(route('workflow-settings.index'))
        ->assertInertia(fn ($page) => $page->has('workflows', 10));

    $this->actingAs($this->kasubag)->put(route('workflow-settings.update', $definition), [
        'steps' => [[
            'label' => 'Persetujuan Atasan Unit', 'approver_type' => 'atasan_unit',
            'approver_role' => null, 'approver_user_id' => null, 'unit_scope' => 'subject',
        ]],
    ])->assertRedirect()->assertSessionHasNoErrors();
});

it('exposes the origin unit of a mutation as its unit for atasan unit approval', function () {
    expect(pgMutation($this)->unit->id)->toBe($this->kec->id);
});

it('raises a clear error when a workflow definition is missing instead of a 404', function () {
    WorkflowDefinition::where('code', 'pengembalian_aset')->delete();

    expect(fn () => app(ApprovalWorkflowService::class)->submit(pgMutation($this), 'pengembalian_aset', $this->adminKec))
        ->toThrow(InvalidArgumentException::class, "Alur persetujuan 'pengembalian_aset' belum dikonfigurasi");
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=PengembalianWorkflowTest`
Expected: FAIL (4 test: definisi tidak ada, daftar masih 9, relasi `unit` tidak ada, `ModelNotFoundException`).

- [ ] **Step 3: Implementasi**

`app/Support/WorkflowDefaults.php`: di dalam array `all()`, tepat setelah entri `'retur_kel_ke_kec' => [...]`, tambahkan:

```php
            'pengembalian_aset' => [
                'name' => 'Pengembalian Aset ke Inventaris',
                'steps' => [self::atasanUnit('Persetujuan Atasan Unit')],
            ],
```

`config/workflow.php`: pada `'effects'` tambahkan `'pengembalian_aset' => AssetMutationEffect::class,` setelah baris `'retur_kel_ke_kec'`; pada `'capabilities'` tambahkan `'pengembalian_aset' => 'subject',` setelah baris `'retur_kel_ke_kec'`.

`app/Models/AssetMutation.php`: tepat setelah method `destinationUnit()` tambahkan:

```php
    /** Unit pengaju bagi langkah "Atasan Unit": unit asal (pada pengembalian, asal = tujuan). */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'origin_unit_id');
    }
```

`app/Services/ApprovalWorkflowService.php`: ganti baris `$definition = WorkflowDefinition::where('code', $workflowCode)->firstOrFail();` dengan:

```php
        $definition = WorkflowDefinition::where('code', $workflowCode)->first()
            ?? throw new InvalidArgumentException("Alur persetujuan '{$workflowCode}' belum dikonfigurasi. Jalankan WorkflowDefinitionSeeder.");
```

`tests/Feature/WorkflowSettingsTest.php:41`: ubah `->has('workflows', 9)` menjadi `->has('workflows', 10)`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="PengembalianWorkflowTest|WorkflowSettingsTest|WorkflowDefaultsTest|WorkflowEngine|ApprovalWorkflowServiceTest"`
Expected: PASS (`WorkflowDefaultsTest` ikut membuktikan setiap alur default punya kapabilitas).

- [ ] **Step 5: Commit**

```bash
git add app/Support/WorkflowDefaults.php config/workflow.php app/Models/AssetMutation.php app/Services/ApprovalWorkflowService.php tests/Feature/PengembalianWorkflowTest.php tests/Feature/WorkflowSettingsTest.php
git commit -m "feat(workflow): add pengembalian_aset approval flow and a clear error for missing definitions"
```

---

### Task 2: Jenis pengembalian di Mutasi Aset (aturan, efek, validasi, laporan)

**Files:**
- Create: `tests/Feature/PengembalianAsetTest.php`
- Modify: `app/Enums/MutationType.php`, `app/Services/AssetMutationService.php`, `app/Services/AssetMutationEffect.php`, `app/Http/Requests/StoreAssetMutationRequest.php`

**Interfaces:**
- Consumes: alur `pengembalian_aset` dan `AssetMutation::unit()` (Task 1).
- Produces: `MutationType::Pengembalian` (`'pengembalian'`); `AssetMutationService::submit(array $data, array $items, User $creator)` menerima jenis ini dengan `origin_unit_id == destination_unit_id`, item `['asset_id' => int, 'target_holder_id' => null, 'catatan' => ?string]`; event riwayat `pengembalian`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/PengembalianAsetTest.php`:

```php
<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Enums\MutationStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetMutationService;
use App\Services\AssetRequestService;
use App\Services\MutationRecapService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->kasubag = userWithRole('kasubag');
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->service = app(AssetMutationService::class);
    $this->engine = app(ApprovalWorkflowService::class);
    $this->pak = Pegawai::factory()->create(['unit_id' => $this->kec->id, 'nama' => 'Pak Camat']);
});

function pgHeld(object $t, $unit = null, $holder = null, array $o = []): Asset
{
    $unit ??= $t->kec;
    $holder ??= $unit->id === $t->kec->id ? $t->pak : Pegawai::factory()->create(['unit_id' => $unit->id]);

    return Asset::factory()->create($o + ['unit_id' => $unit->id, 'category_id' => $t->category->id, 'current_holder_id' => $holder->id, 'nama_aset' => 'Laptop']);
}

function pgData($unit, array $o = []): array
{
    return $o + [
        'nomor_mutasi' => 'PG/'.uniqid(), 'jenis_mutasi' => 'pengembalian', 'origin_unit_id' => $unit->id,
        'destination_unit_id' => $unit->id, 'tanggal_mutasi' => '2026-10-05', 'keterangan' => 'Tidak terpakai',
    ];
}

function pgItems(array $assets, array $o = []): array
{
    return array_map(fn ($a) => $o + ['asset_id' => $a->id, 'target_holder_id' => null, 'catatan' => null], $assets);
}

it('locks the held asset and routes the return to the pengembalian_aset workflow', function () {
    $asset = pgHeld($this);

    $mutation = $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec);

    expect($mutation->status)->toBe(MutationStatus::Pending)
        ->and($asset->fresh()->status)->toBe(AssetStatus::DalamProses)
        ->and($mutation->approvalRequest->definition->code)->toBe('pengembalian_aset');
});

it('rejects an asset that is already in the inventory', function () {
    $asset = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->category->id, 'current_holder_id' => null]);

    expect(fn () => $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec))
        ->toThrow(InvalidArgumentException::class, 'sudah berada di inventaris');
});

it('rejects a lost asset, a new holder, and a different destination unit', function () {
    $lost = pgHeld($this, null, null, ['kondisi' => Kondisi::Hilang]);
    $ok = pgHeld($this);

    expect(fn () => $this->service->submit(pgData($this->kec), pgItems([$lost]), $this->adminKec))
        ->toThrow(InvalidArgumentException::class, 'berkondisi hilang');
    expect(fn () => $this->service->submit(pgData($this->kec), pgItems([$ok], ['target_holder_id' => $this->pak->id]), $this->adminKec))
        ->toThrow(InvalidArgumentException::class, 'tidak boleh menentukan pemegang baru');
    expect(fn () => $this->service->submit(pgData($this->kec, ['destination_unit_id' => $this->kel->id]), pgItems([$ok]), $this->adminKec))
        ->toThrow(InvalidArgumentException::class, 'harus berada di unit yang sama');
});

it('refuses a second return of an asset that is already waiting for approval', function () {
    $asset = pgHeld($this);
    $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec);

    expect(fn () => $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec))
        ->toThrow(InvalidArgumentException::class, 'dalam proses');
});

it('empties the holder, reactivates the asset and records who returned it when the camat approves', function () {
    $asset = pgHeld($this);
    $mutation = $this->service->submit(pgData($this->kec, ['nomor_mutasi' => 'PG/001']), pgItems([$asset]), $this->adminKec);

    expect($this->engine->canAct($this->adminKec, $mutation->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->lurah, $mutation->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->camat, $mutation->approvalRequest))->toBeTrue();

    $this->engine->approve($mutation->approvalRequest, $this->camat);

    $asset->refresh();
    $history = $asset->histories()->where('event', 'pengembalian')->sole();

    expect($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->current_holder_id)->toBeNull()
        ->and($asset->status)->toBe(AssetStatus::Aktif)
        ->and($asset->unit_id)->toBe($this->kec->id)
        ->and($history->current_holder_id)->toBeNull()
        ->and($history->keterangan)->toContain('Pak Camat')->toContain('PG/001');
});

it('lets only the lurah approve a kelurahan return', function () {
    $asset = pgHeld($this, $this->kel);
    $mutation = $this->service->submit(pgData($this->kel), pgItems([$asset]), $this->adminKel);

    expect($this->engine->canAct($this->camat, $mutation->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->kasubag, $mutation->approvalRequest))->toBeFalse()
        ->and($this->engine->canAct($this->lurah, $mutation->approvalRequest))->toBeTrue();

    $this->engine->approve($mutation->approvalRequest, $this->lurah);

    expect($asset->fresh()->current_holder_id)->toBeNull();
});

it('keeps the holder and reactivates the asset when the return is rejected', function () {
    $asset = pgHeld($this);
    $mutation = $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec);

    $this->engine->reject($mutation->approvalRequest, $this->camat, 'Masih dipakai');

    expect($mutation->fresh()->status)->toBe(MutationStatus::Rejected)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif)
        ->and($asset->fresh()->current_holder_id)->toBe($this->pak->id);
});

it('makes the returned asset available to a pegawai request and can hand it to another pegawai', function () {
    $asset = pgHeld($this);
    $mutation = $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec);
    $this->engine->approve($mutation->approvalRequest, $this->camat);

    $informasi = Pegawai::factory()->create(['unit_id' => $this->kec->id, 'nama' => 'Staf Informasi']);
    $requests = app(AssetRequestService::class);
    $request = $requests->create(['jenis' => 'pegawai', 'pegawai_id' => $informasi->id, 'category_id' => $this->category->id, 'keterangan' => 'Butuh laptop'], $this->adminKec);
    $this->engine->approve($request->approvalRequest, $this->camat);
    $request = $request->fresh();

    expect($requests->eligibleAssets($request)->pluck('id')->all())->toContain($asset->id);

    $requests->fulfillPegawai($request, $asset->id, $this->adminKec);

    expect($asset->fresh()->current_holder_id)->toBe($informasi->id);
});

it('accepts a return through the form and validates its alasan and holder', function () {
    $asset = pgHeld($this);
    $payload = pgData($this->kec, ['nomor_mutasi' => 'PG/HTTP']) + ['items' => pgItems([$asset])];

    $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), array_merge($payload, ['keterangan' => '']))
        ->assertSessionHasErrors('keterangan');

    $withHolder = array_merge($payload, ['items' => pgItems([$asset], ['target_holder_id' => $this->pak->id])]);
    $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), $withHolder)
        ->assertSessionHasErrors('items.0.target_holder_id');

    $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), $payload)
        ->assertRedirect(route('asset-mutations.index'));

    expect(AssetMutation::where('nomor_mutasi', 'PG/HTTP')->sole()->jenis_mutasi->value)->toBe('pengembalian');
});

it('includes the new type in the Laporan Mutasi filter and recap', function () {
    $asset = pgHeld($this);
    $mutation = $this->service->submit(pgData($this->kec), pgItems([$asset]), $this->adminKec);
    $this->engine->approve($mutation->approvalRequest, $this->camat);

    $this->actingAs($this->kasubag)->get('/laporan-mutasi')
        ->assertInertia(fn ($page) => $page->where('jenisOptions', fn ($o) => collect($o)->contains(
            fn ($j) => $j['value'] === 'pengembalian' && $j['label'] === 'Pengembalian ke Inventaris',
        )));

    $recap = app(MutationRecapService::class)->for($this->kasubag, []);
    $row = collect($recap['jenis'])->firstWhere('jenis', 'pengembalian');

    expect($row['jumlah'])->toBe(1);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=PengembalianAsetTest`
Expected: FAIL (`'pengembalian'` bukan nilai `MutationType` yang valid).

- [ ] **Step 3: Implementasi**

`app/Enums/MutationType.php`: tambahkan case dan label:

```php
    case Pengembalian = 'pengembalian';
```
(setelah `case Internal = 'internal';`) dan di `match` label:

```php
            self::Pengembalian => 'Pengembalian ke Inventaris',
```

`app/Services/AssetMutationService.php` (gunakan alat Edit):
1. Ganti blok

```php
        if ($type === MutationType::Internal && $originUnit->id !== $destUnit->id) {
            throw new InvalidArgumentException('Mutasi internal harus berada di unit yang sama.');
        }

        if ($type !== MutationType::Internal && $originUnit->id === $destUnit->id) {
            throw new InvalidArgumentException('Mutasi antar unit harus memiliki unit asal dan tujuan yang berbeda.');
        }
```

dengan:

```php
        $sameUnit = in_array($type, [MutationType::Internal, MutationType::Pengembalian], true);

        if ($sameUnit && $originUnit->id !== $destUnit->id) {
            throw new InvalidArgumentException($type === MutationType::Pengembalian
                ? 'Pengembalian ke inventaris harus berada di unit yang sama.'
                : 'Mutasi internal harus berada di unit yang sama.');
        }

        if (! $sameUnit && $originUnit->id === $destUnit->id) {
            throw new InvalidArgumentException('Mutasi antar unit harus memiliki unit asal dan tujuan yang berbeda.');
        }
```

2. Pada loop `foreach ($assets as $asset)`, setelah pemeriksaan `if ($asset->status !== AssetStatus::Aktif) {...}` tambahkan:

```php
                if ($type === MutationType::Pengembalian && $asset->current_holder_id === null) {
                    throw new InvalidArgumentException("Aset \"{$asset->nama_aset}\" sudah berada di inventaris unit, tidak ada yang perlu dikembalikan.");
                }
```

3. Pada loop `foreach ($items as $item)` (pemeriksaan Internal), tambahkan di dalamnya:

```php
                if ($type === MutationType::Pengembalian && ! empty($item['target_holder_id'])) {
                    throw new InvalidArgumentException('Pengembalian ke inventaris tidak boleh menentukan pemegang baru.');
                }
```

4. Di `resolveWorkflowCode` tambahkan baris `MutationType::Pengembalian => 'pengembalian_aset',` dan di `assertUnitKindsMatch` tambahkan `MutationType::Pengembalian => true,`.

`app/Services/AssetMutationEffect.php` (alat Edit): ganti blok `foreach` kedua yang ada, yaitu

```php
                $asset = $assets->get($item->asset_id);

                $asset->update([
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'status' => AssetStatus::Aktif,
                ]);

                AssetHistory::create([
                    'asset_id' => $asset->id,
                    'event' => 'mutasi',
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => auth()->id() ?? $approvable->created_by,
                    'keterangan' => "Mutasi {$approvable->jenis_mutasi->label()} ({$approvable->originUnit->name} -> {$approvable->destinationUnit->name}) No. {$approvable->nomor_mutasi}. ".($item->catatan ?? ''),
                ]);
```

dengan:

```php
                $asset = $assets->get($item->asset_id);
                $returned = $approvable->jenis_mutasi === MutationType::Pengembalian;
                $previousHolder = $asset->currentHolder?->nama;

                $asset->update([
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'status' => AssetStatus::Aktif,
                ]);

                AssetHistory::create([
                    'asset_id' => $asset->id,
                    'event' => $returned ? 'pengembalian' : 'mutasi',
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => auth()->id() ?? $approvable->created_by,
                    'keterangan' => $returned
                        ? "Dikembalikan oleh {$previousHolder} ke inventaris {$approvable->destinationUnit->name}, No. {$approvable->nomor_mutasi}. ".($item->catatan ?? '')
                        : "Mutasi {$approvable->jenis_mutasi->label()} ({$approvable->originUnit->name} -> {$approvable->destinationUnit->name}) No. {$approvable->nomor_mutasi}. ".($item->catatan ?? ''),
                ]);
```

dan tambahkan `use App\Enums\MutationType;` pada daftar `use` berkas itu.

`app/Http/Requests/StoreAssetMutationRequest.php`: ubah dua aturan menjadi:

```php
            'keterangan' => [Rule::requiredIf(fn () => $this->input('jenis_mutasi') === MutationType::Pengembalian->value), 'nullable', 'string', 'max:1000'],
```
```php
            'items.*.target_holder_id' => ['nullable', 'integer', 'exists:pegawais,id', Rule::prohibitedIf(fn () => $this->input('jenis_mutasi') === MutationType::Pengembalian->value)],
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter="PengembalianAsetTest|AssetMutation|MutationRecap|MutationExcel|LaporanMutasi|AssetRequest"`
Expected: PASS. Bila test laporan gagal pada `jenisOptions`, lihat `LaporanMutasiController.php:65` dan sesuaikan kunci tes (nama prop sudah `jenisOptions`).

- [ ] **Step 5: Commit**

```bash
git add app/Enums/MutationType.php app/Services/AssetMutationService.php app/Services/AssetMutationEffect.php app/Http/Requests/StoreAssetMutationRequest.php tests/Feature/PengembalianAsetTest.php
git commit -m "feat(mutation): add pengembalian type returning held assets to inventory with its own approval"
```

---

### Task 3: Frontend, verifikasi akhir, dan seeding dev

**Files:**
- Modify: `resources/js/types/index.d.ts:180`, `resources/js/lib/chartColors.ts`, `resources/js/Pages/AssetMutations/Create.tsx`, `resources/js/Pages/AssetMutations/Index.tsx`, `resources/js/Pages/AssetMutations/Show.tsx`

**Interfaces:**
- Consumes: jenis `'pengembalian'` dan prop `assets[].current_holder` (sudah dikirim `AssetMutationController::create`), `mutation.jenis_mutasi` (Task 2).
- Produces: UI form/daftar/detail untuk jenis baru.

- [ ] **Step 1: Skrip edit frontend**

Simpan skrip berikut dengan alat Write ke `C:/Users/ABDULA~1/AppData/Local/Temp/pg_front.py` (jangan lewat heredoc), lalu jalankan `python C:/Users/ABDULA~1/AppData/Local/Temp/pg_front.py` dari root repo:

```python
def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:70], s.count(old))
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


edit('resources/js/types/index.d.ts', [
    ("export type MutationType = 'kec_ke_kel' | 'antar_kel' | 'retur_kel_ke_kec' | 'internal';",
     "export type MutationType = 'kec_ke_kel' | 'antar_kel' | 'retur_kel_ke_kec' | 'internal' | 'pengembalian';"),
])

edit('resources/js/lib/chartColors.ts', [
    ("    internal: '#334155',\n", "    internal: '#334155',\n    pengembalian: '#B45309',\n"),
])

STYLE_OLD = "    internal: 'bg-teal-50 text-teal-700 border-teal-200/60',\n"
STYLE_NEW = STYLE_OLD + "    pengembalian: 'bg-amber-50 text-amber-700 border-amber-200/60',\n"
LABEL_OLD = "    internal: 'Mutasi Internal',\n"
LABEL_NEW = LABEL_OLD + "    pengembalian: 'Pengembalian ke Inventaris',\n"

edit('resources/js/Pages/AssetMutations/Index.tsx', [
    (STYLE_OLD, STYLE_NEW),
    (LABEL_OLD, LABEL_NEW),
    ("{mutation.jenis_mutasi === 'internal' ? (",
     "{mutation.jenis_mutasi === 'internal' || mutation.jenis_mutasi === 'pengembalian' ? ("),
    ("{mutation.origin_unit?.name} (Internal)",
     "{mutation.origin_unit?.name} ({mutation.jenis_mutasi === 'pengembalian' ? 'Ke Inventaris' : 'Internal'})"),
])

edit('resources/js/Pages/AssetMutations/Show.tsx', [
    (STYLE_OLD, STYLE_NEW),
    (LABEL_OLD, LABEL_NEW),
    ("""                                                            {newHolder?.nama ??
                                                                mutation.destination_unit?.name ??
                                                                'Unit Penerima'}""",
     """                                                            {newHolder?.nama ??
                                                                (mutation.jenis_mutasi === 'pengembalian'
                                                                    ? 'Inventaris unit'
                                                                    : (mutation.destination_unit?.name ?? 'Unit Penerima'))}"""),
])

OPT_KEC = '<option value="internal">Mutasi Internal Kecamatan</option>'
OPT_KEL = '<option value="internal">Mutasi Internal Kelurahan</option>'
IND = ' ' * 44

edit('resources/js/Pages/AssetMutations/Create.tsx', [
    ("    const originUnit = useMemo(\n",
     "    const isReturn = form.data.jenis_mutasi === 'pengembalian';\n"
     "    const sameUnit = form.data.jenis_mutasi === 'internal' || isReturn;\n\n"
     "    const originUnit = useMemo(\n"),
    ("""        if (form.data.jenis_mutasi === 'internal') {
            const origin = allUnits.find((u) => u.id === originId);""",
     """        if (sameUnit) {
            const origin = allUnits.find((u) => u.id === originId);"""),
    ("""        return assets.filter((a) => a.unit_id === originId && a.status === 'aktif');
    }, [assets, form.data.origin_unit_id]);""",
     """        return assets.filter(
            (a) => a.unit_id === originId && a.status === 'aktif' && (!isReturn || a.current_holder != null),
        );
    }, [assets, form.data.origin_unit_id, isReturn]);"""),
    ("""            form.data.jenis_mutasi === 'internal'
                ? Number(form.data.origin_unit_id)
                : Number(form.data.destination_unit_id);""",
     """            sameUnit
                ? Number(form.data.origin_unit_id)
                : Number(form.data.destination_unit_id);"""),
    ("            if (newType === 'internal') {\n                nextDest = originId;",
     "            if (newType === 'internal' || newType === 'pengembalian') {\n                nextDest = originId;"),
    ("""                data.jenis_mutasi === 'internal'
                    ? Number(data.origin_unit_id)
                    : Number(data.destination_unit_id),""",
     """                data.jenis_mutasi === 'internal' || data.jenis_mutasi === 'pengembalian'
                    ? Number(data.origin_unit_id)
                    : Number(data.destination_unit_id),"""),
    ("                target_holder_id: item.target_holder_id ? Number(item.target_holder_id) : null,",
     "                target_holder_id:\n                    data.jenis_mutasi !== 'pengembalian' && item.target_holder_id ? Number(item.target_holder_id) : null,"),
    (OPT_KEC, OPT_KEC + '\n' + IND + '<option value="pengembalian">Pengembalian ke Inventaris</option>'),
    (OPT_KEL, OPT_KEL + '\n' + IND + '<option value="pengembalian">Pengembalian ke Inventaris</option>'),
    ("""                                {form.errors.jenis_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.jenis_mutasi}</p>
                                )}""",
     """                                {form.errors.jenis_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.jenis_mutasi}</p>
                                )}
                                {isReturn && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        Aset kembali menjadi stok unit setelah disetujui. Untuk memindahkan langsung ke pegawai lain
                                        gunakan Mutasi Internal.
                                    </p>
                                )}"""),
    ("                                                d.jenis_mutasi === 'internal' ? newOriginId : '',",
     "                                                d.jenis_mutasi === 'internal' || d.jenis_mutasi === 'pengembalian' ? newOriginId : '',"),
    ("{form.data.jenis_mutasi !== 'internal' && (", "{!sameUnit && ("),
    ("""                                    Keterangan / Alasan Mutasi
                                </label>
                                <textarea
                                    rows={2}""",
     """                                    Keterangan / Alasan {isReturn ? 'Pengembalian' : 'Mutasi'}
                                    {isReturn && <span className="text-red-500"> *</span>}
                                </label>
                                <textarea
                                    rows={2}
                                    required={isReturn}"""),
    ("""                                            {/* Pilih Aset */}
                                            <div className="lg:col-span-5">""",
     """                                            {/* Pilih Aset */}
                                            <div className={isReturn ? 'lg:col-span-9' : 'lg:col-span-5'}>"""),
    ("""                                                                {a.kode_barang} - {a.nama_aset}
                                                                {isSelectedElsewhere ? ' (sudah dipilih)' : ''}""",
     """                                                                {a.kode_barang} - {a.nama_aset}
                                                                {isReturn && a.current_holder ? ` (dipegang: ${a.current_holder.nama})` : ''}
                                                                {isSelectedElsewhere ? ' (sudah dipilih)' : ''}"""),
    ("""                                            {/* Pemegang Baru */}
                                            <div className="lg:col-span-4">""",
     """                                            {/* Pemegang Baru */}
                                            {!isReturn && (
                                            <div className="lg:col-span-4">"""),
    ("""                                                {itemHolderError && (
                                                    <p className="mt-1 text-xs text-red-600">{itemHolderError}</p>
                                                )}
                                            </div>
""",
     """                                                {itemHolderError && (
                                                    <p className="mt-1 text-xs text-red-600">{itemHolderError}</p>
                                                )}
                                            </div>
                                            )}
"""),
])
print('ok')
```

- [ ] **Step 2: Verifikasi frontend**

Run: `python C:/Users/ABDULA~1/AppData/Local/Temp/pg_front.py` lalu `npx tsc --noEmit` lalu `npm run build`
Expected: skrip mencetak `ok` (semua `assert` lolos), `tsc` tanpa error, build sukses. Bila `tsc` mengeluh `a.current_holder` tidak ada pada tipe `Asset`, tambahkan `current_holder?: Pegawai | null;` pada `interface Asset` di `resources/js/types/index.d.ts` (properti itu memang dikirim server dan sudah dipakai di `Create.tsx`).

- [ ] **Step 3: Suite penuh**

Run (latar belakang): `php artisan test`
Expected: seluruh suite hijau (baseline 601 + test baru). Perbaiki regresi sebelum lanjut.

- [ ] **Step 4: Seeding database dev**

Run: `php artisan db:seed --class=WorkflowDefinitionSeeder`
Expected: `DONE`. Seeder non-destruktif; hanya membuat `pengembalian_aset` yang belum ada. Tanpa langkah ini, pengajuan pengembalian di dev gagal dengan pesan "Alur persetujuan 'pengembalian_aset' belum dikonfigurasi".

- [ ] **Step 5: Commit**

```bash
git add resources/js/types/index.d.ts resources/js/lib/chartColors.ts resources/js/Pages/AssetMutations/Create.tsx resources/js/Pages/AssetMutations/Index.tsx resources/js/Pages/AssetMutations/Show.tsx
git commit -m "feat(mutation): pengembalian ke inventaris in the mutation form, list and detail"
```
