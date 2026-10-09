<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\WorkflowDefinitionSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

function pdMigration(): object
{
    return require base_path('database/migrations/2026_10_13_000002_align_permissions_with_enforcement.php');
}

/** Meniru produksi sebelum rilis ini: permission lama ada, permission baru belum diberikan, penanda belum diisi. */
function pdLegacyState(): void
{
    test()->seed(RoleSeeder::class);
    test()->seed(PermissionSeeder::class);
    (new WorkflowDefinitionSeeder)->run();

    foreach (['penerimaan.submit', 'pengaturan.user'] as $ghost) {
        Permission::findOrCreate($ghost);
        Role::findByName('admin_kecamatan')->givePermissionTo($ghost);
    }

    Role::findByName('admin_kecamatan')->revokePermissionTo(['persetujuan.act', 'permohonan.close', 'penerimaan.delete']);
    Role::findByName('admin_kelurahan')->revokePermissionTo(['persetujuan.act', 'permohonan.close']);
    Role::findByName('kasubag')->revokePermissionTo(['persetujuan.reassign', 'user.reset-password']);
    Role::query()->update(['unit_head_of' => null]);
    Permission::where('name', 'persetujuan.reassign')->delete();
}

it('keeps every role able to do what it could before and removes only the ghost permissions', function () {
    pdLegacyState();
    Role::findByName('lurah')->revokePermissionTo('permohonan.close');

    pdMigration()->up();

    $kec = Role::findByName('admin_kecamatan');
    $kel = Role::findByName('admin_kelurahan');

    expect(Permission::where('name', 'penerimaan.submit')->exists())->toBeFalse()
        ->and(Permission::where('name', 'pengaturan.user')->exists())->toBeFalse()
        ->and($kec->hasPermissionTo('persetujuan.act'))->toBeTrue()
        ->and($kel->hasPermissionTo('persetujuan.act'))->toBeTrue()
        ->and($kec->hasPermissionTo('permohonan.close'))->toBeTrue()
        ->and($kec->hasPermissionTo('penerimaan.delete'))->toBeTrue()
        ->and(Role::findByName('kasubag')->hasPermissionTo('persetujuan.reassign'))->toBeTrue()
        ->and(Role::findByName('kasubag')->hasPermissionTo('user.reset-password'))->toBeTrue()
        ->and(Role::findByName('camat')->unit_head_of)->toBe('kecamatan')
        ->and(Role::findByName('lurah')->unit_head_of)->toBe('kelurahan')
        ->and(Role::findByName('lurah')->hasPermissionTo('permohonan.close'))->toBeFalse();
});

it('gives persetujuan.act to the custom role of a user picked as approver in a workflow', function () {
    pdLegacyState();
    $role = Role::create(['name' => 'sekretaris', 'display_name' => 'Sekretaris', 'unit_scope' => 'own', 'is_system' => false]);
    $approver = User::factory()->create()->assignRole($role);

    DB::table('workflow_steps')->where('id', DB::table('workflow_steps')->min('id'))
        ->update(['approver_type' => 'user', 'approver_user_id' => $approver->id, 'approver_role' => null]);

    pdMigration()->up();

    expect(Role::findByName('sekretaris')->hasPermissionTo('persetujuan.act'))->toBeTrue();
});

it('can run twice without changing the outcome and without touching customised roles', function () {
    pdLegacyState();
    Role::findByName('camat')->update(['unit_head_of' => 'kelurahan']);

    pdMigration()->up();
    $first = Role::findByName('admin_kecamatan')->permissions->pluck('name')->sort()->values()->all();
    pdMigration()->up();

    expect(Role::findByName('admin_kecamatan')->permissions->pluck('name')->sort()->values()->all())->toBe($first)
        ->and(Role::findByName('camat')->unit_head_of)->toBe('kelurahan');
});

it('runs on an empty database', function () {
    pdMigration()->up();

    expect(Permission::where('name', 'persetujuan.reassign')->exists())->toBeTrue();
});
