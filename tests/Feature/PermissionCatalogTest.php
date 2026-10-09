<?php

use Database\Seeders\PermissionSeeder;
use Illuminate\Support\Facades\File;

function pdSources(): string
{
    return collect(File::allFiles(app_path()))->merge(File::allFiles(resource_path('js')))
        ->reject(fn ($file) => str_ends_with(str_replace('\\', '/', $file->getPathname()), 'Pages/Roles/RoleModal.tsx'))
        ->map(fn ($file) => File::get($file->getPathname()))
        ->implode("\n");
}

it('references every catalog permission in the code outside the role labels', function () {
    $sources = pdSources();

    $unreferenced = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten()
        ->reject(fn ($permission) => str_starts_with($permission, 'import-') || str_starts_with($permission, 'export-'))
        ->reject(fn ($permission) => str_contains($sources, "'{$permission}'") || str_contains($sources, "\"{$permission}\""))
        ->values()->all();

    expect($unreferenced)->toBe([]);
});

it('does not check any permission in the backend that is missing from the catalog', function () {
    $catalog = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten();

    preg_match_all("/can\\('([a-z\\-]+\\.[a-z\\-]+)'\\)/", pdSources(), $matches);

    expect(collect($matches[1])->unique()->reject(fn ($permission) => $catalog->contains($permission))->values()->all())->toBe([]);
});

it('keeps the import and export permissions wired to their controllers', function () {
    $sources = pdSources();

    expect($sources)->toContain('"import-{$modul}"')->toContain('"export-{$modul}"');
});

it('has no leftover ghost permissions in the catalog', function () {
    $catalog = collect(PermissionSeeder::PERMISSION_GROUPS)->flatten();

    expect($catalog->contains('penerimaan.submit'))->toBeFalse()
        ->and($catalog->contains('pengaturan.user'))->toBeFalse()
        ->and($catalog->contains('persetujuan.reassign'))->toBeTrue();
});
