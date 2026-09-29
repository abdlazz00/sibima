<?php

use App\Enums\ApprovalStatus;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'kasubag', 'camat', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->otherAdminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->workflow = app(ApprovalWorkflowService::class);
});

function pendingBa(object $t): BeritaAcaraPenerimaan
{
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/C/'.uniqid(), 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/C', 'unit_id' => $t->kec->id,
        'created_by' => $t->adminKec->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $t->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);
    $t->workflow->submit($ba, 'penerimaan_aset', $t->adminKec);

    return $ba->fresh();
}

function pendingMutation(object $t): array
{
    $asset = Asset::create([
        'kode_barang' => '1.3.2.05.02.04.'.random_int(100, 999), 'nomor_register' => random_int(1, 9999),
        'nama_aset' => 'PC', 'category_id' => $t->category->id, 'unit_id' => $t->kec->id,
        'kondisi' => 'baik', 'status' => AssetStatus::Aktif, 'tanggal_perolehan' => '2025-01-01',
        'sumber_perolehan' => 'APBD', 'nilai_perolehan' => 1, 'nilai_buku' => 1,
    ]);
    $t->actingAs($t->adminKec)->post('/asset-mutations', [
        'nomor_mutasi' => 'M/'.uniqid(), 'jenis_mutasi' => 'kec_ke_kel',
        'origin_unit_id' => $t->kec->id, 'destination_unit_id' => $t->kel->id,
        'tanggal_mutasi' => '2026-09-29', 'items' => [['asset_id' => $asset->id]],
    ]);

    return [AssetMutation::latest('id')->firstOrFail(), $asset];
}

it('lets the submitter cancel a pending request with a note', function () {
    $ba = pendingBa($this);

    $this->workflow->cancel($ba->approvalRequest, $this->adminKec, 'Salah input jumlah');

    $request = $ba->approvalRequest->fresh();
    expect($request->status)->toBe(ApprovalStatus::Cancelled)
        ->and($request->actions()->where('action', 'cancel')->where('note', 'Salah input jumlah')->exists())->toBeTrue()
        ->and($this->workflow->canAct($this->kasubag, $request))->toBeFalse();
});

it('lets the submitter cancel after an approver has already acted', function () {
    $ba = pendingBa($this);
    $this->workflow->approve($ba->approvalRequest, $this->kasubag);

    $this->workflow->cancel($ba->approvalRequest->fresh(), $this->adminKec, 'Dibatalkan');

    expect($ba->approvalRequest->fresh()->status)->toBe(ApprovalStatus::Cancelled);
});

it('refuses cancellation by anyone other than the submitter', function () {
    $ba = pendingBa($this);

    expect($this->workflow->canCancel($this->otherAdminKec, $ba->approvalRequest))->toBeFalse()
        ->and($this->workflow->canCancel($this->kasubag, $ba->approvalRequest))->toBeFalse()
        ->and(fn () => $this->workflow->cancel($ba->approvalRequest, $this->otherAdminKec, 'x'))->toThrow(InvalidArgumentException::class);
});

it('refuses cancelling a request that is already decided', function () {
    $ba = pendingBa($this);
    $this->workflow->reject($ba->approvalRequest, $this->kasubag, 'Tidak lengkap');

    expect($this->workflow->canCancel($this->adminKec, $ba->approvalRequest->fresh()))->toBeFalse()
        ->and(fn () => $this->workflow->cancel($ba->approvalRequest->fresh(), $this->adminKec, 'x'))->toThrow(InvalidArgumentException::class);
});

it('cancels via HTTP and requires a note', function () {
    $ba = pendingBa($this);
    $url = route('approval-requests.cancel', $ba->approvalRequest);

    $this->actingAs($this->adminKec)->from('/x')->post($url, [])->assertSessionHasErrors('note');
    $this->actingAs($this->otherAdminKec)->post($url, ['note' => 'x'])->assertForbidden();
    $this->actingAs($this->adminKec)->post($url, ['note' => 'Salah input'])->assertRedirect();

    expect($ba->approvalRequest->fresh()->status)->toBe(ApprovalStatus::Cancelled);
    $this->actingAs($this->adminKec)->post($url, ['note' => 'lagi'])->assertForbidden();
});

it('releases the asset lock and marks the mutation cancelled', function () {
    [$mutation, $asset] = pendingMutation($this);
    expect($asset->fresh()->status)->toBe(AssetStatus::DalamProses);

    $this->actingAs($this->adminKec)
        ->post(route('approval-requests.cancel', $mutation->approvalRequest), ['note' => 'Batal'])
        ->assertRedirect();

    expect($mutation->fresh()->status)->toBe(MutationStatus::Cancelled)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Aktif)
        ->and($mutation->approvalRequest->fresh()->status)->toBe(ApprovalStatus::Cancelled);
});

it('exposes can.cancel only to the submitter on both detail pages', function () {
    $ba = pendingBa($this);
    [$mutation] = pendingMutation($this);

    $this->actingAs($this->adminKec)->get(route('penerimaan-aset.show', $ba))
        ->assertInertia(fn ($p) => $p->where('can.cancel', true));
    $this->actingAs($this->kasubag)->get(route('penerimaan-aset.show', $ba))
        ->assertInertia(fn ($p) => $p->where('can.cancel', false));
    $this->actingAs($this->adminKec)->get(route('asset-mutations.show', $mutation))
        ->assertInertia(fn ($p) => $p->where('can.cancel', true));
    $this->actingAs($this->kasubag)->get(route('asset-mutations.show', $mutation))
        ->assertInertia(fn ($p) => $p->where('can.cancel', false));
});

it('drops a cancelled request from the approver inbox', function () {
    $ba = pendingBa($this);
    $this->workflow->cancel($ba->approvalRequest, $this->adminKec, 'Batal');

    $this->actingAs($this->kasubag)->get('/persetujuan')
        ->assertInertia(fn ($p) => $p->where('items', []));
});
