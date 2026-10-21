<?php

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
});

it('allows super-admin to view activity logs index', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super-admin');

    $this->actingAs($admin)
        ->get(route('activity-logs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('ActivityLogs/Index'));
});

it('forbids non-super-admin users from viewing activity logs', function () {
    $kasubag = User::factory()->create();
    $kasubag->assignRole('kasubag');

    $this->actingAs($kasubag)
        ->get(route('activity-logs.index'))
        ->assertForbidden();
});

it('filters logs by module and event correctly', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super-admin');

    activity('asset')->log('Buat aset');
    activity('pegawai')->log('Buat pegawai');

    $this->actingAs($admin)
        ->get(route('activity-logs.index', ['modul' => 'asset']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.modul', 'asset')
        );
});

it('presents formatted diffs and filters by keyword', function () {
    $admin = User::factory()->create(['name' => 'Super Administrator']);
    $admin->assignRole('super-admin');

    activity('asset')
        ->causedBy($admin)
        ->event('updated')
        ->withChanges([
            'attributes' => ['kondisi' => 'rusak_berat', 'nilai_buku' => 5000000],
            'old' => ['kondisi' => 'baik', 'nilai_buku' => 10000000],
        ])
        ->log('Memperbarui kondisi aset');

    $this->actingAs($admin)
        ->get(route('activity-logs.index', ['q' => 'kondisi']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.pelaku.nama', 'Super Administrator')
            ->where('logs.data.0.diff.0.field', 'Kondisi Fisik')
            ->where('logs.data.0.diff.0.old', 'Baik')
            ->where('logs.data.0.diff.0.new', 'Rusak Berat')
            ->where('logs.data.0.diff.1.field', 'Nilai Buku')
            ->where('logs.data.0.diff.1.old', 'Rp 10.000.000')
            ->where('logs.data.0.diff.1.new', 'Rp 5.000.000')
        );
});
