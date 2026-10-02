<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    /**
     * Satu-satunya tempat pemetaan permission ke role. Saat RBAC dinamis dibangun,
     * cukup penugasan ini yang berpindah ke UI; kode import/ekspor tidak berubah.
     *
     * @var array<string, array<string, list<string>>>
     */
    public const GRANTS = [
        'aset' => [
            'import' => ['kasubag', 'admin_kecamatan', 'admin_kelurahan'],
            'export' => ['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'],
        ],
        'pegawai' => [
            'import' => ['kasubag', 'admin_kecamatan', 'admin_kelurahan'],
            'export' => ['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'],
        ],
        'kategori' => [
            'import' => ['kasubag'],
            'export' => ['kasubag'],
        ],
    ];

    public function run(): void
    {
        foreach (self::GRANTS as $modul => $actions) {
            foreach ($actions as $action => $roles) {
                $permission = Permission::findOrCreate("{$action}-{$modul}");

                foreach ($roles as $role) {
                    Role::findOrCreate($role)->givePermissionTo($permission);
                }
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
