<?php

use App\Enums\AssetRequestStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.10.01.02']);
    $this->engine = app(ApprovalWorkflowService::class);
});

function storePegawaiPayload(object $t, $unit, array $o = []): array
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $unit->id]);

    return $o + ['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh laptop'];
}

function reqForUnit(object $t, $unit, string $jenis = 'pegawai'): AssetRequest
{
    if ($jenis === 'unit') {
        return AssetRequest::factory()->unitRequest()->create(['unit_id' => $unit->id]);
    }

    return AssetRequest::factory()->create(['unit_id' => $unit->id, 'pegawai_id' => Pegawai::factory()->create(['unit_id' => $unit->id])->id]);
}

it('lets an admin file a pegawai request and a kelurahan admin a unit request', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA))->assertRedirect();
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 3, 'category_id' => $this->category->id, 'keterangan' => 'Stok kursi'])->assertRedirect();

    expect(AssetRequest::count())->toBe(2)
        ->and(AssetRequest::where('jenis', 'unit')->first()->unit_id)->toBe($this->kelA->id);
});

it('refuses crafted or unauthorised submissions', function () {
    $foreign = storePegawaiPayload($this, $this->kelB);

    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), $foreign)->assertRedirect()->assertSessionHas('error');
    $this->actingAs($this->adminKec)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'x'])
        ->assertRedirect()->assertSessionHas('error');
    foreach (['camat', 'lurahA', 'kasubag'] as $who) {
        $this->actingAs($this->$who)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA))->assertForbidden();
        $this->actingAs($this->$who)->get(route('asset-requests.create'))->assertForbidden();
    }
    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA, ['keterangan' => '']))
        ->assertSessionHasErrors('keterangan');

    expect(AssetRequest::count())->toBe(0);
});

it('offers the create form only the own-unit pegawai and subcategories', function () {
    Pegawai::factory()->create(['unit_id' => $this->kelA->id]);
    Pegawai::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-requests.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('AssetRequests/Create')
            ->has('pegawais', 1)
            ->where('canUnit', true)
            ->where('categories', fn ($c) => collect($c)->pluck('id')->contains($this->category->id)));

    $this->actingAs($this->adminKec)->get(route('asset-requests.create'))
        ->assertInertia(fn (Assert $p) => $p->where('canUnit', false));
});

it('scopes the index and detail page, giving the parent kecamatan admin sight of unit requests from its kelurahan', function () {
    $pegawaiA = reqForUnit($this, $this->kelA);
    $pegawaiB = reqForUnit($this, $this->kelB);
    $unitA = reqForUnit($this, $this->kelA, 'unit');

    $ids = fn ($user) => collect($this->actingAs($user)->get('/asset-requests')->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();
    $sorted = fn (array $ids) => collect($ids)->sort()->values()->all();

    expect($ids($this->adminKelA))->toBe($sorted([$pegawaiA->id, $unitA->id]))
        ->and($ids($this->adminKelB))->toBe([$pegawaiB->id])
        ->and($ids($this->adminKec))->toBe([$unitA->id])
        ->and($ids($this->kasubag))->toBe($sorted([$pegawaiA->id, $pegawaiB->id, $unitA->id]));

    $this->actingAs($this->adminKelB)->get(route('asset-requests.show', $pegawaiA))->assertForbidden();
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $unitA))->assertOk();
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $pegawaiA))->assertForbidden();
});

it('filters the index by status, jenis and pending fulfilment', function () {
    $pending = reqForUnit($this, $this->kelA);
    $approved = reqForUnit($this, $this->kelA);
    $approved->update(['status' => 'approved']);

    $ids = fn ($query) => collect($this->actingAs($this->kasubag)->get('/asset-requests'.$query)->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();

    expect($ids('?status=pending'))->toBe([$pending->id])
        ->and($ids('?menunggu_pemenuhan=1'))->toBe([$approved->id])
        ->and($ids('?jenis=unit'))->toBe([]);
});

it('exposes action flags and eligible assets on the detail page and completes the pegawai flow over HTTP', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA));
    $request = AssetRequest::firstOrFail();
    $asset = Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->has('assetRequest.approval_request.steps', 1)
            ->where('can.cancel', true)->where('can.act', false)->where('can.fulfill', false)->where('eligibleAssets', []));
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $request->approvalRequest))->assertRedirect();

    $this->actingAs($this->adminKelA)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->where('can.fulfill', true)->where('can.close', true)
            ->where('eligibleAssets', fn ($a) => collect($a)->pluck('id')->all() === [$asset->id]));
    $this->actingAs($this->adminKelB)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertForbidden();
    $this->actingAs($this->adminKec)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertForbidden();

    $this->actingAs($this->adminKelA)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$asset->id]])->assertRedirect();

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Fulfilled)
        ->and($asset->fresh()->current_holder_id)->toBe($request->pegawai_id);
});

it('completes the unit flow over HTTP with a mutation and flashes clear errors', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), ['jenis' => 'unit', 'jumlah' => 2, 'category_id' => $this->category->id, 'keterangan' => 'Stok']);
    $request = AssetRequest::firstOrFail();
    $this->actingAs($this->kasubag)->post(route('approval-requests.approve', $request->approvalRequest))->assertRedirect();
    $a = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->category->id]);
    $b = Asset::factory()->create(['unit_id' => $this->kec->id, 'category_id' => $this->category->id]);

    $this->actingAs($this->adminKelA)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id, $b->id]])->assertForbidden();
    $this->actingAs($this->adminKec)->from('/x')->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id]])
        ->assertRedirect('/x')->assertSessionHas('error');
    $this->actingAs($this->adminKec)->post(route('asset-requests.fulfill', $request), ['asset_ids' => [$a->id, $b->id]])->assertRedirect();

    $request->refresh();
    expect($request->mutation_id)->not->toBeNull()
        ->and($request->mutation->items)->toHaveCount(2);
    $this->actingAs($this->adminKec)->get(route('asset-requests.show', $request))
        ->assertInertia(fn (Assert $p) => $p->where('can.fulfill', false)->where('can.close', false)->has('assetRequest.mutation'));
});

it('closes an approved request over HTTP with a required reason', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-requests.store'), storePegawaiPayload($this, $this->kelA));
    $request = AssetRequest::firstOrFail();
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $request->approvalRequest));

    $url = route('asset-requests.close', $request);
    $this->actingAs($this->adminKelA)->from('/x')->post($url, [])->assertSessionHasErrors('note');
    $this->actingAs($this->adminKelB)->post($url, ['note' => 'x'])->assertForbidden();
    $this->actingAs($this->adminKelA)->post($url, ['note' => 'Stok habis'])->assertRedirect();

    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled);
});
