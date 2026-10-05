<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    Role::findOrCreate('lurah');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
});

it('lets admin kecamatan draft and submit a berita acara with multiple items', function () {
    $payload = [
        'no_berita_acara' => 'BA/010/IX/2025',
        'tanggal_penerimaan' => '2025-09-10',
        'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/010',
        'vendor' => 'PT Contoh',
        'status' => 'submitted',
        'items' => [
            [
                'nama_aset' => 'AC Split', 'merk_type' => 'Daikin', 'category_id' => $this->category->id,
                'jumlah_unit' => 2, 'nilai_per_unit' => 5000000, 'kondisi_awal' => 'baik',
            ],
        ],
    ];

    $response = $this->actingAs($this->admin)->post('/penerimaan-aset', $payload);

    $ba = BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/010/IX/2025')->firstOrFail();
    $response->assertRedirect(route('penerimaan-aset.show', $ba));
    expect($ba->status->value)->toBe('submitted')
        ->and($ba->approvalRequest)->not->toBeNull()
        ->and($ba->approvalRequest->current_step)->toBe(1);
});

it('does not create an approval request for a draft', function () {
    $payload = [
        'no_berita_acara' => 'BA/011/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/011', 'status' => 'draft',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $this->category->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->post('/penerimaan-aset', $payload);

    $ba = BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/011/IX/2025')->firstOrFail();
    expect($ba->approvalRequest)->toBeNull();
});

it('forbids a non admin_kecamatan role from creating a berita acara', function () {
    $lurah = userWithRole('lurah', makeKelurahan($this->kec, 'Kelurahan A'));

    $this->actingAs($lurah)->get('/penerimaan-aset/create')->assertForbidden();
});

it('fails fast at submit time when an item uses a category with no BMD code', function () {
    $noCode = AssetCategory::factory()->subcategory()->create(['code' => null]);

    $payload = [
        'no_berita_acara' => 'BA/012/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/012', 'status' => 'submitted',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $noCode->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->from('/penerimaan-aset/create')
        ->post('/penerimaan-aset', $payload)
        ->assertSessionHasErrors('items.0.category_id');

    expect(BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/012/IX/2025')->exists())->toBeFalse();
});

it('allows saving a draft with a category that has no BMD code yet', function () {
    $noCode = AssetCategory::factory()->subcategory()->create(['code' => null]);

    $payload = [
        'no_berita_acara' => 'BA/013/IX/2025', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/013', 'status' => 'draft',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $noCode->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ];

    $this->actingAs($this->admin)->post('/penerimaan-aset', $payload)->assertSessionHasNoErrors();

    expect(BeritaAcaraPenerimaan::where('no_berita_acara', 'BA/013/IX/2025')->exists())->toBeTrue();
});

it('shows kasubag every submitted berita acara regardless of unit, and scopes admin_kecamatan to their own', function () {
    $otherKec = makeKecamatan('Kecamatan Lain');
    $otherAdmin = userWithRole('admin_kecamatan', $otherKec);

    $mine = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/020/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/020', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $theirs = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/021/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/021', 'unit_id' => $otherKec->id,
        'created_by' => $otherAdmin->id, 'status' => 'submitted',
    ]);

    $this->actingAs($this->admin)->get('/penerimaan-aset')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.data', fn ($data) => collect($data)->pluck('id')->all() === [$mine->id])
        );

    $this->actingAs($this->kasubag)->get('/penerimaan-aset')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.data', fn ($data) => collect($data)->pluck('id')->sort()->values()->all() === collect([$mine->id, $theirs->id])->sort()->values()->all())
        );
});

it('shows the approve/reject actions only to the eligible current-step approver', function () {
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/030/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/030', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $this->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $this->admin);

    $this->actingAs($this->kasubag)->get("/penerimaan-aset/{$ba->id}")
        ->assertInertia(fn (Assert $page) => $page->where('can.act', true));

    $camat = userWithRole('camat', $this->kec);
    $this->actingAs($camat)->get("/penerimaan-aset/{$ba->id}")
        ->assertInertia(fn (Assert $page) => $page->where('can.act', false));
});

it('passes existingAssetNames grouped by category to create and edit views', function () {
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'nama_aset' => 'Lap Top',
    ]);

    $this->actingAs($this->admin)
        ->get(route('penerimaan-aset.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Penerimaan/Create')
            ->where('existingAssetNames', fn ($names) => in_array('Lap Top', $names[$this->category->id] ?? []))
        );
});

