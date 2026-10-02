<?php

use App\Models\ApprovalRequest;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkflowDefinition;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->wf = WorkflowDefinition::firstOrCreate(
        ['code' => 'lapor_rusak_hilang'],
        ['name' => 'Lapor Rusak/Hilang']
    );

    $this->kec = makeKecamatan();
    $this->camat = userWithRole('camat', $this->kec);
    $this->cat = AssetCategory::create(['name' => 'KOMPUTER']);
    $this->subcat = AssetCategory::create(['name' => 'PC', 'parent_id' => $this->cat->id]);

    $this->asset = Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->subcat->id,
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 7000000,
    ]);

    $this->report = AssetReport::create([
        'nomor_laporan' => 'LRH-TEST-001',
        'asset_id' => $this->asset->id,
        'unit_id' => $this->kec->id,
        'pegawai_id' => null,
        'jenis' => 'rusak',
        'kondisi_baru' => 'rusak_berat',
        'tanggal_kejadian' => '2026-10-01',
        'kronologi' => 'Motherboard terbakar',
        'status' => 'approved',
        'created_by' => $this->camat->id,
    ]);

    $ar = ApprovalRequest::create([
        'approvable_type' => (new AssetReport)->getMorphClass(),
        'approvable_id' => $this->report->id,
        'workflow_definition_id' => $this->wf->id,
        'current_step' => 1,
        'status' => 'approved',
        'created_by' => $this->camat->id,
    ]);
    $ar->actions()->create([
        'step_order' => 1,
        'user_id' => $this->camat->id,
        'action' => 'approve',
    ]);
});

it('requires authentication to access Laporan Rusak & Hilang', function () {
    $this->get(route('laporan-rusak-hilang.index'))->assertRedirect(route('login'));
    $this->get(route('laporan-rusak-hilang.download'))->assertRedirect(route('login'));
});

it('renders the index page with required props', function () {
    $this->actingAs($this->camat)
        ->get(route('laporan-rusak-hilang.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('LaporanRusakHilang/Index')
            ->has('filters')
            ->has('sort')
            ->has('ringkasan')
            ->has('status')
            ->has('kondisi')
            ->has('tren')
            ->has('reports.data')
            ->has('unitOptions')
            ->has('categoryOptions')
            ->has('kondisiOptions')
            ->has('statusOptions')
        );
});

it('validates sort column whitelist and direction', function () {
    $this->actingAs($this->camat)
        ->get(route('laporan-rusak-hilang.index', ['urut' => 'invalid_col']))
        ->assertSessionHasErrors('urut');
});

it('downloads an excel file if data exists or returns 422 when empty', function () {
    $this->actingAs($this->camat)
        ->get(route('laporan-rusak-hilang.download'))
        ->assertOk()
        ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // 0 rows with impossible date filter returns 422
    $this->actingAs($this->camat)
        ->get(route('laporan-rusak-hilang.download', ['dari' => '2099-01-01']))
        ->assertStatus(422);
});
