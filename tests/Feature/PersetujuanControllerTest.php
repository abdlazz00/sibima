<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

it('lists only requests the current user can act on right now', function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $admin = userWithRole('admin_kecamatan', $kec);
    $kasubag = userWithRole('kasubag');
    $camat = userWithRole('camat', $kec);
    $category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/060/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/060', 'unit_id' => $kec->id,
        'created_by' => $admin->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $admin);

    $this->actingAs($kasubag)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page
            ->has('items', 1)
            ->where('items.0.title', 'Penerimaan Aset #BA/060/IX/2025')
        );

    $this->actingAs($camat)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page->has('items', 0));
});
