<?php

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Models\WorkflowDefinition;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'lurah', 'kasubag'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kel);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kel);
    $this->service = app(ApprovalWorkflowService::class);
});

function submitReport(object $t, $unit, $creator, array $attrs = []): AssetReport
{
    $asset = Asset::factory()->create(['unit_id' => $unit->id]);
    $report = AssetReport::factory()->create($attrs + ['asset_id' => $asset->id, 'unit_id' => $unit->id, 'created_by' => $creator->id]);
    $t->service->submit($report, 'lapor_rusak_hilang', $creator);

    return $report->fresh();
}

it('seeds the lapor_rusak_hilang workflow with one atasan_unit step', function () {
    $definition = WorkflowDefinition::where('code', 'lapor_rusak_hilang')->firstOrFail();

    expect($definition->steps)->toHaveCount(1)
        ->and($definition->steps[0]->approver_type->value)->toBe('atasan_unit')
        ->and($definition->steps[0]->label)->toBe('Persetujuan Atasan Unit')
        ->and(config('workflow.capabilities.lapor_rusak_hilang'))->toBe('subject');
});

it('applies a rusak report: updates kondisi, logs history with the approver and marks approved', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_berat', 'kronologi' => 'Terbakar sebagian.']);

    $this->actingAs($this->camat); // the history records auth()->id(), as it is during a real HTTP approval
    $this->service->approve($report->approvalRequest, $this->camat);

    $history = $report->asset->fresh()->histories()->first();
    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status)->toBe(AssetReportStatus::Approved)
        ->and($history->event)->toBe('laporan_rusak')
        ->and($history->keterangan)->toBe('Terbakar sebagian.')
        ->and($history->user_id)->toBe($this->camat->id)
        ->and($history->kondisi)->toBe(Kondisi::RusakBerat);
});

it('applies a hilang report', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['jenis' => 'hilang', 'kondisi_baru' => 'hilang']);

    $this->service->approve($report->approvalRequest, $this->camat);

    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::Hilang)
        ->and($report->asset->fresh()->histories()->first()->event)->toBe('laporan_hilang');
});

it('routes to the camat for a kecamatan asset and to the lurah for a kelurahan asset', function () {
    $kecReport = submitReport($this, $this->kec, $this->adminKec);
    $kelReport = submitReport($this, $this->kel, $this->adminKel);

    expect($this->service->canAct($this->camat, $kecReport->approvalRequest))->toBeTrue()
        ->and($this->service->canAct($this->lurah, $kecReport->approvalRequest))->toBeFalse()
        ->and($this->service->canAct($this->lurah, $kelReport->approvalRequest))->toBeTrue()
        ->and($this->service->canAct($this->camat, $kelReport->approvalRequest))->toBeFalse()
        ->and($this->service->canAct($this->adminKec, $kecReport->approvalRequest))->toBeFalse();
});

it('fails clearly and changes nothing when the asset got worse than the report after submission', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_ringan']);
    $report->asset->update(['kondisi' => Kondisi::RusakBerat]);

    expect(fn () => $this->service->approve($report->approvalRequest, $this->camat))->toThrow(InvalidArgumentException::class);

    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::RusakBerat)
        ->and($report->fresh()->status)->toBe(AssetReportStatus::Pending)
        ->and($report->approvalRequest->fresh()->status->value)->toBe('pending');
});

it('fails clearly when the asset was already reported lost in the meantime', function () {
    $report = submitReport($this, $this->kec, $this->adminKec, ['kondisi_baru' => 'rusak_ringan']);
    $report->asset->update(['kondisi' => Kondisi::Hilang]);

    expect(fn () => $this->service->approve($report->approvalRequest, $this->camat))->toThrow(InvalidArgumentException::class);
    expect($report->asset->fresh()->kondisi)->toBe(Kondisi::Hilang);
});

it('leaves the asset untouched on reject and cancel', function () {
    $rejected = submitReport($this, $this->kec, $this->adminKec);
    $this->service->reject($rejected->approvalRequest, $this->camat, 'Data tidak sesuai');

    $cancelled = submitReport($this, $this->kec, $this->adminKec);
    $this->service->cancel($cancelled->approvalRequest, $this->adminKec, 'Salah input');

    expect($rejected->fresh()->status)->toBe(AssetReportStatus::Rejected)
        ->and($cancelled->fresh()->status)->toBe(AssetReportStatus::Cancelled)
        ->and($rejected->asset->fresh()->kondisi)->toBe(Kondisi::Baik)
        ->and($cancelled->asset->fresh()->kondisi)->toBe(Kondisi::Baik);
});
