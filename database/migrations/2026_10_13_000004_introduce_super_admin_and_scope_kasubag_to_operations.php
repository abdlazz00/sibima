<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Memperkenalkan role super-admin sebagai penguasa penuh konfigurasi dan sistem,
 * serta membatasi role kasubag khusus pada modul-modul operasional (mencabut izin menu Pengaturan).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        // 1. Pastikan seluruh permission di katalog tersedia
        foreach (PermissionSeeder::PERMISSION_GROUPS as $permissions) {
            foreach ($permissions as $permission) {
                Permission::findOrCreate($permission, 'web');
            }
        }

        // 2. Buat / perbarui role super-admin dengan seluruh hak akses
        $superAdmin = Role::firstOrCreate(
            ['name' => 'super-admin', 'guard_name' => 'web'],
            [
                'display_name' => 'Super Admin',
                'unit_scope' => 'all',
                'is_system' => true,
                'description' => 'Administrator sistem dengan hak akses penuh terhadap konfigurasi, alur, dan role pengguna.',
            ]
        );

        if (! $superAdmin->is_system) {
            $superAdmin->update([
                'display_name' => 'Super Admin',
                'unit_scope' => 'all',
                'is_system' => true,
                'description' => 'Administrator sistem dengan hak akses penuh terhadap konfigurasi, alur, dan role pengguna.',
            ]);
        }

        $superAdmin->syncPermissions(Permission::all());

        // Akun super-admin pertama dibuat manual (docs/ops/deployment.md); migrasi tidak membuat akun berpassword bawaan.

        // 3. Cabut hak akses menu pengaturan dari role kasubag
        $kasubag = Role::where('name', 'kasubag')->first();
        if ($kasubag) {
            $kasubag->update([
                'description' => 'Pimpinan operasional tertinggi seluruh modul kerja dan data aset.',
            ]);

            $pengaturanPerms = PermissionSeeder::PERMISSION_GROUPS['Pengaturan'] ?? [
                'pengaturan.alur',
                'pengaturan.role',
                'user.view',
                'user.manage-access',
                'user.reset-password',
                'user.toggle-status',
                'user.delete',
            ];

            foreach ($pengaturanPerms as $perm) {
                if ($kasubag->hasPermissionTo($perm)) {
                    $kasubag->revokePermissionTo($perm);
                }
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Migrasi data aditif/rekonsiliasi; tidak di-rollback otomatis.
    }
};
