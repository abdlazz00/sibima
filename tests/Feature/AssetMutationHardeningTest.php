<?php

use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\Pegawai;
use Database\Seeders\WorkflowDefinitionSeeder;
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
    $this->lurahB = userWithRole('lurah', $this->kelB);

    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->seq = 0;
});

function mutAsset(object $t, $unit, AssetStatus $status = AssetStatus::Aktif): Asset
{
    $t->seq++;

    return Asset::create([
        'kode_barang' => '1.3.2.05.02.04.'.str_pad((string) $t->seq, 3, '0', STR_PAD_LEFT),
        'nomor_register' => $t->seq,
        'nama_aset' => "Aset {$t->seq}",
        'category_id' => $t->category->id,
        'unit_id' => $unit->id,
        'kondisi' => 'baik',
        'status' => $status,
        'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD',
        'nilai_perolehan' => 1000000,
        'nilai_buku' => 1000000,
    ]);
}

function mutPayload(string $no, string $jenis, $origin, $dest, array $assets, ?int $holder = null): array
{
    return [
        'nomor_mutasi' => $no,
        'jenis_mutasi' => $jenis,
        'origin_unit_id' => $origin->id,
        'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => '2026-09-29',
        'items' => array_map(fn ($a) => ['asset_id' => $a->id, 'target_holder_id' => $holder], $assets),
    ];
}

function approveAs(object $t, $user, AssetMutation $m): void
{
    $t->actingAs($user)->post(route('approval-requests.approve', $m->approvalRequest))->assertRedirect();
}

it('lists a pending mutation in the Kotak Persetujuan inbox with a link to its detail page', function () {
    $asset = mutAsset($this, $this->kec);
    $this->actingAs($this->adminKec)->post('/asset-mutations', mutPayload('M/1', 'kec_ke_kel', $this->kec, $this->kelA, [$asset]));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/1')->firstOrFail();

    $this->actingAs($this->kasubag)->get('/persetujuan')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Persetujuan/Index')
            ->where('items.0.show_url', route('asset-mutations.show', $mutation))
            ->where('items.0.title', "Mutasi Aset #{$mutation->nomor_mutasi}"));
});

it('refuses a mutation type that does not match the origin and destination unit kinds, leaving assets untouched', function (string $jenis, string $originKey, string $destKey, string $actor) {
    $units = ['kec' => $this->kec, 'kelA' => $this->kelA, 'kelB' => $this->kelB];
    $asset = mutAsset($this, $units[$originKey]);

    $this->actingAs($this->$actor)
        ->from('/asset-mutations/create')
        ->post('/asset-mutations', mutPayload('M/X', $jenis, $units[$originKey], $units[$destKey], [$asset]))
        ->assertRedirect('/asset-mutations/create')
        ->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
})->with([
    'retur from kecamatan' => ['retur_kel_ke_kec', 'kec', 'kelA', 'adminKec'],
    'antar_kel from kecamatan' => ['antar_kel', 'kec', 'kelA', 'adminKec'],
    'kec_ke_kel from a kelurahan' => ['kec_ke_kel', 'kelA', 'kelB', 'adminKelA'],
    'antar_kel into the kecamatan' => ['antar_kel', 'kelA', 'kec', 'adminKelA'],
    'retur into another kelurahan' => ['retur_kel_ke_kec', 'kelA', 'kelB', 'adminKelA'],
]);

it('shows a clear error instead of a 500 when an asset is already locked by another mutation', function () {
    $asset = mutAsset($this, $this->kec, AssetStatus::DalamProses);

    $this->actingAs($this->adminKec)
        ->from('/asset-mutations/create')
        ->post('/asset-mutations', mutPayload('M/2', 'kec_ke_kel', $this->kec, $this->kelA, [$asset]))
        ->assertRedirect('/asset-mutations/create')
        ->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0);
});

it('shows a clear error when the same asset is listed twice', function () {
    $asset = mutAsset($this, $this->kec);

    $this->actingAs($this->adminKec)
        ->from('/asset-mutations/create')
        ->post('/asset-mutations', mutPayload('M/3', 'kec_ke_kel', $this->kec, $this->kelA, [$asset, $asset]))
        ->assertRedirect('/asset-mutations/create')
        ->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
});

it('refuses a target holder that does not belong to the destination unit', function () {
    $asset = mutAsset($this, $this->kec);
    $wrongUnitHolder = Pegawai::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKec)
        ->from('/asset-mutations/create')
        ->post('/asset-mutations', mutPayload('M/4', 'kec_ke_kel', $this->kec, $this->kelA, [$asset], $wrongUnitHolder->id))
        ->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
});

it('refuses an internal mutation whose new holder belongs to a different unit', function () {
    $asset = mutAsset($this, $this->kec);
    $wrongUnitHolder = Pegawai::factory()->create(['unit_id' => $this->kelA->id]);

    $this->actingAs($this->adminKec)
        ->from('/asset-mutations/create')
        ->post('/asset-mutations', mutPayload('M/5', 'internal', $this->kec, $this->kec, [$asset], $wrongUnitHolder->id))
        ->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0);
});

it('fails final approval clearly when an asset no longer belongs to the origin unit', function () {
    $asset = mutAsset($this, $this->kec);
    $holder = Pegawai::factory()->create(['unit_id' => $this->kec->id]);
    $this->actingAs($this->adminKec)->post('/asset-mutations', mutPayload('M/6', 'internal', $this->kec, $this->kec, [$asset], $holder->id));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/6')->firstOrFail();

    $asset->update(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->camat)
        ->post(route('approval-requests.approve', $mutation->approvalRequest))
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($asset->fresh()->unit_id)->toBe($this->kelB->id)
        ->and($mutation->fresh()->status)->toBe(MutationStatus::Pending)
        ->and($mutation->approvalRequest->fresh()->status->value)->toBe('pending');
});

it('does not send pegawai NIP to the create page', function () {
    Pegawai::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKelA)->get('/asset-mutations/create')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('pegawais.0', fn ($p) => $p->missing('nip')->etc()));
});

it('runs a full antar_kel mutation through all three steps', function () {
    $asset = mutAsset($this, $this->kelA);
    $this->actingAs($this->adminKelA)->post('/asset-mutations', mutPayload('M/7', 'antar_kel', $this->kelA, $this->kelB, [$asset]));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/7')->firstOrFail();

    $this->actingAs($this->lurahB)->post(route('approval-requests.approve', $mutation->approvalRequest))->assertForbidden();

    approveAs($this, $this->lurahA, $mutation);
    approveAs($this, $this->adminKelB, $mutation);
    approveAs($this, $this->lurahB, $mutation);

    expect($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kelB->id)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif);
});

it('runs a full retur_kel_ke_kec mutation through all four steps', function () {
    $asset = mutAsset($this, $this->kelA);
    $this->actingAs($this->adminKelA)->post('/asset-mutations', mutPayload('M/8', 'retur_kel_ke_kec', $this->kelA, $this->kec, [$asset]));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/8')->firstOrFail();

    approveAs($this, $this->lurahA, $mutation);
    approveAs($this, $this->adminKec, $mutation);
    approveAs($this, $this->kasubag, $mutation);
    approveAs($this, $this->camat, $mutation);

    expect($mutation->fresh()->status)->toBe(MutationStatus::Approved)
        ->and($asset->fresh()->unit_id)->toBe($this->kec->id);
});

it('runs an internal kelurahan mutation with a single lurah approval', function () {
    $asset = mutAsset($this, $this->kelA);
    $holder = Pegawai::factory()->create(['unit_id' => $this->kelA->id]);
    $this->actingAs($this->adminKelA)->post('/asset-mutations', mutPayload('M/9', 'internal', $this->kelA, $this->kelA, [$asset], $holder->id));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/9')->firstOrFail();

    approveAs($this, $this->lurahA, $mutation);

    expect($asset->fresh()->current_holder_id)->toBe($holder->id);
});

it('rejects via HTTP at any step, releases the lock and leaves the asset in place', function () {
    $asset = mutAsset($this, $this->kelA);
    $this->actingAs($this->adminKelA)->post('/asset-mutations', mutPayload('M/10', 'antar_kel', $this->kelA, $this->kelB, [$asset]));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/10')->firstOrFail();
    expect($asset->fresh()->status)->toBe(AssetStatus::DalamProses);

    approveAs($this, $this->lurahA, $mutation);
    $this->actingAs($this->adminKelB)
        ->post(route('approval-requests.reject', $mutation->approvalRequest), ['note' => 'Barang tidak sesuai'])
        ->assertRedirect();

    expect($mutation->fresh()->status)->toBe(MutationStatus::Rejected)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif)
        ->and($asset->fresh()->unit_id)->toBe($this->kelA->id);
});

it('forbids users from unrelated units from viewing a mutation', function () {
    $asset = mutAsset($this, $this->kelA);
    $this->actingAs($this->adminKelA)->post('/asset-mutations', mutPayload('M/11', 'antar_kel', $this->kelA, $this->kelB, [$asset]));
    $mutation = AssetMutation::where('nomor_mutasi', 'M/11')->firstOrFail();

    $kelC = makeKelurahan($this->kec, 'Kelurahan C');
    $outsider = userWithRole('lurah', $kelC);

    $this->actingAs($outsider)->get(route('asset-mutations.show', $mutation))->assertForbidden();
    $this->actingAs($this->lurahB)->get(route('asset-mutations.show', $mutation))->assertOk();
});
