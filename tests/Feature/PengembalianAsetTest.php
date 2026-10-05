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
