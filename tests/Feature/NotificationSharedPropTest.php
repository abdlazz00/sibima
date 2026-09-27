<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

function submitSampleBeritaAcara(string $noBa): array
{
    Role::findOrCreate('kasubag');
    Role::findOrCreate('camat');
    Role::findOrCreate('admin_kecamatan');
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $admin = userWithRole('admin_kecamatan', $kec);
    $kasubag = userWithRole('kasubag');
    $category = AssetCategory::factory()->create(['code' => '1.3.2.05.02.04']);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $noBa,
        'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/'.$noBa,
        'unit_id' => $kec->id,
        'created_by' => $admin->id,
        'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);

    app(ApprovalWorkflowService::class)->submit($ba, 'penerimaan_aset', $admin);

    return compact('kasubag', 'admin', 'ba');
}

it('shares unread notification count and latest items on every page', function () {
    ['kasubag' => $kasubag] = submitSampleBeritaAcara('BA/001/IX/2025');

    $this->actingAs($kasubag)->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unread_count', 1)
            ->where('notifications.items.0.message', fn (string $m) => str_contains($m, 'Penerimaan Aset'))
        );
});

it('marks a notification as read', function () {
    ['kasubag' => $kasubag] = submitSampleBeritaAcara('BA/002/IX/2025');
    $notification = $kasubag->unreadNotifications()->firstOrFail();

    $this->actingAs($kasubag)->post("/notifications/{$notification->id}/read")->assertRedirect();

    expect($kasubag->unreadNotifications()->count())->toBe(0);
});
