<?php

use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Route;

function uagPayload(array $o = []): array
{
    return array_merge([
        'email' => 'baru'.uniqid().'@example.test', 'is_active' => true, 'role' => 'admin_kelurahan',
        'direct_permissions' => [], 'unit_scope_override' => null,
    ], $o);
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $kec = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->kelA = Unit::create(['name' => 'Kelurahan A', 'type' => 'kelurahan', 'parent_id' => $kec->id]);
    $this->kelB = Unit::create(['name' => 'Kelurahan B', 'type' => 'kelurahan', 'parent_id' => $kec->id]);

    $this->superAdmin = User::factory()->create(['unit_id' => $kec->id]);
    $this->superAdmin->assignRole('super-admin');

    $this->kasubag = User::factory()->create(['unit_id' => $kec->id]);
    $this->kasubag->assignRole('kasubag');

    $this->manager = User::factory()->create(['unit_id' => $this->kelA->id]);
    $this->manager->assignRole('admin_kelurahan');
    $this->manager->givePermissionTo(['user.view', 'user.manage-access', 'user.toggle-status', 'user.delete']);

    $this->targetA = User::factory()->create(['unit_id' => $this->kelA->id]);
    $this->targetA->assignRole('admin_kelurahan');
    $this->targetB = User::factory()->create(['unit_id' => $this->kelB->id]);
    $this->targetB->assignRole('admin_kelurahan');
});

it('lets a scoped manager act on accounts of its own unit', function () {
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload())->assertRedirect();
    $this->actingAs($this->manager)->patch(route('users.toggle-status', $this->targetA))->assertSessionHas('success');
    $this->actingAs($this->manager)->delete(route('users.destroy', $this->targetA))->assertRedirect(route('users.index'));
});

it('forbids a scoped manager from editing, toggling or deleting accounts of another unit', function () {
    $this->actingAs($this->manager)->get(route('users.edit', $this->targetB))->assertForbidden();
    $this->actingAs($this->manager)->put(route('users.update', $this->targetB), uagPayload())->assertForbidden();
    $this->actingAs($this->manager)->patch(route('users.toggle-status', $this->targetB))->assertForbidden();
    $this->actingAs($this->manager)->delete(route('users.destroy', $this->targetB))->assertForbidden();

    expect($this->targetB->fresh()->is_active)->toBeTrue()
        ->and(User::whereKey($this->targetB->id)->exists())->toBeTrue();
});

it('forbids managing an account that is more powerful than the manager, even in its own unit', function () {
    $camat = User::factory()->create(['unit_id' => $this->kelA->id]);
    $camat->assignRole('camat');

    $this->actingAs($this->manager)->put(route('users.update', $camat), uagPayload(['role' => 'admin_kelurahan']))->assertForbidden();
    $this->actingAs($this->manager)->patch(route('users.toggle-status', $camat))->assertForbidden();
    $this->actingAs($this->manager)->delete(route('users.destroy', $camat))->assertForbidden();

    expect($camat->fresh()->hasRole('camat'))->toBeTrue();
});

it('refuses to grant a role, permission or unit scope beyond the manager own', function () {
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload(['email' => $this->targetA->email, 'role' => 'kasubag']))
        ->assertSessionHasErrors('role');
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload(['email' => $this->targetA->email, 'role' => 'camat']))
        ->assertSessionHasErrors('role');
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload(['email' => $this->targetA->email, 'direct_permissions' => ['pengaturan.role']]))
        ->assertSessionHasErrors('direct_permissions');
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload(['email' => $this->targetA->email, 'unit_scope_override' => 'all']))
        ->assertSessionHasErrors('unit_scope_override');

    $fresh = $this->targetA->fresh();
    expect($fresh->hasRole('admin_kelurahan'))->toBeTrue()
        ->and($fresh->unit_scope_override)->toBeNull()
        ->and($fresh->getDirectPermissions())->toHaveCount(0);
});

it('lets a manager grant what it holds', function () {
    $this->actingAs($this->manager)->put(route('users.update', $this->targetA), uagPayload(['email' => $this->targetA->email,
        'direct_permissions' => ['user.view'], 'unit_scope_override' => 'own',
    ]))->assertRedirect()->assertSessionHasNoErrors();

    expect($this->targetA->fresh()->hasDirectPermission('user.view'))->toBeTrue();
});

it('lets super-admin grant any role and scope', function () {
    $this->actingAs($this->superAdmin)->put(route('users.update', $this->targetA), uagPayload([
        'role' => 'camat', 'unit_scope_override' => 'all', 'direct_permissions' => ['pengaturan.role'],
    ]))->assertRedirect()->assertSessionHasNoErrors();

    expect($this->targetA->fresh()->hasRole('camat'))->toBeTrue();
});

it('forbids kasubag without user.manage-access from updating users', function () {
    $this->actingAs($this->kasubag)->put(route('users.update', $this->targetA), uagPayload())
        ->assertForbidden();
});

it('no longer has the duplicate pegawai access route', function () {
    expect(Route::has('pegawais.user-access'))->toBeFalse();
});
