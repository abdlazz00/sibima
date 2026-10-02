<?php

use App\Models\ImportBatch;
use Database\Seeders\PermissionSeeder;
use Spatie\Permission\Models\Permission;

it('grants import and export permissions only to roles that already manage each module', function () {
    $this->seed(PermissionSeeder::class);
    $kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');

    expect(userWithRole('kasubag')->can('import-kategori'))->toBeTrue()
        ->and(userWithRole('admin_kelurahan', $kel)->can('import-kategori'))->toBeFalse()
        ->and(userWithRole('admin_kelurahan', $kel)->can('import-aset'))->toBeTrue()
        ->and(userWithRole('camat', $kel)->can('import-aset'))->toBeFalse()
        ->and(userWithRole('camat', $kel)->can('export-aset'))->toBeTrue()
        ->and(userWithRole('lurah', $kel)->can('export-kategori'))->toBeFalse();
});

it('can be seeded repeatedly without duplicating permissions', function () {
    $this->seed(PermissionSeeder::class);
    $count = Permission::count();
    $this->seed(PermissionSeeder::class);

    expect(Permission::count())->toBe($count);
});

it('shares the permission names of the signed-in user with the frontend', function () {
    $this->seed(PermissionSeeder::class);

    $this->actingAs(userWithRole('kasubag'))->get('/dashboard')
        ->assertInertia(fn ($page) => $page->where('auth.user.permissions', fn ($permissions) => collect($permissions)->contains('import-aset')));
});

it('starts a batch as memeriksa with zeroed counters', function () {
    $batch = ImportBatch::create([
        'modul' => 'kategori', 'user_id' => userWithRole('kasubag')->id,
        'nama_berkas' => 'a.xlsx', 'path' => 'imports/a.xlsx',
    ])->refresh();

    expect($batch->status)->toBe(ImportBatch::MEMERIKSA)
        ->and([$batch->total_baris, $batch->jumlah_baru, $batch->progres])->toBe([0, 0, 0]);
});

it('keeps the queue retry_after above the import job timeout so a running job is never re-dispatched', function () {
    expect(config('queue.connections.database.retry_after'))->toBeGreaterThan(config('import.job_timeout'));
});
