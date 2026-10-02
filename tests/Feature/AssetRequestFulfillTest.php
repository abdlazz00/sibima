<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kel2 = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->adminKel2 = userWithRole('admin_kelurahan', $this->kel2);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->otherCategory = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->service = app(AssetRequestService::class);
    $this->engine = app(ApprovalWorkflowService::class);
});

function reqAsset(object $t, $unit, array $o = []): Asset
{
    return Asset::factory()->create($o + ['unit_id' => $unit->id, 'category_id' => $t->category->id]);
}

function reqPegawaiApproved(object $t): AssetRequest
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kel->id]);
    $request = $t->service->create(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop'], $t->adminKel);
    $t->engine->approve($request->approvalRequest, $t->lurah);

    return $request->fresh();
}

function reqUnitApproved(object $t, int $jumlah = 2): AssetRequest
{
    $request = $t->service->create(['jenis' => 'unit', 'jumlah' => $jumlah, 'category_id' => $t->category->id, 'keterangan' => 'Stok'], $t->adminKel);
    $t->engine->approve($request->approvalRequest, $t->kasubag);

    return $request->fresh();
}

function reqApproveMutation(object $t, AssetMutation $mutation): void
{
    $t->engine->approve($mutation->approvalRequest, $t->kasubag);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->camat);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->adminKel);
    $t->engine->approve($mutation->approvalRequest->fresh(), $t->lurah);
}

it('hands an eligible asset to the pegawai atomically and logs the handover', function () {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    $this->service->fulfillPegawai($request, $asset->id, $this->adminKel);

    $history = $asset->fresh()->histories()->first();
    expect($asset->fresh()->current_holder_id)->toBe($request->pegawai_id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($request->fresh()->fulfilled_by)->toBe($this->adminKel->id)
        ->and($request->assets()->pluck('assets.id')->all())->toBe([$asset->id])
        ->and($history->event)->toBe('serah_terima');
});

it('refuses ineligible assets and changes nothing', function (string $case) {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    switch ($case) {
        case 'asset of another unit':
            $asset->update(['unit_id' => $this->kel2->id]);
            break;
        case 'other subcategory':
            $asset->update(['category_id' => $this->otherCategory->id]);
            break;
        case 'already has a holder':
            $asset->update(['current_holder_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id]);
            break;
        case 'dalam proses':
            $asset->update(['status' => AssetStatus::DalamProses]);
            break;
        case 'lost':
            $asset->update(['kondisi' => Kondisi::Hilang]);
            break;
    }

    expect(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(0);
})->with(['asset of another unit', 'other subcategory', 'already has a holder', 'dalam proses', 'lost']);

it('refuses to fulfill twice, before approval, or by the wrong actor', function () {
    $request = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);
    $other = reqAsset($this, $this->kel);

    expect(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKel2))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillPegawai($request, $asset->id, $this->adminKec))->toThrow(InvalidArgumentException::class);

    $this->service->fulfillPegawai($request, $asset->id, $this->adminKel);
    expect(fn () => $this->service->fulfillPegawai($request->fresh(), $other->id, $this->adminKel))->toThrow(InvalidArgumentException::class);

    $pending = $this->service->create(['jenis' => 'pegawai', 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id, 'category_id' => $this->category->id, 'keterangan' => 'x'], $this->adminKel);
    expect(fn () => $this->service->fulfillPegawai($pending, reqAsset($this, $this->kel)->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
});

it('rejects a stale second request for an asset that was handed over in the meantime', function () {
    $first = reqPegawaiApproved($this);
    $second = reqPegawaiApproved($this);
    $asset = reqAsset($this, $this->kel);

    $this->service->fulfillPegawai($first, $asset->id, $this->adminKel);

    expect(fn () => $this->service->fulfillPegawai($second, $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
    expect($asset->fresh()->current_holder_id)->toBe($first->pegawai_id);
});

it('lists only eligible assets for the fulfiller', function () {
    $request = reqPegawaiApproved($this);
    $ok = reqAsset($this, $this->kel);
    reqAsset($this, $this->kel, ['current_holder_id' => Pegawai::factory()->create(['unit_id' => $this->kel->id])->id]);
    reqAsset($this, $this->kel, ['kondisi' => Kondisi::Hilang]);
    reqAsset($this, $this->kel2);
    reqAsset($this, $this->kel, ['category_id' => $this->otherCategory->id]);

    expect($this->service->eligibleAssets($request)->pluck('id')->all())->toBe([$ok->id]);
});

it('creates and submits a kec_ke_kel mutation with the requested number of assets for a unit request', function () {
    $request = reqUnitApproved($this, 2);
    $a = reqAsset($this, $this->kec);
    $b = reqAsset($this, $this->kec);

    $mutation = $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKec);

    expect($mutation->jenis_mutasi->value)->toBe('kec_ke_kel')
        ->and($mutation->origin_unit_id)->toBe($this->kec->id)
        ->and($mutation->destination_unit_id)->toBe($this->kel->id)
        ->and($mutation->items)->toHaveCount(2)
        ->and($mutation->approvalRequest)->not->toBeNull()
        ->and($a->fresh()->status)->toBe(AssetStatus::DalamProses)
        ->and($request->fresh()->mutation_id)->toBe($mutation->id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(2);
});

it('numbers the mutation by its own request only, not by requests sharing the number prefix', function () {
    $request = reqUnitApproved($this, 1);
    \App\Models\AssetMutation::create([
        'nomor_mutasi' => "MUT/{$request->nomor_permohonan}9/1", 'jenis_mutasi' => 'kec_ke_kel',
        'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kel->id,
        'tanggal_mutasi' => '2026-10-01', 'status' => 'pending', 'created_by' => $this->adminKec->id,
    ]);

    $mutation = $this->service->fulfillUnit($request, [reqAsset($this, $this->kec)->id], $this->adminKec);

    expect($mutation->nomor_mutasi)->toBe("MUT/{$request->nomor_permohonan}/1");
});

it('refuses a wrong count, duplicates, ineligible assets, a second mutation and the wrong actor for a unit request', function () {
    $request = reqUnitApproved($this, 2);
    $a = reqAsset($this, $this->kec);
    $b = reqAsset($this, $this->kec);
    $lost = reqAsset($this, $this->kec, ['kondisi' => Kondisi::Hilang]);

    expect(fn () => $this->service->fulfillUnit($request, [$a->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $a->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $lost->id], $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKel))->toThrow(InvalidArgumentException::class)
        ->and(AssetMutation::count())->toBe(0);

    $this->service->fulfillUnit($request, [$a->id, $b->id], $this->adminKec);
    $c = reqAsset($this, $this->kec);
    $d = reqAsset($this, $this->kec);
    expect(fn () => $this->service->fulfillUnit($request->fresh(), [$c->id, $d->id], $this->adminKec))->toThrow(InvalidArgumentException::class);
    expect(AssetMutation::count())->toBe(1);
});

it('marks the request fulfilled when its mutation is finally approved', function () {
    $request = reqUnitApproved($this, 1);
    $asset = reqAsset($this, $this->kec);
    $mutation = $this->service->fulfillUnit($request, [$asset->id], $this->adminKec);

    reqApproveMutation($this, $mutation);

    expect($asset->fresh()->unit_id)->toBe($this->kel->id)
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($request->fresh()->fulfilled_at)->not->toBeNull();
});

it('frees the request to be fulfilled again when its mutation is rejected or cancelled, with a fresh mutation number', function () {
    $request = reqUnitApproved($this, 1);
    $asset = reqAsset($this, $this->kec);
    $first = $this->service->fulfillUnit($request, [$asset->id], $this->adminKec);

    $this->engine->reject($first->approvalRequest, $this->kasubag, 'Belum siap');

    expect($request->fresh()->mutation_id)->toBeNull()
        ->and($request->fresh()->status)->toBe(AssetRequestStatus::Approved)
        ->and($request->assets()->count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);

    $second = $this->service->fulfillUnit($request->fresh(), [$asset->id], $this->adminKec);
    expect($second->nomor_mutasi)->not->toBe($first->nomor_mutasi);

    $this->engine->cancel($second->approvalRequest, $this->adminKec, 'Salah pilih');
    expect($request->fresh()->mutation_id)->toBeNull();
});

it('lets the fulfiller close an approved request with a reason and notifies the requester', function () {
    $request = reqPegawaiApproved($this);
    $adminKelNotifications = $this->adminKel->fresh()->notifications()->count();

    $this->service->close($request, 'Stok laptop habis', $this->adminKel);

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled)
        ->and($request->fresh()->catatan_penutupan)->toBe('Stok laptop habis')
        ->and($this->adminKel->fresh()->notifications()->count())->toBe($adminKelNotifications + 1);
});

it('refuses to close a request that is pending, fulfilled, has a running mutation, or by the wrong actor', function () {
    $approved = reqPegawaiApproved($this);
    expect(fn () => $this->service->close($approved, 'x', $this->adminKec))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->close($approved, 'x', $this->adminKel2))->toThrow(InvalidArgumentException::class);

    $unit = reqUnitApproved($this, 1);
    $this->service->fulfillUnit($unit, [reqAsset($this, $this->kec)->id], $this->adminKec);
    expect(fn () => $this->service->close($unit->fresh(), 'x', $this->adminKec))->toThrow(InvalidArgumentException::class);

    $fulfilled = reqPegawaiApproved($this);
    $this->service->fulfillPegawai($fulfilled, reqAsset($this, $this->kel)->id, $this->adminKel);
    expect(fn () => $this->service->close($fulfilled->fresh(), 'x', $this->adminKel))->toThrow(InvalidArgumentException::class);
});

it('refuses to hand over when the pegawai was deleted or moved to another unit after approval', function () {
    $deleted = reqPegawaiApproved($this);
    $deleted->pegawai->delete();
    $moved = reqPegawaiApproved($this);
    $moved->pegawai->update(['unit_id' => $this->kel2->id]);
    $asset = reqAsset($this, $this->kel);

    expect(fn () => $this->service->fulfillPegawai($deleted->fresh(), $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $this->service->fulfillPegawai($moved->fresh(), $asset->id, $this->adminKel))->toThrow(InvalidArgumentException::class);
    expect($asset->fresh()->current_holder_id)->toBeNull();
});
