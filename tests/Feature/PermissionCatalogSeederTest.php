<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);
});

it('seeds all core granular permissions', function () {
    $expected = [
        'dashboard.view', 'scan.view',
        'aset.view', 'aset.create', 'aset.update', 'aset.delete', 'aset.print-label', 'import-aset', 'export-aset',
        'kategori.view', 'kategori.create', 'kategori.update', 'kategori.delete', 'import-kategori', 'export-kategori',
        'pegawai.view', 'pegawai.create', 'pegawai.update', 'pegawai.delete', 'pegawai.create-user', 'import-pegawai', 'export-pegawai',
        'penerimaan.view', 'penerimaan.create', 'penerimaan.update', 'penerimaan.delete', 'penerimaan.submit',
        'mutasi.view', 'mutasi.create',
        'permohonan.view', 'permohonan.create', 'permohonan.fulfill', 'permohonan.close',
        'laporan-insiden.view', 'laporan-insiden.create',
        'persetujuan.view', 'persetujuan.act',
        'laporan.aset', 'laporan.mutasi', 'laporan.rusak-hilang',
        'pengaturan.alur', 'pengaturan.role', 'pengaturan.user',
    ];

    foreach ($expected as $perm) {
        expect(Permission::where('name', $perm)->exists())->toBeTrue("Permission {$perm} does not exist");
    }
});

it('protects system roles with is_system flag and default unit_scope', function () {
    $kasubag = Role::findByName('kasubag');
    expect($kasubag->is_system)->toBeTrue()
        ->and($kasubag->unit_scope)->toBe('all')
        ->and($kasubag->hasPermissionTo('pengaturan.role'))->toBeTrue();

    $camat = Role::findByName('camat');
    expect($camat->is_system)->toBeTrue()
        ->and($camat->unit_scope)->toBe('binaan')
        ->and($camat->hasPermissionTo('persetujuan.act'))->toBeTrue();
});
