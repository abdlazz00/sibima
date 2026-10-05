<?php

use App\Models\ApprovalAction;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\AssetMutationItem;
use App\Models\Pegawai;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function lmMutation(object $t, string $no, string $jenis, $origin, $dest, string $date, string $status, array $assets = []): AssetMutation
{
    $m = AssetMutation::create([
        'nomor_mutasi' => $no, 'jenis_mutasi' => $jenis, 'origin_unit_id' => $origin->id, 'destination_unit_id' => $dest->id,
        'tanggal_mutasi' => $date, 'status' => $status, 'created_by' => $t->camat->id, 'keterangan' => "Ket {$no}",
    ]);

    foreach ($assets as $asset) {
        AssetMutationItem::create(['asset_mutation_id' => $m->id, 'asset_id' => $asset->id, 'catatan' => "Cat {$no}"]);
    }

    return $m;
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

    $this->holder = Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'nama' => 'Budi Santoso']);
    $this->a1 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 1000, 'nama_aset' => 'Meja A']);
    $this->a2 = Asset::factory()->create(['unit_id' => $this->kec->id, 'nilai_perolehan' => 2000]);
    $this->a3 = Asset::factory()->create(['unit_id' => $this->kelA->id, 'nilai_perolehan' => 500]);

    $this->m1 = lmMutation($this, 'M-1', 'kec_ke_kel', $this->kec, $this->kelA, '2026-08-10', 'approved', [$this->a1, $this->a2]);
    AssetMutationItem::where('asset_mutation_id', $this->m1->id)->where('asset_id', $this->a1->id)->update(['target_holder_id' => $this->holder->id]);
    app(ApprovalWorkflowService::class)->submit($this->m1, 'mutasi_kec_ke_kel', $this->camat);
    $request = $this->m1->approvalRequest()->first();
    ApprovalAction::create(['approval_request_id' => $request->id, 'step_order' => 1, 'user_id' => $this->camat->id, 'action' => 'approve', 'note' => 'Setuju']);

    $this->m2 = lmMutation($this, 'M-2', 'kec_ke_kel', $this->kec, $this->kelB, '2026-10-05', 'approved', [$this->a2]);
    $this->m3 = lmMutation($this, 'M-3', 'antar_kel', $this->kelA, $this->kelB, '2026-10-07', 'pending', [$this->a3]);
    $this->m4 = lmMutation($this, 'M-4', 'internal', $this->kelB, $this->kelB, '2026-10-09', 'rejected', [$this->a3]);
    $this->m5 = lmMutation($this, 'M-5', 'internal', $this->otherKec, $this->otherKec, '2026-09-01', 'approved', [$this->a3]);
});

it('renders the page with recap, list rows and option lists for the camat', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('LaporanMutasi/Index')
            ->where('ringkasan.jumlah_mutasi', 4)
            ->where('mutasis.total', 4)
            ->has('status', 4)
            ->has('jenis', 5)
            ->has('tren')
            ->where('arus.total.jumlah_mutasi', 2)
            ->where('jumlah_masih_berjalan', 1)
            ->has('masih_berjalan', 1)
            ->has('jenisOptions', 5)
            ->has('statusOptions', 4)
            ->where('sort', ['urut' => 'tanggal_mutasi', 'arah' => 'desc']));
});

it('gives a list row its columns, the asset list and the approval history', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=nomor_mutasi&arah=asc')
        ->assertInertia(fn (Assert $p) => $p
            ->where('mutasis.data.0', fn ($row) => $row['nomor_mutasi'] === 'M-1'
                && $row['jenis'] === 'kec_ke_kel'
                && $row['jenis_label'] === 'Mutasi Kecamatan ke Kelurahan'
                && $row['asal'] === $this->kec->name
                && $row['tujuan'] === 'Kelurahan A'
                && $row['jumlah_aset'] === 2
                && $row['nilai'] == 3000
                && $row['status'] === 'approved'
                && $row['detail']['keterangan'] === 'Ket M-1'
                && count($row['detail']['aset']) === 2
                && collect($row['detail']['aset'])->contains(fn ($a) => $a['nama_aset'] === 'Meja A'
                    && $a['pemegang_tujuan'] === 'Budi Santoso' && $a['catatan'] === 'Cat M-1' && $a['nilai_perolehan'] == 1000)
                && count($row['detail']['persetujuan']) === 1
                && $row['detail']['persetujuan'][0]['aksi'] === 'approve'
                && $row['detail']['persetujuan'][0]['catatan'] === 'Setuju'));
});

it('limits a kelurahan admin to mutations touching the own unit and lists the counterpart units as options', function () {
    $this->actingAs($this->adminA)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p
            ->where('mutasis.total', 2)
            ->where('ringkasan.jumlah_mutasi', 2)
            ->where('unitOptions', fn ($units) => collect($units)->pluck('name')->sort()->values()->all() === collect([$this->kec->name, 'Kelurahan A', 'Kelurahan B'])->sort()->values()->all()));
});

it('lets the asal and tujuan filters only narrow, never widen', function () {
    $this->actingAs($this->adminA)->get('/laporan-mutasi?asal_id='.$this->kelB->id)
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 0)->where('ringkasan.jumlah_mutasi', 0));

    $this->actingAs($this->camat)->get('/laporan-mutasi?asal_id='.$this->kec->id.'&tujuan_id='.$this->kelB->id)
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 1)->where('mutasis.data.0.nomor_mutasi', 'M-2'));
});

it('paginates 25 rows per page', function () {
    foreach (range(1, 28) as $i) {
        lmMutation($this, "P-{$i}", 'internal', $this->kelA, $this->kelA, '2026-10-10', 'pending');
    }

    $this->actingAs($this->adminA)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 30)->has('mutasis.data', 25)->where('mutasis.last_page', 2));
    $this->actingAs($this->adminA)->get('/laporan-mutasi?page=2')
        ->assertInertia(fn (Assert $p) => $p->has('mutasis.data', 5));
});

it('sorts by a whitelisted column and refuses anything else', function () {
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=jumlah_aset&arah=desc')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.data.0.nomor_mutasi', 'M-1')->where('sort', ['urut' => 'jumlah_aset', 'arah' => 'desc']));
    $this->actingAs($this->camat)->get('/laporan-mutasi?urut=nilai&arah=asc')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.data.3.nomor_mutasi', 'M-1'));

    $this->actingAs($this->camat)->getJson('/laporan-mutasi?urut=password')->assertUnprocessable()->assertJsonValidationErrors('urut');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?urut=nilai;drop table assets')->assertUnprocessable();
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?arah=sideways')->assertUnprocessable()->assertJsonValidationErrors('arah');
});

it('validates the filters', function () {
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?dari=2026-10-05&sampai=2026-10-01')->assertUnprocessable()->assertJsonValidationErrors('sampai');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?jenis_mutasi=bogus')->assertUnprocessable()->assertJsonValidationErrors('jenis_mutasi');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?status=bogus')->assertUnprocessable()->assertJsonValidationErrors('status');
    $this->actingAs($this->camat)->getJson('/laporan-mutasi?asal_id=999999')->assertUnprocessable()->assertJsonValidationErrors('asal_id');
});

it('keeps the page total equal to the summary and handles an empty result', function () {
    $this->actingAs($this->kasubag)->get('/laporan-mutasi')
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 5)->where('ringkasan.jumlah_mutasi', 5));

    $this->actingAs($this->camat)->get('/laporan-mutasi?status=cancelled')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->where('mutasis.total', 0)->where('ringkasan.jumlah_mutasi', 0)->where('tren', []));
});

it('downloads the workbook and refuses an empty download', function () {
    $response = $this->actingAs($this->adminA)->get('/laporan-mutasi/unduh');

    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('laporan-mutasi-'.now()->format('Y-m-d').'.xlsx');

    $this->actingAs($this->adminA)->getJson('/laporan-mutasi/unduh?status=cancelled')->assertUnprocessable();
    $this->actingAs($this->adminA)->getJson('/laporan-mutasi/unduh?jenis_mutasi=bogus')->assertUnprocessable();
});

it('sends a guest to login', function () {
    $this->get('/laporan-mutasi')->assertRedirect('/login');
    $this->get('/laporan-mutasi/unduh')->assertRedirect('/login');
});
