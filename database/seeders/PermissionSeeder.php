<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    public const PERMISSION_GROUPS = [
        'Dashboard' => ['dashboard.view'],
        'Data Aset' => [
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label',
            'import-aset', 'export-aset',
        ],
        'Scan QR' => ['scan.view'],
        'Kategori Aset' => [
            'kategori.view', 'kategori.create', 'kategori.update', 'kategori.delete',
            'import-kategori', 'export-kategori',
        ],
        'Data Pegawai' => [
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete',
            'pegawai.create-user', 'import-pegawai', 'export-pegawai',
        ],
        'Penerimaan Aset' => [
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
        ],
        'Mutasi Aset' => ['mutasi.view', 'mutasi.create'],
        'Permohonan Aset' => ['permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close'],
        'Lapor Insiden' => ['laporan-insiden.view', 'laporan-insiden.create'],
        'Persetujuan' => ['persetujuan.view', 'persetujuan.act'],
        'Laporan' => ['laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang'],
        'Pengaturan' => [
            'pengaturan.alur',
            'pengaturan.role',
            'pengaturan.user',
            'user.view',
            'user.manage-access',
            'user.reset-password',
            'user.toggle-status',
            'user.delete',
        ],
    ];

    /** Default role sistem selain `kasubag` (yang menerima semua permission). Hanya dipakai saat role belum punya permission. */
    public const DEFAULTS = [
        'camat' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'admin_kecamatan' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'export-pegawai',
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'admin_kelurahan' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'export-pegawai',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
        'lurah' => [
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ],
    ];

    public function run(): void
    {
        foreach (self::PERMISSION_GROUPS as $permissions) {
            foreach ($permissions as $permission) {
                Permission::findOrCreate($permission);
            }
        }

        // Default hanya untuk role sistem yang belum punya permission; tidak pernah menimpa pengaturan dari menu Role.
        foreach (['kasubag' => Permission::all(), ...self::DEFAULTS] as $name => $permissions) {
            $role = Role::findOrCreate($name);

            if ($role->permissions()->doesntExist()) {
                $role->syncPermissions($permissions);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
