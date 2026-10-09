<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Pegawai;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use App\Services\AssetRequestService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    (new WorkflowDefinitionSeeder)->run();

    $this->kec = makeKecamatan();
    $this->kasubag = userWithRole('kasubag');
    $this->adminKec = userWithRole('admin_kecamatan', $this->kec);
    $this->camat = userWithRole('camat', $this->kec);
    $this->category = AssetCategory::factory()->subcategory()->create();
});

function pdDraft(object $t): BeritaAcaraPenerimaan
{
    return BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/'.uniqid(), 'tanggal_penerimaan' => '2026-10-09', 'sumber_perolehan' => 'APBD',
        'no_kontrak_spk' => 'SPK/1', 'vendor' => 'PT Contoh', 'unit_id' => $t->kec->id, 'created_by' => $t->adminKec->id, 'status' => 'draft',
    ]);
}

function pdApprovedRequest(object $t)
{
    $pegawai = Pegawai::factory()->create(['unit_id' => $t->kec->id]);
    $service = app(AssetRequestService::class);
    $request = $service->create(['jenis' => 'pegawai', 'pegawai_id' => $pegawai->id, 'category_id' => $t->category->id, 'keterangan' => 'Butuh'], $t->adminKec);
    app(ApprovalWorkflowService::class)->approve($request->approvalRequest, $t->camat);

    return $request->fresh();
}

it('deletes a draft penerimaan only with penerimaan.delete, not with penerimaan.update alone', function () {
    $draft = pdDraft($this);
    Role::findByName('admin_kecamatan')->revokePermissionTo('penerimaan.delete');

    $this->actingAs($this->adminKec->fresh())->delete(route('penerimaan-aset.destroy', $draft))->assertForbidden();
    expect(BeritaAcaraPenerimaan::whereKey($draft->id)->exists())->toBeTrue();

    Role::findByName('admin_kecamatan')->givePermissionTo('penerimaan.delete');

    $this->actingAs($this->adminKec->fresh())->delete(route('penerimaan-aset.destroy', $draft))->assertRedirect();
    expect(BeritaAcaraPenerimaan::whereKey($draft->id)->exists())->toBeFalse();
});

it('closes an approved permohonan only with permohonan.close, not with permohonan.fulfill alone', function () {
    $request = pdApprovedRequest($this);
    Role::findByName('admin_kecamatan')->revokePermissionTo('permohonan.close');

    $this->actingAs($this->adminKec->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertForbidden();

    $this->actingAs($this->adminKec->fresh())->get(route('asset-requests.show', $request))
        ->assertInertia(fn ($page) => $page->where('can.close', false)->where('can.fulfill', true));

    Role::findByName('admin_kecamatan')->givePermissionTo('permohonan.close');

    $this->actingAs($this->adminKec->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertRedirect();
});

it('lets a holder of permohonan.close who cannot fulfill still close', function () {
    $request = pdApprovedRequest($this);
    $role = Role::create(['name' => 'penutup', 'display_name' => 'Penutup', 'unit_scope' => 'own', 'is_system' => false]);
    $role->givePermissionTo('permohonan.view', 'permohonan.close');
    $closer = User::factory()->create(['unit_id' => $this->kec->id])->assignRole($role);

    $this->actingAs($closer->fresh())->post(route('asset-requests.close', $request), ['note' => 'Tidak jadi'])->assertRedirect();

    expect($request->fresh()->status->value)->toBe('cancelled');
});

function pdPasswordPayload(User $target, array $extra = []): array
{
    return array_merge([
        'email' => $target->email, 'is_active' => true, 'role' => 'admin_kecamatan',
        'password' => 'password-baru-123', 'password_confirmation' => 'password-baru-123',
    ], $extra);
}

it('lets only holders of user.reset-password change another user password', function () {
    $target = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');
    Role::findByName('kasubag')->revokePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target))
        ->assertSessionHasErrors('password');
    expect(Hash::check('password-baru-123', $target->fresh()->password))->toBeFalse();

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target, ['password' => '', 'password_confirmation' => '']))
        ->assertSessionHasNoErrors();

    Role::findByName('kasubag')->givePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target))->assertSessionHasNoErrors();
    expect(Hash::check('password-baru-123', $target->fresh()->password))->toBeTrue();
});

it('tells the edit page whether the password section may be shown', function () {
    $target = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');

    $this->actingAs($this->kasubag)->get(route('users.edit', $target))->assertInertia(fn ($page) => $page->where('canResetPassword', true));

    Role::findByName('kasubag')->revokePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->get(route('users.edit', $target))->assertInertia(fn ($page) => $page->where('canResetPassword', false));
});

it('does not let a user without user.reset-password take over an account by changing its email', function () {
    $target = User::factory()->create(['unit_id' => $this->kec->id])->assignRole('admin_kecamatan');
    Role::findByName('kasubag')->revokePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target, ['email' => 'baru@example.com', 'password' => '', 'password_confirmation' => '']))
        ->assertSessionHasErrors('email');
    expect($target->fresh()->email)->not->toBe('baru@example.com');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target, ['password' => '', 'password_confirmation' => '']))
        ->assertSessionHasNoErrors();

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $this->kasubag), ['email' => 'saya@example.com', 'is_active' => true, 'role' => 'kasubag'])
        ->assertSessionHasNoErrors();
    expect($this->kasubag->fresh()->email)->toBe('saya@example.com');

    Role::findByName('kasubag')->givePermissionTo('user.reset-password');

    $this->actingAs($this->kasubag->fresh())->put(route('users.update', $target), pdPasswordPayload($target, ['email' => 'baru@example.com', 'password' => '', 'password_confirmation' => '']))
        ->assertSessionHasNoErrors();
    expect($target->fresh()->email)->toBe('baru@example.com');
});
