<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Memastikan role kasubag (administrator utama) memegang seluruh hak akses katalog,
 * sehingga batasan delegasi (covers / canManageRole) tidak memblokir pengelolaan role lain.
 */
return new class extends Migration
{
    public function up(): void
    {
        $kasubag = Role::where('name', 'kasubag')->first();

        if ($kasubag) {
            $kasubag->givePermissionTo(Permission::all());
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Migrasi data aditif; tidak mencabut hak akses saat rollback.
    }
};
