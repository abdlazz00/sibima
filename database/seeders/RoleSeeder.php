<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public const SYSTEM_ROLES = [
        'super-admin' => [
            'display_name' => 'Super Admin',
            'unit_scope' => 'all',
            'description' => 'Administrator sistem dengan hak akses penuh terhadap konfigurasi, alur, dan role pengguna.',
        ],
        'kasubag' => [
            'display_name' => 'Kasubag Kepegawaian & Umum',
            'unit_scope' => 'all',
            'description' => 'Pimpinan operasional tertinggi seluruh modul kerja dan data aset.',
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

            // Role bernama sistem yang belum pernah diinisialisasi (belum bertanda sistem) diadopsi sekali; yang sudah tidak disentuh.
            if (! $role->is_system) {
                $role->update($meta + ['is_system' => true]);
            }
        }
    }
}
