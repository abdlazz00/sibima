<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->admin = userWithRole('admin_kecamatan', $this->kec);
    $this->kasubag = userWithRole('kasubag');
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $this->workflow = app(ApprovalWorkflowService::class);
});

function baPayload(object $t, array $override = []): array
{
    return array_merge([
        'no_berita_acara' => 'BA/L/001', 'tanggal_penerimaan' => '2025-09-10',
        'no_kontrak_spk' => 'SPK/L', 'status' => 'draft',
        'items' => [[
            'nama_aset' => 'Printer', 'category_id' => $t->category->id,
            'jumlah_unit' => 1, 'nilai_per_unit' => 2000000, 'kondisi_awal' => 'baik',
        ]],
    ], $override);
}

function makeBa(object $t, string $no, string $status = 'draft', ?string $tanggal = null): BeritaAcaraPenerimaan
{
    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => $no, 'tanggal_penerimaan' => $tanggal ?? '2025-09-01',
        'no_kontrak_spk' => 'SPK', 'unit_id' => $t->kec->id,
        'created_by' => $t->admin->id, 'status' => $status,
    ]);
    $ba->items()->create([
        'nama_aset' => 'Item '.$no, 'category_id' => $t->category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);
    if ($status === 'submitted') {
        $t->workflow->submit($ba, 'penerimaan_aset', $t->admin);
    }

    return $ba->fresh();
}

it('opens a draft for editing and keeps its data', function () {
    $ba = makeBa($this, 'BA/L/010');

    $this->actingAs($this->admin)->get(route('penerimaan-aset.edit', $ba))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('Penerimaan/Edit')->where('beritaAcara.id', $ba->id)->has('beritaAcara.items', 1));
});

it('updates a draft in place, replacing items and keeping its own BA number', function () {
    $ba = makeBa($this, 'BA/L/011');

    $payload = baPayload($this, ['no_berita_acara' => 'BA/L/011', 'vendor' => 'PT Baru', 'items' => [
        ['nama_aset' => 'Laptop', 'category_id' => $this->category->id, 'jumlah_unit' => 3, 'nilai_per_unit' => 9000000, 'kondisi_awal' => 'baik'],
    ]]);
    $this->actingAs($this->admin)->put(route('penerimaan-aset.update', $ba), $payload)
        ->assertRedirect(route('penerimaan-aset.show', $ba));

    $ba->refresh();
    expect($ba->vendor)->toBe('PT Baru')->and($ba->status->value)->toBe('draft')
        ->and($ba->items)->toHaveCount(1)->and($ba->items->first()->nama_aset)->toBe('Laptop')
        ->and($ba->approvalRequest)->toBeNull();
});

it('submits a draft through update and starts the approval flow', function () {
    $ba = makeBa($this, 'BA/L/012');

    $this->actingAs($this->admin)->put(route('penerimaan-aset.update', $ba), baPayload($this, ['no_berita_acara' => 'BA/L/012', 'status' => 'submitted']))
        ->assertRedirect();

    $ba->refresh();
    expect($ba->status->value)->toBe('submitted')
        ->and($ba->approvalRequest->current_step)->toBe(1)
        ->and($this->kasubag->fresh()->notifications)->toHaveCount(1);
});

it('refuses to update a draft that would use a category without a BMD code when submitting', function () {
    $noCode = AssetCategory::factory()->subcategory()->create(['code' => null]);
    $ba = makeBa($this, 'BA/L/013');

    $payload = baPayload($this, ['no_berita_acara' => 'BA/L/013', 'status' => 'submitted']);
    $payload['items'][0]['category_id'] = $noCode->id;
    $this->actingAs($this->admin)->put(route('penerimaan-aset.update', $ba), $payload)
        ->assertSessionHasErrors('items.0.category_id');

    expect($ba->fresh()->status->value)->toBe('draft');
});

it('refuses editing, updating or deleting a berita acara that is already submitted or belongs to someone else', function () {
    $submitted = makeBa($this, 'BA/L/014', 'submitted');
    $draft = makeBa($this, 'BA/L/015');
    $otherAdmin = userWithRole('admin_kecamatan', makeKecamatan('Kecamatan Lain'));

    $this->actingAs($this->admin)->get(route('penerimaan-aset.edit', $submitted))->assertForbidden();
    $this->actingAs($this->admin)->put(route('penerimaan-aset.update', $submitted), baPayload($this, ['no_berita_acara' => 'BA/L/014']))->assertForbidden();
    $this->actingAs($this->admin)->delete(route('penerimaan-aset.destroy', $submitted))->assertForbidden();
    $this->actingAs($otherAdmin)->get(route('penerimaan-aset.edit', $draft))->assertForbidden();
    $this->actingAs($otherAdmin)->delete(route('penerimaan-aset.destroy', $draft))->assertForbidden();
});

it('deletes a draft together with its items and documents', function () {
    Storage::fake('public');
    $ba = makeBa($this, 'BA/L/016');
    $ba->photos()->create(['path' => 'berita-acara/x/doc.pdf']);

    $this->actingAs($this->admin)->delete(route('penerimaan-aset.destroy', $ba))
        ->assertRedirect(route('penerimaan-aset.index'));

    expect(BeritaAcaraPenerimaan::find($ba->id))->toBeNull()
        ->and($ba->items()->count())->toBe(0);
});

it('removes selected existing documents when a draft is updated', function () {
    Storage::fake('public');
    $ba = makeBa($this, 'BA/L/017');
    $keep = $ba->photos()->create(['path' => 'berita-acara/x/keep.pdf']);
    $drop = $ba->photos()->create(['path' => 'berita-acara/x/drop.pdf']);

    $this->actingAs($this->admin)->put(route('penerimaan-aset.update', $ba), baPayload($this, ['no_berita_acara' => 'BA/L/017', 'hapus_dokumen' => [$drop->id]]))
        ->assertRedirect();

    expect($ba->photos()->pluck('id')->all())->toBe([$keep->id]);
});

it('hides drafts from kasubag and camat everywhere but keeps them visible to the unit admin', function () {
    $draft = makeBa($this, 'BA/L/020');
    $submitted = makeBa($this, 'BA/L/021', 'submitted');

    foreach ([$this->kasubag, $this->camat] as $approver) {
        $this->actingAs($approver)->get('/penerimaan-aset')
            ->assertInertia(fn (Assert $p) => $p->where('items.data', fn ($d) => collect($d)->pluck('id')->all() === [$submitted->id]));
        $this->actingAs($approver)->get(route('penerimaan-aset.show', $draft))->assertForbidden();
        $this->actingAs($approver)->get(route('penerimaan-aset.show', $submitted))->assertOk();
    }

    $this->actingAs($this->admin)->get('/penerimaan-aset')
        ->assertInertia(fn (Assert $p) => $p->where('items.data', fn ($d) => collect($d)->pluck('id')->sort()->values()->all() === collect([$draft->id, $submitted->id])->sort()->values()->all()));
    $this->actingAs($this->admin)->get(route('penerimaan-aset.show', $draft))->assertOk();
});

it('filters the index by status', function () {
    $draft = makeBa($this, 'BA/F/1');
    $diajukan = makeBa($this, 'BA/F/2', 'submitted');
    $diverifikasi = makeBa($this, 'BA/F/3', 'submitted');
    $this->workflow->approve($diverifikasi->approvalRequest, $this->kasubag);
    $ditolak = makeBa($this, 'BA/F/4', 'submitted');
    $this->workflow->reject($ditolak->approvalRequest, $this->kasubag, 'x');
    $dibatalkan = makeBa($this, 'BA/F/5', 'submitted');
    $this->workflow->cancel($dibatalkan->approvalRequest, $this->admin, 'x');
    $disetujui = makeBa($this, 'BA/F/6', 'submitted');
    $this->workflow->approve($disetujui->approvalRequest, $this->kasubag);
    $this->workflow->approve($disetujui->approvalRequest->fresh(), $this->camat);

    $ids = fn (string $status) => function (Assert $p) use ($status) {
        return $p;
    };

    $expect = ['draft' => $draft, 'diajukan' => $diajukan, 'diverifikasi' => $diverifikasi, 'ditolak' => $ditolak, 'dibatalkan' => $dibatalkan, 'disetujui' => $disetujui];
    foreach ($expect as $status => $ba) {
        $this->actingAs($this->admin)->get('/penerimaan-aset?status='.$status)
            ->assertInertia(fn (Assert $p) => $p->where('items.data', fn ($d) => collect($d)->pluck('id')->all() === [$ba->id])->where('filters.status', $status));
    }
});

it('filters the index by period', function () {
    $early = makeBa($this, 'BA/P/1', 'draft', '2025-01-15');
    $mid = makeBa($this, 'BA/P/2', 'draft', '2025-06-15');
    $late = makeBa($this, 'BA/P/3', 'draft', '2025-12-15');

    $this->actingAs($this->admin)->get('/penerimaan-aset?dari=2025-05-01&sampai=2025-07-31')
        ->assertInertia(fn (Assert $p) => $p->where('items.data', fn ($d) => collect($d)->pluck('id')->all() === [$mid->id]));
    $this->actingAs($this->admin)->get('/penerimaan-aset?dari=2025-06-01')
        ->assertInertia(fn (Assert $p) => $p->where('items.data', fn ($d) => collect($d)->pluck('id')->sort()->values()->all() === collect([$mid->id, $late->id])->sort()->values()->all()));
});

it('shares the real pending-approval count, independent of notifications being read', function () {
    makeBa($this, 'BA/N/1', 'submitted');
    makeBa($this, 'BA/N/2', 'submitted');

    $this->actingAs($this->kasubag)->get('/dashboard')->assertInertia(fn (Assert $p) => $p->where('pending_approvals', 2));
    $this->kasubag->unreadNotifications->each->markAsRead();
    $this->actingAs($this->kasubag)->get('/dashboard')->assertInertia(fn (Assert $p) => $p->where('pending_approvals', 2));
    $this->actingAs($this->admin)->get('/dashboard')->assertInertia(fn (Assert $p) => $p->where('pending_approvals', 0));
});

it('opens the related page when a notification is clicked', function () {
    $ba = makeBa($this, 'BA/N/3', 'submitted');
    $notification = $this->kasubag->fresh()->notifications->first();

    expect($notification->data['url'])->toBe(route('penerimaan-aset.show', $ba));

    $this->actingAs($this->kasubag)->post(route('notifications.read', $notification->id))
        ->assertRedirect(route('penerimaan-aset.show', $ba));
    expect($this->kasubag->fresh()->unreadNotifications)->toHaveCount(0);
});

it('refuses the wrong actor at each step over HTTP', function () {
    $ba = makeBa($this, 'BA/A/1', 'submitted');
    $url = route('approval-requests.approve', $ba->approvalRequest);
    $otherCamat = userWithRole('camat', makeKecamatan('Kecamatan Lain'));

    $this->actingAs($this->admin)->post($url)->assertForbidden();
    $this->actingAs($this->camat)->post($url)->assertForbidden();

    $this->actingAs($this->kasubag)->post($url)->assertRedirect();
    $this->actingAs($this->kasubag)->post($url)->assertForbidden();
    $this->actingAs($otherCamat)->post($url)->assertForbidden();
    $this->actingAs($this->admin)->post($url)->assertForbidden();
});
