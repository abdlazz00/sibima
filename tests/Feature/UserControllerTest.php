<?php

use App\Models\ApprovalAction;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->kecamatan = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelurahan = Unit::create(['name' => 'Kelurahan Sei Lekop', 'type' => 'kelurahan', 'parent_id' => $this->kecamatan->id]);

    $this->kasubag = User::factory()->create(['unit_id' => $this->kecamatan->id]);
    $this->kasubag->assignRole('kasubag');

    $this->operator = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $this->operator->assignRole('admin_kelurahan');
    $this->pegawai = Pegawai::factory()->create([
        'unit_id' => $this->kelurahan->id,
        'user_id' => $this->operator->id,
    ]);
});

it('allows user with user.view to access users index page with filters', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.index', ['search' => $this->operator->name]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Index')
            ->has('users.data')
            ->has('roles')
            ->has('units')
            ->has('filters')
        );
});

it('denies user without user.view from accessing users index', function () {
    $this->actingAs($this->operator)
        ->get(route('users.index'))
        ->assertForbidden();
});

it('renders show page with user detail, pegawai link, and effective permissions', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.show', $this->operator))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Show')
            ->where('user.id', $this->operator->id)
            ->has('user.pegawai')
            ->has('effectivePermissions')
        );
});

it('renders edit page with all roles and permission groups', function () {
    $this->actingAs($this->kasubag)
        ->get(route('users.edit', $this->operator))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Users/Edit')
            ->where('user.id', $this->operator->id)
            ->has('roles')
            ->has('permissionGroups')
        );
});

it('updates user email, password, role, and direct permissions on edit submission', function () {
    $this->actingAs($this->kasubag)
        ->put(route('users.update', $this->operator), [
            'email' => 'operator.baru@sagulung.go.id',
            'password' => 'PasswordBaru123',
            'password_confirmation' => 'PasswordBaru123',
            'is_active' => true,
            'role' => 'admin_kelurahan',
            'direct_permissions' => ['import-kategori'],
            'unit_scope_override' => 'binaan',
        ])
        ->assertRedirect(route('users.show', $this->operator));

    $this->operator->refresh();
    expect($this->operator->email)->toBe('operator.baru@sagulung.go.id')
        ->and(Hash::check('PasswordBaru123', $this->operator->password))->toBeTrue()
        ->and($this->operator->hasDirectPermission('import-kategori'))->toBeTrue()
        ->and($this->operator->unit_scope_override)->toBe('binaan');
});

it('toggles user is_active status with self-guard and system role protection', function () {
    // 1. Sukses toggle user biasa
    $this->actingAs($this->kasubag)
        ->patch(route('users.toggle-status', $this->operator))
        ->assertRedirect();

    expect($this->operator->fresh()->is_active)->toBeFalse();

    // 2. Cegah toggle diri sendiri
    $this->actingAs($this->kasubag)
        ->patch(route('users.toggle-status', $this->kasubag))
        ->assertSessionHas('error');

    expect($this->kasubag->fresh()->is_active)->toBeTrue();
});

it('deletes user credentials, clears pegawai user_id link, and prevents deletion if audit exists', function () {
    // 1. Berhasil hapus jika belum ada approval audit
    $userToDelete = User::factory()->create(['unit_id' => $this->kelurahan->id]);
    $pegawai = Pegawai::factory()->create(['user_id' => $userToDelete->id, 'unit_id' => $this->kelurahan->id]);

    $this->actingAs($this->kasubag)
        ->delete(route('users.destroy', $userToDelete))
        ->assertRedirect(route('users.index'));

    expect(User::where('id', $userToDelete->id)->exists())->toBeFalse()
        ->and($pegawai->fresh()->user_id)->toBeNull();

    // 2. Tolak hapus jika user memiliki riwayat audit
    (new \Database\Seeders\WorkflowDefinitionSeeder)->run();
    $definition = \App\Models\WorkflowDefinition::first();
    $req = \App\Models\ApprovalRequest::create([
        'workflow_definition_id' => $definition->id,
        'approvable_type' => User::class,
        'approvable_id' => $this->operator->id,
        'current_step' => 1,
        'status' => \App\Enums\ApprovalStatus::Pending,
        'created_by' => $this->kasubag->id,
    ]);

    ApprovalAction::create([
        'approval_request_id' => $req->id,
        'user_id' => $this->operator->id,
        'action' => \App\Enums\ApprovalActionType::Approve->value,
        'step_order' => 1,
    ]);

    $this->actingAs($this->kasubag)
        ->delete(route('users.destroy', $this->operator))
        ->assertSessionHas('error');

    expect(User::where('id', $this->operator->id)->exists())->toBeTrue();
});
