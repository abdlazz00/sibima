<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public const SYSTEM_ROLES = [
        'kasubag' => [
            'display_name' => 'Kasubag Kepegawaian & Umum',
            'unit_scope' => 'all',
            'description' => 'Administrator penuh seluruh modul dan unit kerja.',
        ],
        'camat' => [
            'display_name' => 'Camat Sagulung',
            'unit_scope' => 'binaan',
            'unit_head_of' => 'kecamatan',
            'description' => 'Pimpinan kecamatan, dapat melihat unit kecamatan dan kelurahan binaan.',
        ],
        'admin_kecamatan' => [
            'display_name' => 'Admin Kecamatan',
            'unit_scope' => 'own',
            'description' => 'Operator pengelola aset dan mutasi di tingkat kecamatan.',
        ],
        'admin_kelurahan' => [
            'display_name' => 'Admin Kelurahan',
            'unit_scope' => 'own',
            'description' => 'Operator pengelola aset dan permohonan di tingkat kelurahan.',
        ],
        'lurah' => [
            'display_name' => 'Lurah',
            'unit_scope' => 'own',
            'unit_head_of' => 'kelurahan',
            'description' => 'Pimpinan kelurahan untuk persetujuan dokumen tingkat kelurahan.',
        ],
    ];

    public function run(): void
    {
        foreach (self::SYSTEM_ROLES as $name => $meta) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web'], $meta + ['is_system' => true]);

            if (! $role->is_system) {
                $role->update(['is_system' => true]);
            }
        }
    }
}
