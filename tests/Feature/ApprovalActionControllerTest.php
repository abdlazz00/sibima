<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);

    $this->ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/050/IX/2025', 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/050', 'unit_id' => $this->kec->id,
        'created_by' => $this->admin->id, 'status' => 'submitted',
    ]);
    $this->ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $this->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
    ]);
    $this->request = app(ApprovalWorkflowService::class)->submit($this->ba, 'penerimaan_aset', $this->admin);
});

it('lets the eligible kasubag approve step 1 via HTTP', function () {
    $this->actingAs($this->kasubag)
        ->post("/approval-requests/{$this->request->id}/approve")
        ->assertRedirect();

    expect($this->request->fresh()->current_step)->toBe(2);
});

it('forbids camat from approving before kasubag has verified', function () {
    $this->actingAs($this->camat)
        ->post("/approval-requests/{$this->request->id}/approve")
        ->assertForbidden();
});

it('requires a note to reject', function () {
    $this->actingAs($this->kasubag)
        ->from("/penerimaan-aset/{$this->ba->id}")
        ->post("/approval-requests/{$this->request->id}/reject", [])
        ->assertSessionHasErrors('note');
});

it('rejects with a note via HTTP', function () {
    $this->actingAs($this->kasubag)
        ->post("/approval-requests/{$this->request->id}/reject", ['note' => 'Dokumen tidak lengkap'])
        ->assertRedirect();

    expect($this->request->fresh()->status->value)->toBe('rejected');
});

it('shows a clear flash error instead of a 500 when the category loses its BMD code before final approval', function () {
    $this->actingAs($this->kasubag)
        ->post("/approval-requests/{$this->request->id}/approve");

    $this->category->update(['code' => null]);

    $this->actingAs($this->camat)
        ->post("/approval-requests/{$this->request->id}/approve")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($this->request->fresh()->status->value)->toBe('pending');
});
