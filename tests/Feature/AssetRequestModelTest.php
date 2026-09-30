<?php

use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use App\Models\Asset;
use App\Models\AssetRequest;

it('creates a pegawai request with casts and relations', function () {
    $request = AssetRequest::factory()->create();

    expect($request->jenis)->toBe(AssetRequestType::Pegawai)
        ->and($request->status)->toBe(AssetRequestStatus::Pending)
        ->and($request->pegawai)->not->toBeNull()
        ->and($request->unit_id)->toBe($request->pegawai->unit_id)
        ->and($request->jumlah)->toBe(1)
        ->and($request->category->parent_id)->not->toBeNull()
        ->and($request->approvalTitle())->toBe("Permohonan Aset #{$request->nomor_permohonan}");
});

it('creates a unit request and attaches fulfilled assets', function () {
    $request = AssetRequest::factory()->unitRequest()->create(['jumlah' => 2]);
    $asset = Asset::factory()->create(['unit_id' => $request->unit->parent_id]);

    $request->assets()->attach($asset->id);

    expect($request->jenis)->toBe(AssetRequestType::Unit)
        ->and($request->pegawai_id)->toBeNull()
        ->and($request->unit->isKelurahan())->toBeTrue()
        ->and($request->assets)->toHaveCount(1);
});

it('marks itself rejected or cancelled through the approval outcome hooks', function () {
    $request = AssetRequest::factory()->create();
    $request->onApprovalRejected();
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Rejected);

    $request->update(['status' => 'pending']);
    $request->onApprovalCancelled();
    expect($request->fresh()->status)->toBe(AssetRequestStatus::Cancelled);
});
