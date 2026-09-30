<?php

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetMutation;
use Database\Seeders\WorkflowDefinitionSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['admin_kecamatan', 'admin_kelurahan', 'camat', 'kasubag', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan A');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->lost = Asset::factory()->create(['unit_id' => $this->kec->id, 'kondisi' => Kondisi::Hilang]);
    $this->ok = Asset::factory()->create(['unit_id' => $this->kec->id]);
});

it('refuses a lost asset in a mutation even via a crafted POST', function () {
    $this->actingAs($this->adminKec)->from('/asset-mutations/create')->post(route('asset-mutations.store'), [
        'nomor_mutasi' => 'M/HILANG/1', 'jenis_mutasi' => 'kec_ke_kel',
        'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kel->id,
        'tanggal_mutasi' => '2026-10-01', 'items' => [['asset_id' => $this->lost->id]],
    ])->assertRedirect('/asset-mutations/create')->assertSessionHas('error');

    expect(AssetMutation::count())->toBe(0)
        ->and($this->lost->fresh()->status)->toBe(AssetStatus::Aktif);
});

it('does not offer lost assets on the mutation form', function () {
    $this->actingAs($this->adminKec)->get(route('asset-mutations.create'))
        ->assertInertia(fn (Assert $p) => $p->where('assets', fn ($a) => collect($a)->pluck('id')->all() === [$this->ok->id]));
});

it('does not move an asset that was reported lost while its mutation was already pending', function () {
    $camat = userWithRole('camat', $this->kec);
    $pegawai = App\Models\Pegawai::factory()->create(['unit_id' => $this->kec->id]);

    $this->actingAs($this->adminKec)->post(route('asset-mutations.store'), [
        'nomor_mutasi' => 'M/PENDING/1', 'jenis_mutasi' => 'internal',
        'origin_unit_id' => $this->kec->id, 'destination_unit_id' => $this->kec->id,
        'tanggal_mutasi' => '2026-10-01', 'items' => [['asset_id' => $this->ok->id, 'target_holder_id' => $pegawai->id]],
    ])->assertRedirect();
    $mutation = AssetMutation::where('nomor_mutasi', 'M/PENDING/1')->firstOrFail();

    $this->ok->update(['kondisi' => Kondisi::Hilang]);

    $this->actingAs($camat)->post(route('approval-requests.approve', $mutation->approvalRequest))
        ->assertRedirect()->assertSessionHas('error');

    expect($this->ok->fresh()->current_holder_id)->toBeNull()
        ->and($mutation->fresh()->status->value)->toBe('pending');
});
