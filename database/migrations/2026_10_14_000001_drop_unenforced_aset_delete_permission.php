<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/** Menghapus `aset.delete`: tidak ada fitur hapus aset, jadi izin ini tidak pernah berefek. */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::where('name', 'aset.delete')->first();

        if ($permission !== null) {
            DB::table(config('permission.table_names.role_has_permissions'))->where('permission_id', $permission->id)->delete();
            DB::table(config('permission.table_names.model_has_permissions'))->where('permission_id', $permission->id)->delete();
            $permission->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Data; tidak dikembalikan. */
    public function down(): void {}
};
