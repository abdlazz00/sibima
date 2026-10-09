<?php

use App\Models\AssetMutation;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->superAdmin = userWithRole('super-admin');
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->adminKel = userWithRole('admin_kelurahan', $this->kelA);
    $this->camat = userWithRole('camat', $this->kec);
    $this->lurah = userWithRole('lurah', $this->kelA);
    $this->engine = app(ApprovalWorkflowService::class);
});

function pdHead(string $name, ?string $headOf, $unit): User
{
    $role = Role::create(['name' => $name, 'display_name' => ucfirst($name), 'unit_scope' => 'own', 'unit_head_of' => $headOf, 'is_system' => false]);
    $role->givePermissionTo('persetujuan.view', 'persetujuan.act');

    return User::factory()->create(['unit_id' => $unit->id])->assignRole($role);
}

function pdReturn(object $t, $unit, $creator)
{
    $mutation = AssetMutation::create([
        'nomor_mutasi' => 'UH/'.uniqid(), 'jenis_mutasi' => 'pengembalian', 'origin_unit_id' => $unit->id,
        'destination_unit_id' => $unit->id, 'tanggal_mutasi' => '2026-10-09', 'status' => 'pending', 'created_by' => $creator->id,
    ]);

    return $t->engine->submit($mutation, 'pengembalian_aset', $creator);
}

it('marks the bundled camat and lurah roles as unit heads', function () {
    expect(Role::findByName('camat')->unit_head_of)->toBe('kecamatan')
        ->and(Role::findByName('lurah')->unit_head_of)->toBe('kelurahan');
});

it('treats a custom role marked as head of kecamatan as the atasan unit, and an unmarked camat as not', function () {
    $sekcam = pdHead('sekcam', 'kecamatan', $this->kec);
    $request = pdReturn($this, $this->kec, $this->adminKec)->fresh();

    expect($this->engine->canAct($this->camat, $request))->toBeTrue()
        ->and($this->engine->canAct($sekcam, $request))->toBeTrue();

    Role::findByName('camat')->update(['unit_head_of' => null]);
    $this->camat = $this->camat->fresh();

    expect($this->engine->canAct($this->camat, $request))->toBeFalse()
        ->and($this->engine->canAct($sekcam, $request))->toBeTrue();
});

it('matches the head to the kind of unit and keeps it inside the unit scope', function () {
    $headKel = pdHead('kepala_kel', 'kelurahan', $this->kelB);
    $request = pdReturn($this, $this->kelA, $this->adminKel)->fresh();

    expect($this->engine->canAct($this->lurah, $request))->toBeTrue()
        ->and($this->engine->canAct($this->camat, $request))->toBeFalse()
        ->and($this->engine->canAct($headKel, $request))->toBeFalse();
});

it('notifies exactly the atasan unit of the requesting unit', function () {
    $sekcam = pdHead('sekcam', 'kecamatan', $this->kec);

    pdReturn($this, $this->kec, $this->adminKec);

    expect($this->camat->notifications()->count())->toBe(1)
        ->and($sekcam->notifications()->count())->toBe(1)
        ->and($this->lurah->notifications()->count())->toBe(0);
});

it('saves and lists unit_head_of from the role menu and rejects an unknown value', function () {
    $this->actingAs($this->superAdmin)->post(route('roles.store'), [
        'name' => 'kepala_x', 'display_name' => 'Kepala X', 'unit_scope' => 'own', 'unit_head_of' => 'kelurahan', 'permissions' => [],
    ])->assertSessionHasNoErrors();

    $role = Role::findByName('kepala_x');
    expect($role->unit_head_of)->toBe('kelurahan');

    $this->actingAs($this->superAdmin)->put(route('roles.update', $role), [
        'name' => 'kepala_x', 'display_name' => 'Kepala X', 'unit_scope' => 'own', 'unit_head_of' => 'provinsi', 'permissions' => [],
    ])->assertSessionHasErrors('unit_head_of');

    $this->actingAs($this->superAdmin)->get(route('roles.index'))
        ->assertInertia(fn ($page) => $page->where('roles', fn ($roles) => collect($roles)->firstWhere('name', 'camat')['unit_head_of'] === 'kecamatan'));
});
