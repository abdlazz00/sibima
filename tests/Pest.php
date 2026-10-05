<?php

use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function userWithRole(string $role, ?Unit $unit = null): User
{
    // RBAC bawaan (role sistem + permission default) disiapkan sekali per test.
    if (! \Spatie\Permission\Models\Permission::query()->exists()) {
        (new \Database\Seeders\RoleSeeder)->run();
        (new \Database\Seeders\PermissionSeeder)->run();
    }

    Role::findOrCreate($role);

    $user = User::factory()->create(['unit_id' => $unit?->id]);
    $user->assignRole($role);

    return $user;
}

function makeKecamatan(string $name = 'Kecamatan Sagulung'): Unit
{
    return Unit::create(['name' => $name, 'type' => 'kecamatan']);
}

function makeKelurahan(Unit $kecamatan, string $name): Unit
{
    return Unit::create(['name' => $name, 'type' => 'kelurahan', 'parent_id' => $kecamatan->id]);
}

/** Membuat berkas .xlsx sungguhan: string disimpan sebagai teks, angka/null apa adanya. */
function impXlsx(array $headers, array $rows, string $name = 'data.xlsx'): \Illuminate\Http\UploadedFile
{
    $book = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
    $sheet = $book->getActiveSheet();

    foreach (array_merge([$headers], $rows) as $r => $row) {
        foreach (array_values($row) as $c => $value) {
            $cell = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1).($r + 1);

            if (is_string($value)) {
                $sheet->setCellValueExplicit($cell, $value, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            } elseif ($value !== null) {
                $sheet->setCellValue($cell, $value);
            }
        }
    }

    $path = tempnam(sys_get_temp_dir(), 'imp').'.xlsx';
    (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save($path);

    return new \Illuminate\Http\UploadedFile($path, $name, null, null, true);
}

/** @param list<string> $permissions */
function impUser(string $role, ?\App\Models\Unit $unit, array $permissions): \App\Models\User
{
    $user = userWithRole($role, $unit);

    foreach ($permissions as $permission) {
        \Spatie\Permission\Models\Permission::findOrCreate($permission);
        $user->givePermissionTo($permission);
    }

    return $user;
}
