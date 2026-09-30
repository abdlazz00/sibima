<?php

use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;

it('orders conditions by severity', function () {
    expect(Kondisi::Baik->severity())->toBeLessThan(Kondisi::RusakRingan->severity())
        ->and(Kondisi::RusakRingan->severity())->toBeLessThan(Kondisi::RusakBerat->severity())
        ->and(Kondisi::RusakBerat->severity())->toBeLessThan(Kondisi::Hilang->severity());
});

it('creates a report with casts, relations and photos', function () {
    $unit = makeKecamatan();
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create(['asset_id' => $asset->id, 'unit_id' => $unit->id]);

    $report->photos()->create(['path' => 'asset-reports/1/a.jpg']);

    expect($report->jenis)->toBe(AssetReportType::Rusak)
        ->and($report->kondisi_baru)->toBe(Kondisi::RusakRingan)
        ->and($report->status)->toBe(AssetReportStatus::Pending)
        ->and($report->asset->is($asset))->toBeTrue()
        ->and($report->unit->is($unit))->toBeTrue()
        ->and($report->photos)->toHaveCount(1)
        ->and($asset->reports)->toHaveCount(1)
        ->and($report->approvalTitle())->toBe("Laporan Rusak #{$report->nomor_laporan}");
});

it('releases nothing on the asset when rejected or cancelled, only its own status', function () {
    $unit = makeKecamatan();
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create(['asset_id' => $asset->id, 'unit_id' => $unit->id]);

    $report->onApprovalRejected();
    expect($report->fresh()->status)->toBe(AssetReportStatus::Rejected);

    $report->update(['status' => 'pending']);
    $report->onApprovalCancelled();
    expect($report->fresh()->status)->toBe(AssetReportStatus::Cancelled)
        ->and($asset->fresh()->kondisi)->toBe(Kondisi::Baik);
});
