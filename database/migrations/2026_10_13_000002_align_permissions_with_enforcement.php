<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Menyelaraskan permission dengan penegakannya tanpa mengubah hak efektif yang berjalan.
 * Aditif dan idempoten: aman dijalankan ulang, tidak mencabut permission selain dua yang dihapus.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->dropGhosts(['penerimaan.submit', 'pengaturan.user']);

        foreach (['persetujuan.act', 'persetujuan.reassign', 'permohonan.close', 'penerimaan.delete', 'user.reset-password'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        Role::where('name', 'kasubag')->first()?->givePermissionTo('persetujuan.reassign');

        $this->grantAct();

        foreach (['permohonan.fulfill' => 'permohonan.close', 'penerimaan.update' => 'penerimaan.delete', 'user.manage-access' => 'user.reset-password'] as $has => $give) {
            Permission::findOrCreate($has, 'web');
            Role::permission($has)->get()->each(fn (Role $role) => $role->givePermissionTo($give));
        }

        Role::where('name', 'camat')->whereNull('unit_head_of')->update(['unit_head_of' => 'kecamatan']);
        Role::where('name', 'lurah')->whereNull('unit_head_of')->update(['unit_head_of' => 'kelurahan']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Data; tidak dikembalikan. */
    public function down(): void {}

    /** @param list<string> $names */
    private function dropGhosts(array $names): void
    {
        foreach (Permission::whereIn('name', $names)->get() as $permission) {
            DB::table(config('permission.table_names.role_has_permissions'))->where('permission_id', $permission->id)->delete();
            DB::table(config('permission.table_names.model_has_permissions'))->where('permission_id', $permission->id)->delete();
            $permission->delete();
        }
    }

    /** Role yang dirujuk langkah alur sebagai approver (atau role milik pengguna approver) mempertahankan hak menyetujui. */
    private function grantAct(): void
    {
        $steps = collect(['workflow_steps', 'approval_request_steps'])
            ->map(fn (string $table) => DB::table($table)->get(['approver_role', 'approver_user_id']))
            ->flatten(1);

        $roleNames = $steps->pluck('approver_role')->filter()->unique();
        $userIds = $steps->pluck('approver_user_id')->filter()->unique();

        $names = $roleNames->merge(
            Role::whereHas('users', fn ($q) => $q->whereIn('users.id', $userIds))->pluck('name'),
        )->unique();

        Role::whereIn('name', $names)->get()->each(fn (Role $role) => $role->givePermissionTo('persetujuan.act'));
    }
};
