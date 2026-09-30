<?php

use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('public');
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'lurah', 'kasubag'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKelA = userWithRole('admin_kelurahan', $this->kelA);
    $this->adminKelB = userWithRole('admin_kelurahan', $this->kelB);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurahA = userWithRole('lurah', $this->kelA);
    $this->lurahB = userWithRole('lurah', $this->kelB);
    $this->kasubag = userWithRole('kasubag');
    $this->assetKec = Asset::factory()->create(['unit_id' => $this->kec->id]);
    $this->assetKelA = Asset::factory()->create(['unit_id' => $this->kelA->id]);
});

function reportPayload(array $override = []): array
{
    return array_merge([
        'jenis' => 'rusak', 'kondisi_baru' => 'rusak_ringan', 'tanggal_kejadian' => now()->toDateString(),
        'kronologi' => 'Jatuh saat dipindahkan.', 'photos' => [UploadedFile::fake()->image('a.jpg')],
    ], $override);
}

it('lets an admin file a rusak report for an asset in their unit', function () {
    $response = $this->actingAs($this->adminKelA)->post(route('asset-reports.store'), reportPayload(['asset_id' => $this->assetKelA->id]));

    $report = AssetReport::firstOrFail();
    $response->assertRedirect(route('asset-reports.show', $report));
    expect($report->unit_id)->toBe($this->kelA->id)->and($report->photos)->toHaveCount(1);
});

it('refuses other units and non-admin roles with 403', function () {
    $payload = reportPayload(['asset_id' => $this->assetKelA->id]);

    $this->actingAs($this->adminKelB)->post(route('asset-reports.store'), $payload)->assertForbidden();
    $this->actingAs($this->adminKec)->post(route('asset-reports.store'), $payload)->assertForbidden();
    foreach (['camat', 'lurahA', 'kasubag'] as $who) {
        $this->actingAs($this->$who)->post(route('asset-reports.store'), $payload)->assertForbidden();
        $this->actingAs($this->$who)->get(route('asset-reports.create'))->assertForbidden();
    }
    expect(AssetReport::count())->toBe(0);
});

it('rejects bad uploads and business-rule violations without creating anything', function () {
    $base = ['asset_id' => $this->assetKelA->id];

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => array_map(fn ($i) => UploadedFile::fake()->image("f{$i}.jpg"), range(1, 11)),
    ]))->assertSessionHasErrors('photos');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => [UploadedFile::fake()->create('fake.jpg', 10, 'text/plain')],
    ]))->assertSessionHasErrors('photos.0');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + [
        'photos' => [UploadedFile::fake()->image('big.jpg')->size(6000)],
    ]))->assertSessionHasErrors('photos.0');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + ['photos' => []]))
        ->assertRedirect('/x')->assertSessionHas('error');

    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base + ['tanggal_kejadian' => now()->addDay()->toDateString()]))
        ->assertSessionHasErrors('tanggal_kejadian');

    $this->assetKelA->update(['kondisi' => Kondisi::Hilang]);
    $this->actingAs($this->adminKelA)->from('/x')->post(route('asset-reports.store'), reportPayload($base))
        ->assertRedirect('/x')->assertSessionHas('error');

    expect(AssetReport::count())->toBe(0);
    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('offers only reportable assets of the admin unit on the create page', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'kondisi' => Kondisi::Hilang]);
    $pending = Asset::factory()->create(['unit_id' => $this->kelA->id]);
    AssetReport::factory()->create(['asset_id' => $pending->id, 'unit_id' => $this->kelA->id]);
    Asset::factory()->create(['unit_id' => $this->kelB->id]);

    $this->actingAs($this->adminKelA)->get(route('asset-reports.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('AssetReports/Create')
            ->where('assets', fn ($a) => collect($a)->pluck('id')->all() === [$this->assetKelA->id])
            ->has('kondisiOptions', 2));
});

it('scopes the index and detail page by unit and filters by status and jenis', function () {
    $mine = AssetReport::factory()->create(['asset_id' => $this->assetKelA->id, 'unit_id' => $this->kelA->id, 'status' => 'pending']);
    $otherAsset = Asset::factory()->create(['unit_id' => $this->kelB->id]);
    $theirs = AssetReport::factory()->create(['asset_id' => $otherAsset->id, 'unit_id' => $this->kelB->id, 'status' => 'approved', 'jenis' => 'hilang', 'kondisi_baru' => 'hilang']);

    $ids = fn ($user, $query = '') => collect($this->actingAs($user)->get('/asset-reports'.$query)->viewData('page')['props']['items']['data'])->pluck('id')->sort()->values()->all();

    expect($ids($this->adminKelA))->toBe([$mine->id])
        ->and($ids($this->lurahB))->toBe([$theirs->id])
        ->and($ids($this->camat))->toBe(collect([$mine->id, $theirs->id])->sort()->values()->all())
        ->and($ids($this->kasubag, '?status=approved'))->toBe([$theirs->id])
        ->and($ids($this->kasubag, '?jenis=rusak'))->toBe([$mine->id]);

    $this->actingAs($this->adminKelB)->get(route('asset-reports.show', $mine))->assertForbidden();
    $this->actingAs($this->lurahA)->get(route('asset-reports.show', $mine))->assertOk();
});

it('exposes the tracker and action flags on the detail page and completes through the generic approval endpoint', function () {
    $this->actingAs($this->adminKelA)->post(route('asset-reports.store'), reportPayload(['asset_id' => $this->assetKelA->id, 'kondisi_baru' => 'rusak_berat']));
    $report = AssetReport::firstOrFail();

    $this->actingAs($this->adminKelA)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p
            ->has('report.approval_request.steps', 1)
            ->where('can.act', false)->where('can.cancel', true)->where('can.reassign', false));
    $this->actingAs($this->lurahA)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p->where('can.act', true)->where('can.cancel', false));
    $this->actingAs($this->kasubag)->get(route('asset-reports.show', $report))
        ->assertInertia(fn (Assert $p) => $p->where('can.reassign', true)->has('reassignCandidates'));

    $this->actingAs($this->camat)->post(route('approval-requests.approve', $report->approvalRequest))->assertForbidden();
    $this->actingAs($this->lurahA)->post(route('approval-requests.approve', $report->approvalRequest))->assertRedirect();

    expect($this->assetKelA->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status->value)->toBe('approved');
});
