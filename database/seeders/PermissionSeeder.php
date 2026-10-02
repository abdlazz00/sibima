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
        'Pengaturan' => ['pengaturan.alur', 'pengaturan.role', 'pengaturan.user'],
    ];

    public function run(): void
    {
        // 1. Buat semua permission
        foreach (self::PERMISSION_GROUPS as $group => $permissions) {
            foreach ($permissions as $perm) {
                Permission::findOrCreate($perm);
            }
        }

        // 2. Beri hak default ke role sistem
        $kasubag = Role::findOrCreate('kasubag');
        $kasubag->syncPermissions(Permission::all());

        $camat = Role::findOrCreate('camat');
        $camat->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $adminKecamatan = Role::findOrCreate('admin_kecamatan');
        $adminKecamatan->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $adminKelurahan = Role::findOrCreate('admin_kelurahan');
        $adminKelurahan->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view', 'mutasi.create',
            'permohonan.view', 'permohonan.create',
            'laporan-insiden.view', 'laporan-insiden.create',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        $lurah = Role::findOrCreate('lurah');
        $lurah->syncPermissions([
            'dashboard.view', 'scan.view',
            'aset.view', 'export-aset',
            'pegawai.view', 'export-pegawai',
            'mutasi.view',
            'permohonan.view',
            'laporan-insiden.view',
            'persetujuan.view', 'persetujuan.act',
            'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
