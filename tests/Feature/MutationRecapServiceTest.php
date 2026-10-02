<?php

use App\Models\ApprovalAction;
use App\Models\ApprovalRequestStep;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use App\Services\MutationRecapService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Role;

function mrWorkflow(string $jenis): string
{
    return ['kec_ke_kel' => 'mutasi_kec_ke_kel', 'antar_kel' => 'mutasi_antar_kel', 'internal' => 'mutasi_internal_kel'][$jenis];
}

/** @param  list<Asset>  $assets */
function mrMutation(object $t, string $no, string $jenis, $origin, $dest, string $date, string $status, array $assets, ?string $diajukan = null): AssetMutation
{
    $m = AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $jenis, 'origin_unit_id' => $origin->id,
        'destination_unit_id' => $dest->id, 'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $t->camat->id,
    ]);

    foreach ($assets as $asset) {
        AssetMutationItem::create(['asset_mutation_id' => $m->id, 'asset_id' => $asset->id]);
    }

    if ($diajukan !== null) {
        app(ApprovalWorkflowService::class)->submit($m, mrWorkflow($jenis), $t->camat);
        $m->approvalRequest()->first()->forceFill(['created_at' => $diajukan])->save();
        $m->forceFill(['created_at' => $diajukan])->save();
    }

    return $m;
}

function mrApprove(AssetMutation $m, int $step, string $at): void
{
    $request = $m->approvalRequest()->first();
    $action = ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => $step, 'user_id' => $m->created_by, 'action' => 'approve']);
    $action->forceFill(['created_at' => $at])->save();
}

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->otherKec = makeKecamatan('Kecamatan Lain');
    $this->camat = userWithRole('camat', $this->kec);
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->kasubag = userWithRole('kasubag');

    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 1000]);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 3000]);
    $this->a4 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'nilai_perolehan' => 500]);
    $this->a5 = Asset::factory()->create(['unit_id' => $this->otherKec->id, 'nilai_perolehan' => 4000]);

    $this->m1 = mrMutation($this, 'M-1', 'kec_ke_kel', $this->kec, $this->kelA, '2026-08-10', 'approved', [$this->a1, $this->a2], '2026-08-10 09:00:00');
    mrApprove($this->m1, 1, '2026-08-12 09:00:00');

    $this->m2 = mrMutation($this, 'M-2', 'kec_ke_kel', $this->kec, $this->kelB, '2026-10-05', 'approved', [$this->a3], '2026-10-05 08:00:00');
    mrApprove($this->m2, 1, '2026-10-05 20:00:00');
    mrApprove($this->m2, 2, '2026-10-08 08:00:00');

    $this->m3 = mrMutation($this, 'M-3', 'antar_kel', $this->kelA, $this->kelB, '2026-10-07', 'pending', [$this->a4], '2026-10-07 10:00:00');
    $this->m4 = mrMutation($this, 'M-4', 'internal', $this->kelB, $this->kelB, '2026-10-09', 'rejected', [$this->a4]);
    $this->m5 = mrMutation($this, 'M-5', 'internal', $this->otherKec, $this->otherKec, '2026-09-01', 'approved', [$this->a5]);

    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));
    $this->service = app(MutationRecapService::class);
});

it('summarises the camat scope, counting movement only from approved mutations', function () {
    $r = $this->service->for($this->camat, [])['ringkasan'];

    expect($r)->toBe([
        'jumlah_mutasi' => 4, 'disetujui' => 2, 'aset_berpindah' => 3, 'nilai_perolehan' => 6000.0,
        'rata_lama_proses' => 2.5, 'terlama_proses' => 3.0,
    ]);
});

it('limits a kelurahan admin to mutations touching the own unit on either side', function () {
    $r = $this->service->for($this->adminA, []);

    expect($r['ringkasan']['jumlah_mutasi'])->toBe(2)
        ->and($r['ringkasan']['disetujui'])->toBe(1)
        ->and($r['ringkasan']['aset_berpindah'])->toBe(2)
        ->and($r['ringkasan']['nilai_perolehan'])->toBe(3000.0)
        ->and($this->service->for($this->kasubag, [])['ringkasan']['jumlah_mutasi'])->toBe(5);
});

it('composes by status and by type in enum order with percentages', function () {
    $recap = $this->service->for($this->camat, []);

    expect(collect($recap['status'])->pluck('status')->all())->toBe(['pending', 'approved', 'rejected', 'cancelled'])
        ->and(collect($recap['status'])->pluck('jumlah')->all())->toBe([1, 2, 1, 0])
        ->and(collect($recap['status'])->pluck('persen')->all())->toBe([25.0, 50.0, 25.0, 0.0])
        ->and($recap['status'][1]['label'])->toBe('Disetujui')
        ->and(collect($recap['jenis'])->pluck('jenis')->all())->toBe(['kec_ke_kel', 'antar_kel', 'retur_kel_ke_kec', 'internal'])
        ->and(collect($recap['jenis'])->pluck('jumlah')->all())->toBe([2, 1, 0, 1])
        ->and(collect($recap['jenis'])->pluck('persen')->all())->toBe([50.0, 25.0, 0.0, 25.0]);
});

it('builds the monthly trend from approved mutations with zero-filled gaps', function () {
    expect($this->service->for($this->camat, [])['tren'])->toBe([
        ['bulan' => '2026-08', 'jumlah_mutasi' => 1, 'aset_berpindah' => 2],
        ['bulan' => '2026-09', 'jumlah_mutasi' => 0, 'aset_berpindah' => 0],
        ['bulan' => '2026-10', 'jumlah_mutasi' => 1, 'aset_berpindah' => 1],
    ]);
});

it('does not zero-fill an absurd month span caused by a mistyped date', function () {
    mrMutation($this, 'M-OLD', 'internal', $this->kelA, $this->kelA, '0202-05-05', 'approved', [$this->a4]);

    $tren = $this->service->for($this->camat, [])['tren'];

    expect(collect($tren)->pluck('bulan')->all())->toBe(['0202-05', '2026-08', '2026-10'])
        ->and(collect($tren)->sum('jumlah_mutasi'))->toBe(3);
});

it('builds the flow between units from approved mutations sorted by assets', function () {
    $arus = $this->service->for($this->camat, [])['arus'];

    expect($arus['baris'])->toBe([
        ['asal_id' => $this->kec->id, 'asal' => $this->kec->name, 'tujuan_id' => $this->kelA->id, 'tujuan' => 'Kelurahan A', 'jumlah_mutasi' => 1, 'aset' => 2, 'nilai' => 3000.0],
        ['asal_id' => $this->kec->id, 'asal' => $this->kec->name, 'tujuan_id' => $this->kelB->id, 'tujuan' => 'Kelurahan B', 'jumlah_mutasi' => 1, 'aset' => 1, 'nilai' => 3000.0],
    ])->and($arus['total'])->toBe(['jumlah_mutasi' => 2, 'aset' => 3, 'nilai' => 6000.0]);
});

it('applies the asal, tujuan, jenis, status and date filters', function () {
    $count = fn (array $f) => $this->service->for($this->camat, $f)['ringkasan']['jumlah_mutasi'];

    expect($count(['asal_id' => $this->kec->id]))->toBe(2)
        ->and($count(['tujuan_id' => $this->kelB->id]))->toBe(3)
        ->and($count(['jenis_mutasi' => 'internal']))->toBe(1)
        ->and($count(['status' => 'pending']))->toBe(1)
        ->and($count(['dari' => '2026-10-01', 'sampai' => '2026-10-06']))->toBe(1)
        ->and($count(['dari' => '2026-10-05', 'sampai' => '2026-10-05']))->toBe(1);
});

it('reports zero movement without errors when the status filter excludes approved mutations', function () {
    $recap = $this->service->for($this->camat, ['status' => 'pending']);

    expect($recap['ringkasan'])->toBe([
        'jumlah_mutasi' => 1, 'disetujui' => 0, 'aset_berpindah' => 0, 'nilai_perolehan' => 0.0,
        'rata_lama_proses' => null, 'terlama_proses' => null,
    ])->and($recap['tren'])->toBe([])
        ->and($recap['arus'])->toBe(['baris' => [], 'total' => ['jumlah_mutasi' => 0, 'aset' => 0, 'nilai' => 0.0]]);
});

it('lists the pending mutations with step, waiting party and age', function () {
    $recap = $this->service->for($this->camat, []);

    expect($recap['jumlah_masih_berjalan'])->toBe(1)
        ->and($recap['masih_berjalan'])->toBe([[
            'id' => $this->m3->id, 'nomor' => 'M-3', 'jenis' => 'Mutasi Antar Kelurahan', 'asal' => 'Kelurahan A',
            'tujuan' => 'Kelurahan B', 'langkah' => 'Persetujuan Lurah Asal', 'menunggu' => 'Lurah', 'umur_hari' => 5,
            'url' => route('asset-mutations.show', $this->m3),
        ]]);

    $user = User::factory()->create(['name' => 'Budi Approver']);
    ApprovalRequestStep::where('approval_request_id', $this->m3->approvalRequest()->first()->id)->where('step_order', 1)
        ->update(['approver_type' => 'user', 'approver_user_id' => $user->id]);

    expect($this->service->for($this->camat, [])['masih_berjalan'][0]['menunggu'])->toBe('Budi Approver');
});

it('caps the pending list at twenty, oldest first, and tolerates a missing approval request', function () {
    foreach (range(1, 22) as $i) {
        mrMutation($this, "P-{$i}", 'internal', $this->kelA, $this->kelA, '2026-10-10', 'pending', [$this->a4]);
    }

    $recap = $this->service->for($this->camat, []);

    expect($recap['masih_berjalan'])->toHaveCount(20)
        ->and($recap['jumlah_masih_berjalan'])->toBe(23)
        ->and($recap['masih_berjalan'][0]['nomor'])->toBe('M-3')
        ->and(collect($recap['masih_berjalan'])->last()['langkah'])->toBeNull()
        ->and(collect($recap['masih_berjalan'])->last()['menunggu'])->toBeNull();
});

it('keeps every total in agreement', function () {
    foreach ([[], ['asal_id' => $this->kec->id], ['status' => 'approved']] as $filters) {
        $r = $this->service->for($this->camat, $filters);

        expect(collect($r['status'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah_mutasi'])
            ->and(collect($r['jenis'])->sum('jumlah'))->toBe($r['ringkasan']['jumlah_mutasi'])
            ->and($r['arus']['total']['aset'])->toBe($r['ringkasan']['aset_berpindah'])
            ->and(collect($r['tren'])->sum('aset_berpindah'))->toBe($r['ringkasan']['aset_berpindah'])
            ->and(collect($r['tren'])->sum('jumlah_mutasi'))->toBe($r['ringkasan']['disetujui'])
            ->and($r['arus']['total']['nilai'])->toBe($r['ringkasan']['nilai_perolehan']);
    }
});

it('returns zeros and empty lists for a user who sees nothing', function () {
    $recap = $this->service->for(User::factory()->create(), []);

    expect($recap['ringkasan']['jumlah_mutasi'])->toBe(0)
        ->and($recap['ringkasan']['rata_lama_proses'])->toBeNull()
        ->and(collect($recap['status'])->pluck('persen')->all())->toBe([0.0, 0.0, 0.0, 0.0])
        ->and($recap['tren'])->toBe([])
        ->and($recap['masih_berjalan'])->toBe([])
        ->and($recap['jumlah_masih_berjalan'])->toBe(0);
});
