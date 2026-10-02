# Import & Ekspor Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Excel (pratinjau, antrean, riwayat) dan ekspor Excel untuk Data Aset, Pegawai, dan Kategori Aset, dijaga permission bernama.

**Architecture:** Satu mesin generik (`ImportService` + satu job antrean dengan fase validate/commit + tabel `import_batches`) dan satu kelas `Importer` per modul yang hanya mendefinisikan kolom, validasi baris, kunci duplikat, dan cara menyimpan. Berkas dibaca per chunk dengan `IReadFilter`, hasil validasi disimpan ke berkas JSON-lines, lalu konfirmasi menjalankan job commit yang memvalidasi ulang tiap baris. Ekspor sinkron memakai penulis yang sama dengan template.

**Tech Stack:** Laravel 13, queue driver `database`, spatie/laravel-permission, PhpSpreadsheet 5 (tanpa maatwebsite), Inertia + React/TypeScript, Pest (SQLite `:memory:`, queue `sync`).

**Spec:** `docs/superpowers/specs/2026-10-08-import-ekspor-design.md`

## Global Constraints

- Excel hanya lewat `phpoffice/phpspreadsheet` langsung; tidak menambah dependency baru.
- Permission bernama `import-{modul}` dan `export-{modul}` untuk `modul` = `aset`, `pegawai`, `kategori`; kode import/ekspor tidak pernah memeriksa nama role. Cakupan unit tetap lewat `User::accessibleUnitIds()`.
- Batas: 10.000 baris dan 5 MB (5120 KB) per impor, chunk 500 baris, kedaluwarsa 7 hari, ekspor maksimum 10.000 baris. Semua dibaca dari `config/import.php`.
- Aturan validasi memakai ulang aturan form manual (regex kode barang, nilai buku ≤ harga perolehan, tanggal antara 1900 dan hari ini, `No. Dokumen` unik, subkategori wajib untuk aset).
- Pencocokan teks (nama kategori, unit, kondisi, pegawai) tidak peka huruf besar-kecil dan mengabaikan spasi ujung.
- Query harus jalan di SQLite dan MySQL: `lower(name) = ?` dengan nilai yang sudah `mb_strtolower`, tanpa fungsi khusus MySQL.
- Teks UI dan pesan error dalam bahasa Indonesia.
- Berkas privat (unggahan, hasil) di disk `local`; tidak pernah di disk `public`.
- Commit: stage dengan path eksplisit, **tanpa trailer `Co-Authored-By` atau atribusi Claude** (aturan tetap pengguna), jangan push. Dokumen pribadi `docs/*.xlsx` dan `docs/*.pdf` tidak boleh ter-commit.
- Jangan menguji lewat browser; frontend diverifikasi dengan `npx tsc --noEmit` dan `npm run build`. Cek UI manual menunggu perintah pengguna.
- Nama fungsi helper Pest harus unik antar berkas; helper baru berawalan `imp`.

## Review Focus

Masukan yang tersirat di spec tetapi tidak disebut tegas, urut dari yang paling mungkin terjadi pada pengguna:

1. **NIP / nomor yang diketik sebagai angka di Excel** (sel numerik, float): harus terbaca sebagai teks digit penuh, bukan `1.23E+11`. Diuji di Task 3 (`cell()`) dan Task 4 (Pegawai).
2. **Berkas dengan baris kosong di tengah atau di akhir** (bekas format sel): baris kosong dilewati tetapi nomor baris Excel di laporan error tetap benar. Diuji di Task 2.
3. **Mengunggah ulang berkas yang sama:** aset ber-register dan seluruh kategori/pegawai dilewati sebagai duplikat, tidak menggandakan data. Diuji di Task 5 dan Task 6.
4. **Berkas bukan `.xlsx` yang sebenarnya** (teks/CSV diganti ekstensi, rusak): pesan ramah di field `berkas`, bukan error 500, dan berkas yang tersimpan dibersihkan. Diuji di Task 6 dan Task 7.
5. **Sel berawalan `=`, `+`, `-`, `@`** pada data ekspor: tersimpan sebagai teks, tidak dieksekusi sebagai rumus. Diuji di Task 2.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `config/import.php` | Semua angka batas dan waktu. |
| `database/migrations/2026_10_08_000001_create_import_batches_table.php` | Tabel `import_batches`. |
| `app/Models/ImportBatch.php` | Model + konstanta status. |
| `database/seeders/PermissionSeeder.php` | Enam permission dan pemetaan awal ke role (satu-satunya tempat pemetaan). |
| `app/Support/ExcelRows.php` | Baca `.xlsx` per chunk (`IReadFilter`), jumlah baris, header. |
| `app/Support/TabularExcel.php` | Tulis `.xlsx` tabular (header + baris + sheet Petunjuk), unduh. |
| `app/Imports/RowResult.php` | Hasil validasi satu baris (`baru`/`duplikat`/`error`). |
| `app/Imports/Importer.php` | Kelas abstrak: helper bersama + kontrak per modul. |
| `app/Imports/KategoriImporter.php`, `PegawaiImporter.php`, `AsetImporter.php` | Satu importer per modul. |
| `app/Services/ImportService.php` | Unggah, validasi, konfirmasi, commit, pratinjau, laporan error, kedaluwarsa, gagal. |
| `app/Jobs/ProcessImportJob.php` | Pembungkus antrean tipis: fase `validate` atau `commit`. |
| `app/Console/Commands/PruneImports.php` | `import:prune`, dijadwalkan harian. |
| `app/Http/Controllers/ImportController.php`, `ExportController.php` | Halaman import, unggah, konfirmasi, laporan error, template, ekspor. |
| `resources/js/Pages/Import/Index.tsx` | Halaman generik `/import/{modul}`. |
| `resources/js/Components/ImportExportButtons.tsx` | Tombol Impor/Ekspor di tiga halaman modul. |
| `docs/ops/queue-setup.md` | Setup queue worker dev dan produksi. |

Pengujian: `tests/Feature/Import*Test.php` dan `tests/Feature/Export*Test.php`.

---

### Task 1: Fondasi (config, tabel, model, permission, queue)

**Files:**
- Create: `config/import.php`, `database/migrations/2026_10_08_000001_create_import_batches_table.php`, `app/Models/ImportBatch.php`, `database/seeders/PermissionSeeder.php`, `tests/Feature/ImportFoundationTest.php`
- Modify: `database/seeders/DatabaseSeeder.php`, `app/Http/Middleware/HandleInertiaRequests.php:36`, `resources/js/types/index.d.ts` (`AuthUser`), `config/queue.php:43`, `.env.example`, `tests/Pest.php` (tambah helper di akhir berkas)

**Interfaces:**
- Produces: `config('import.{max_rows,max_kb,chunk,expire_days,export_max,job_timeout}')`; `App\Models\ImportBatch` dengan konstanta `MEMERIKSA='memeriksa'`, `SIAP='siap'`, `MEMPROSES='memproses'`, `SELESAI='selesai'`, `GAGAL='gagal'`, `KEDALUWARSA='kedaluwarsa'`; permission `import-aset|pegawai|kategori` dan `export-aset|pegawai|kategori`; `auth.user.permissions: string[]` di props Inertia; helper Pest `impXlsx(array $headers, array $rows, string $name='data.xlsx'): UploadedFile` dan `impUser(string $role, ?Unit $unit, array $permissions): User`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportFoundationTest.php`:

```php
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
    $this->seed(PermissionSeeder::class);

    expect(Permission::count())->toBe(6);
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportFoundationTest`
Expected: FAIL (kelas `PermissionSeeder`/`ImportBatch` tidak ada).

- [ ] **Step 3: Implementasi**

`config/import.php`:

```php
<?php

return [
    'max_rows' => 10000,
    'max_kb' => 5120,
    'chunk' => 500,
    'expire_days' => 7,
    'export_max' => 10000,
    'job_timeout' => 600,
];
```

`database/migrations/2026_10_08_000001_create_import_batches_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('modul', 20);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nama_berkas');
            $table->string('path');
            $table->string('path_hasil')->nullable();
            $table->string('status', 20)->default('memeriksa');
            $table->unsignedInteger('total_baris')->default(0);
            $table->unsignedInteger('jumlah_baru')->default(0);
            $table->unsignedInteger('jumlah_duplikat')->default(0);
            $table->unsignedInteger('jumlah_error')->default(0);
            $table->unsignedInteger('jumlah_masuk')->default(0);
            $table->unsignedInteger('progres')->default(0);
            $table->text('pesan')->nullable();
            $table->timestamps();

            $table->index(['modul', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};
```

`app/Models/ImportBatch.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportBatch extends Model
{
    public const MEMERIKSA = 'memeriksa';

    public const SIAP = 'siap';

    public const MEMPROSES = 'memproses';

    public const SELESAI = 'selesai';

    public const GAGAL = 'gagal';

    public const KEDALUWARSA = 'kedaluwarsa';

    protected $fillable = [
        'modul', 'user_id', 'nama_berkas', 'path', 'path_hasil', 'status', 'total_baris',
        'jumlah_baru', 'jumlah_duplikat', 'jumlah_error', 'jumlah_masuk', 'progres', 'pesan',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

`database/seeders/PermissionSeeder.php`:

```php
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
```

`database/seeders/DatabaseSeeder.php`: tambahkan `PermissionSeeder::class,` tepat setelah `RoleSeeder::class,`.

`app/Http/Middleware/HandleInertiaRequests.php`: di dalam array `'user'` setelah baris `'roles' => ...`, tambahkan:

```php
                    'permissions' => $request->user()->getAllPermissions()->pluck('name')->values()->all(),
```

`resources/js/types/index.d.ts`: di `interface AuthUser` tambahkan `permissions: string[];` setelah `roles: string[];`.

`config/queue.php`: ubah `'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 90),` menjadi `... env('DB_QUEUE_RETRY_AFTER', 900),`. Di `.env.example` tambahkan baris `DB_QUEUE_RETRY_AFTER=900` tepat setelah `QUEUE_CONNECTION=database`.

`tests/Pest.php` (tambahkan di akhir berkas):

```php
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
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportFoundationTest` lalu `php artisan test` (seluruh suite; props Inertia bersama berubah, pastikan tidak ada test lama yang mengasersikan `auth.user` persis).
Expected: PASS semua. Bila ada test lama gagal karena `permissions`, perbarui asersi test itu agar memperbolehkan kunci baru.

- [ ] **Step 5: Commit**

```bash
git add config/import.php config/queue.php .env.example database/migrations/2026_10_08_000001_create_import_batches_table.php app/Models/ImportBatch.php database/seeders/PermissionSeeder.php database/seeders/DatabaseSeeder.php app/Http/Middleware/HandleInertiaRequests.php resources/js/types/index.d.ts tests/Pest.php tests/Feature/ImportFoundationTest.php
git commit -m "feat(import): add import_batches, permissions, config and shared permission props"
```

---

### Task 2: Pembaca dan penulis Excel (`ExcelRows`, `TabularExcel`)

**Files:**
- Create: `app/Support/ExcelRows.php`, `app/Support/TabularExcel.php`, `tests/Feature/ImportExcelTest.php`

**Interfaces:**
- Consumes: helper `impXlsx` (Task 1).
- Produces:
  - `ExcelRows::totalRows(string $path): int` (baris data, tanpa header)
  - `ExcelRows::headers(string $path, int $count): list<string>` (header baris 1, sudah di-trim)
  - `ExcelRows::chunks(string $path, array $headers, int $size): Generator<array<int, array<string, mixed>>>`: tiap elemen = chunk `[nomorBarisExcel => [header => nilai]]`, baris kosong dilewati tetapi nomor baris tetap asli, nilai mentah (sel tanggal = float, sel teks = string).
  - `TabularExcel::build(array $headers, iterable $rows, array $petunjuk = []): Spreadsheet` (sheet `Data`, plus sheet `Petunjuk` bila `$petunjuk` tidak kosong; string selalu disimpan sebagai teks)
  - `TabularExcel::download(Spreadsheet $book, string $filename): StreamedResponse`

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportExcelTest.php`:

```php
<?php

use App\Support\ExcelRows;
use App\Support\TabularExcel;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

function impFlatten(iterable $chunks): array
{
    $all = [];
    foreach ($chunks as $chunk) {
        foreach ($chunk as $no => $row) {
            $all[$no] = $row;
        }
    }

    return $all;
}

it('reads every row exactly once across chunk boundaries', function (int $n) {
    $rows = array_map(fn ($i) => ["item-{$i}", $i], range(1, $n));
    $path = impXlsx(['Nama', 'Nomor'], $rows)->getPathname();

    $all = impFlatten(ExcelRows::chunks($path, ['Nama', 'Nomor'], 500));

    expect(ExcelRows::totalRows($path))->toBe($n)
        ->and($all)->toHaveCount($n)
        ->and(array_key_first($all))->toBe(2)
        ->and(array_key_last($all))->toBe($n + 1)
        ->and($all[$n + 1])->toEqual(['Nama' => "item-{$n}", 'Nomor' => $n]);
})->with([499, 500, 501]);

it('skips blank rows but keeps the original Excel row numbers', function () {
    $path = impXlsx(['A', 'B'], [['x', 1], [null, null], ['y', 2]])->getPathname();

    $all = impFlatten(ExcelRows::chunks($path, ['A', 'B'], 500));

    expect(array_keys($all))->toBe([2, 4])
        ->and($all[4])->toEqual(['A' => 'y', 'B' => 2]);
});

it('returns the trimmed header row', function () {
    $path = impXlsx(['  Nama ', 'Nomor'], [['x', 1]])->getPathname();

    expect(ExcelRows::headers($path, 2))->toBe(['Nama', 'Nomor']);
});

it('counts zero data rows for a header-only file', function () {
    $path = impXlsx(['A', 'B'], [])->getPathname();

    expect(ExcelRows::totalRows($path))->toBe(0)
        ->and(impFlatten(ExcelRows::chunks($path, ['A', 'B'], 500)))->toBe([]);
});

it('writes strings as text so formula-looking cells are never executed', function () {
    $book = TabularExcel::build(['Nama', 'Jumlah'], [['=SUM(1+1)', 5], ['@cmd', 7.5], ['0007', null]], ['Baris petunjuk']);
    $path = tempnam(sys_get_temp_dir(), 'tab').'.xlsx';
    (new Xlsx($book))->save($path);

    $loaded = IOFactory::load($path);
    $data = $loaded->getSheetByName('Data');

    expect($loaded->getSheetNames())->toBe(['Data', 'Petunjuk'])
        ->and($data->getCell('A2')->getDataType())->toBe(DataType::TYPE_STRING)
        ->and($data->getCell('A2')->getValue())->toBe('=SUM(1+1)')
        ->and($data->getCell('B2')->getValue())->toEqual(5)
        ->and($data->getCell('A4')->getValue())->toBe('0007')
        ->and($data->getCell('B4')->getValue())->toBeNull()
        ->and($loaded->getSheetByName('Petunjuk')->getCell('A1')->getValue())->toBe('Baris petunjuk');
});

it('has no Petunjuk sheet when none is given', function () {
    expect(TabularExcel::build(['A'], [['x']])->getSheetNames())->toBe(['Data']);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportExcelTest`
Expected: FAIL (kelas tidak ada).

- [ ] **Step 3: Implementasi**

`app/Support/ExcelRows.php`:

```php
<?php

namespace App\Support;

use Generator;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;

/**
 * Membaca sheet pertama .xlsx per jendela baris agar memori tetap kecil
 * (satu berkas besar pernah menghabiskan 128 MB bila dimuat utuh).
 */
final class ExcelRows implements IReadFilter
{
    private int $from = 1;

    private int $to = 1;

    public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
    {
        return $row >= $this->from && $row <= $this->to;
    }

    /** Jumlah baris di bawah header (baris kosong ikut terhitung). */
    public static function totalRows(string $path): int
    {
        $info = (new Xlsx)->listWorksheetInfo($path)[0] ?? null;

        return max(0, ($info['totalRows'] ?? 0) - 1);
    }

    /** @return list<string> */
    public static function headers(string $path, int $count): array
    {
        return array_map(fn ($v) => trim((string) $v), (new self)->read($path, 1, 1, $count)[0] ?? []);
    }

    /**
     * @param  list<string>  $headers
     * @return Generator<int, array<int, array<string, mixed>>>
     */
    public static function chunks(string $path, array $headers, int $size): Generator
    {
        $reader = new self;
        $last = self::totalRows($path) + 1;

        for ($start = 2; $start <= $last; $start += $size) {
            $rows = [];

            foreach ($reader->read($path, $start, min($start + $size - 1, $last), count($headers)) as $i => $values) {
                $filled = array_filter($values, fn ($v) => $v !== null && trim((string) $v) !== '');

                if ($filled !== []) {
                    $rows[$start + $i] = array_combine($headers, $values);
                }
            }

            yield $rows;
        }
    }

    /** @return list<list<mixed>> */
    private function read(string $path, int $from, int $to, int $columns): array
    {
        $this->from = $from;
        $this->to = $to;

        $xlsx = new Xlsx;
        $xlsx->setReadDataOnly(true);
        $xlsx->setReadFilter($this);
        $xlsx->setLoadSheetsOnly([$xlsx->listWorksheetNames($path)[0]]);

        $book = $xlsx->load($path);
        $values = $book->getActiveSheet()->rangeToArray(
            'A'.$from.':'.Coordinate::stringFromColumnIndex($columns).$to,
            null, true, false, false,
        );
        $book->disconnectWorksheets();

        return $values;
    }
}
```

`app/Support/TabularExcel.php`:

```php
<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Penulis tabular polos untuk template, ekspor, dan laporan error import. */
final class TabularExcel
{
    /**
     * ponytail: dibangun di memori oleh PhpSpreadsheet; aman sampai batas ekspor 10.000 baris,
     * di atas itu perlu penulis streaming.
     *
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     * @param  list<string>  $petunjuk
     */
    public static function build(array $headers, iterable $rows, array $petunjuk = []): Spreadsheet
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Data');

        $write = function (int $r, array $row) use ($sheet) {
            foreach (array_values($row) as $c => $value) {
                if ($value === null || $value === '') {
                    continue;
                }

                $cell = Coordinate::stringFromColumnIndex($c + 1).$r;
                is_string($value)
                    ? $sheet->setCellValueExplicit($cell, $value, DataType::TYPE_STRING)
                    : $sheet->setCellValue($cell, $value);
            }
        };

        $write(1, $headers);
        $r = 2;
        foreach ($rows as $row) {
            $write($r++, $row);
        }

        $sheet->getStyle('A1:'.Coordinate::stringFromColumnIndex(count($headers)).'1')->getFont()->setBold(true);
        $sheet->freezePane('A2');
        foreach (range(1, count($headers)) as $i) {
            $sheet->getColumnDimensionByColumn($i)->setWidth(18);
        }

        if ($petunjuk !== []) {
            $help = $book->createSheet()->setTitle('Petunjuk');
            foreach ($petunjuk as $i => $line) {
                $help->setCellValueExplicit('A'.($i + 1), $line, DataType::TYPE_STRING);
            }
            $help->getColumnDimension('A')->setWidth(110);
        }

        $book->setActiveSheetIndex(0);

        return $book;
    }

    public static function download(Spreadsheet $book, string $filename): StreamedResponse
    {
        return response()->streamDownload(
            fn () => (new Xlsx($book))->save('php://output'),
            $filename,
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportExcelTest`
Expected: PASS (8 test termasuk dataset 499/500/501).

- [ ] **Step 5: Commit**

```bash
git add app/Support/ExcelRows.php app/Support/TabularExcel.php tests/Feature/ImportExcelTest.php
git commit -m "feat(import): chunked xlsx reader and tabular xlsx writer"
```

---

### Task 3: Kontrak `Importer` + `KategoriImporter`

**Files:**
- Create: `app/Imports/RowResult.php`, `app/Imports/Importer.php`, `app/Imports/KategoriImporter.php`, `tests/Feature/ImportKategoriTest.php`

**Interfaces:**
- Produces:
  - `RowResult` dengan `status` (`'baru'|'duplikat'|'error'`), `data: array`, `errors: list<array{kolom:string,alasan:string}>`, `warning: ?string`; pembuat `RowResult::baru(array $data, ?string $warning=null)`, `::duplikat()`, `::error(array $errors)`.
  - `abstract class Importer` dengan metode abstrak `headers(): list<string>`, `contoh(): array`, `petunjuk(): list<string>`, `validate(array $row): RowResult`, `save(array $data): void`, `export(array $filters): iterable`, `exportCount(array $filters): int`; metode konkret `begin(User $actor): void` dan helper terlindungi `cell(array $row, string $header): string`, `required(array $row, string $header, int $max, array &$errors): string`, `optional(...)` (tanda tangan sama), `err(array &$errors, string $kolom, string $alasan): void`, `unit(string $name, array &$errors): ?int`; properti terlindungi `$actor`, `$seen`.
  - `KategoriImporter` (tanpa dependensi konstruktor).

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportKategoriTest.php`:

```php
<?php

use App\Imports\KategoriImporter;
use App\Models\AssetCategory;

function impKat(array $o = []): array
{
    return array_merge([
        'Kategori' => 'ELEKTRONIK', 'Kode Kategori' => null, 'Subkategori' => 'LAPTOP',
        'Kode Subkategori' => '1.3.2.10.02.03', 'Keterangan' => null,
    ], $o);
}

beforeEach(function () {
    $this->importer = app(KategoriImporter::class);
    $this->importer->begin(userWithRole('kasubag'));
});

it('accepts a new subcategory row', function () {
    $r = $this->importer->validate(impKat());

    expect($r->status)->toBe('baru')
        ->and($r->data)->toMatchArray(['kategori' => 'ELEKTRONIK', 'subkategori' => 'LAPTOP', 'kode_sub' => '1.3.2.10.02.03']);
});

it('rejects a missing category and over-long names', function () {
    $missing = $this->importer->validate(impKat(['Kategori' => '  ']));
    $long = $this->importer->validate(impKat(['Subkategori' => str_repeat('x', 101)]));

    expect($missing->status)->toBe('error')
        ->and($missing->errors[0]['kolom'])->toBe('Kategori')
        ->and($long->status)->toBe('error')
        ->and($long->errors[0]['kolom'])->toBe('Subkategori');
});

it('flags rows already in the database as duplicates regardless of case', function () {
    $parent = AssetCategory::create(['name' => 'ELEKTRONIK']);
    AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $parent->id]);

    expect($this->importer->validate(impKat(['Kategori' => 'elektronik ', 'Subkategori' => 'laptop']))->status)->toBe('duplikat')
        ->and($this->importer->validate(impKat(['Subkategori' => 'PRINTER']))->status)->toBe('baru')
        ->and($this->importer->validate(impKat(['Subkategori' => null]))->status)->toBe('duplikat');
});

it('flags the same row twice in one file as a duplicate', function () {
    expect($this->importer->validate(impKat())->status)->toBe('baru')
        ->and($this->importer->validate(impKat())->status)->toBe('duplikat');
});

it('creates the parent from its first subcategory row and reuses it afterwards', function () {
    $this->importer->save($this->importer->validate(impKat(['Kode Kategori' => '1.3.2.10']))->data);
    $this->importer->save($this->importer->validate(impKat(['Subkategori' => 'PRINTER', 'Kode Subkategori' => null]))->data);

    $parent = AssetCategory::whereNull('parent_id')->where('name', 'ELEKTRONIK')->first();

    expect(AssetCategory::whereNull('parent_id')->count())->toBe(1)
        ->and($parent->code)->toBe('1.3.2.10')
        ->and($parent->children()->pluck('name')->sort()->values()->all())->toBe(['LAPTOP', 'PRINTER']);
});

it('saves a parent-only row as a category without subcategories', function () {
    $this->importer->save($this->importer->validate(impKat(['Kategori' => 'PERALATAN', 'Subkategori' => null, 'Keterangan' => 'Induk']))->data);

    $parent = AssetCategory::where('name', 'PERALATAN')->first();

    expect($parent->parent_id)->toBeNull()
        ->and($parent->description)->toBe('Induk')
        ->and($parent->children()->count())->toBe(0);
});

it('exports subcategory rows and parent-only rows in template column order', function () {
    $a = AssetCategory::create(['name' => 'ALAT KANTOR', 'code' => '1.3.2.05']);
    AssetCategory::create(['name' => 'MEJA', 'parent_id' => $a->id, 'code' => '1.3.2.05.02.04', 'description' => 'Meja kerja']);
    AssetCategory::create(['name' => 'KOSONG']);

    $rows = iterator_to_array($this->importer->export([]), false);

    expect($this->importer->headers())->toBe(['Kategori', 'Kode Kategori', 'Subkategori', 'Kode Subkategori', 'Keterangan'])
        ->and($rows)->toBe([
            ['ALAT KANTOR', '1.3.2.05', 'MEJA', '1.3.2.05.02.04', 'Meja kerja'],
            ['KOSONG', null, '', '', null],
        ])
        ->and($this->importer->exportCount([]))->toBe(3);
});

it('reads numeric cells as full digit strings, not scientific notation', function () {
    $r = $this->importer->validate(impKat(['Kode Kategori' => 123456789012.0]));

    expect($r->data['kode_kategori'])->toBe('123456789012');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportKategoriTest`
Expected: FAIL (kelas tidak ada).

- [ ] **Step 3: Implementasi**

`app/Imports/RowResult.php`:

```php
<?php

namespace App\Imports;

final class RowResult
{
    public const BARU = 'baru';

    public const DUPLIKAT = 'duplikat';

    public const ERROR = 'error';

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{kolom: string, alasan: string}>  $errors
     */
    private function __construct(
        public readonly string $status,
        public readonly array $data = [],
        public readonly array $errors = [],
        public readonly ?string $warning = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function baru(array $data, ?string $warning = null): self
    {
        return new self(self::BARU, $data, [], $warning);
    }

    public static function duplikat(): self
    {
        return new self(self::DUPLIKAT);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    public static function error(array $errors): self
    {
        return new self(self::ERROR, [], $errors);
    }
}
```

`app/Imports/Importer.php`:

```php
<?php

namespace App\Imports;

use App\Models\Unit;
use App\Models\User;

/** Kontrak per modul + helper bersama. Mesin import tidak tahu apa pun tentang aset atau pegawai. */
abstract class Importer
{
    protected User $actor;

    /** @var array<string, true> */
    protected array $seen = [];

    /** @var array<string, int>|null */
    private ?array $units = null;

    /** @return list<string> */
    abstract public function headers(): array;

    /** @return array<int, mixed> */
    abstract public function contoh(): array;

    /** @return list<string> */
    abstract public function petunjuk(): array;

    /** @param array<string, mixed> $row baris mentah, kunci = header */
    abstract public function validate(array $row): RowResult;

    /** @param array<string, mixed> $data RowResult::$data dari baris berstatus baru */
    abstract public function save(array $data): void;

    /**
     * @param  array<string, mixed>  $filters
     * @return iterable<array<int, mixed>>
     */
    abstract public function export(array $filters): iterable;

    /** @param array<string, mixed> $filters */
    abstract public function exportCount(array $filters): int;

    public function begin(User $actor): void
    {
        $this->actor = $actor;
        $this->seen = [];
        $this->units = null;
    }

    /** Sel sebagai teks ber-trim; angka utuh tidak menjadi notasi ilmiah. */
    protected function cell(array $row, string $header): string
    {
        $value = $row[$header] ?? null;

        if (is_float($value) && floor($value) == $value) {
            return number_format($value, 0, '', '');
        }

        return trim((string) $value);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function required(array $row, string $header, int $max, array &$errors): string
    {
        $value = $this->cell($row, $header);

        if ($value === '') {
            $this->err($errors, $header, "{$header} wajib diisi.");
        }

        return $this->limit($value, $header, $max, $errors);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function optional(array $row, string $header, int $max, array &$errors): string
    {
        return $this->limit($this->cell($row, $header), $header, $max, $errors);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    protected function err(array &$errors, string $kolom, string $alasan): void
    {
        $errors[] = ['kolom' => $kolom, 'alasan' => $alasan];
    }

    /** Unit dicocokkan lewat nama dan harus dalam cakupan pengimpor. @param list<array{kolom: string, alasan: string}> $errors */
    protected function unit(string $name, array &$errors): ?int
    {
        if ($name === '') {
            $this->err($errors, 'Unit', 'Unit wajib diisi.');

            return null;
        }

        $this->units ??= Unit::query()->pluck('id', 'name')
            ->mapWithKeys(fn ($id, $unit) => [mb_strtolower(trim($unit)) => (int) $id])->all();

        $id = $this->units[mb_strtolower($name)] ?? null;

        if ($id === null) {
            $this->err($errors, 'Unit', "Unit \"{$name}\" tidak dikenal.");

            return null;
        }

        $scope = $this->actor->accessibleUnitIds();

        if ($scope !== null && ! in_array($id, $scope, true)) {
            $this->err($errors, 'Unit', "Unit \"{$name}\" di luar cakupan Anda.");

            return null;
        }

        return $id;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function limit(string $value, string $header, int $max, array &$errors): string
    {
        if (mb_strlen($value) > $max) {
            $this->err($errors, $header, "{$header} maksimal {$max} karakter.");
        }

        return $value;
    }
}
```

`app/Imports/KategoriImporter.php`:

```php
<?php

namespace App\Imports;

use App\Models\AssetCategory;

class KategoriImporter extends Importer
{
    public function headers(): array
    {
        return ['Kategori', 'Kode Kategori', 'Subkategori', 'Kode Subkategori', 'Keterangan'];
    }

    public function contoh(): array
    {
        return ['ALAT KANTOR', '1.3.2.05', 'MEJA', '1.3.2.05.02.04', 'Meja kerja pegawai'];
    }

    public function petunjuk(): array
    {
        return [
            'Satu baris = satu subkategori. Kosongkan kolom Subkategori bila baris hanya mendefinisikan kategori utama.',
            'Kategori utama yang belum ada dibuat otomatis dari baris subkategorinya.',
            'Baris yang sudah ada di sistem (nama sama, tidak peka huruf besar-kecil) dilewati.',
            'Hapus baris contoh sebelum mengunggah.',
        ];
    }

    public function validate(array $row): RowResult
    {
        $errors = [];
        $kategori = $this->required($row, 'Kategori', 100, $errors);
        $sub = $this->optional($row, 'Subkategori', 100, $errors);
        $kodeKategori = $this->optional($row, 'Kode Kategori', 50, $errors);
        $kodeSub = $this->optional($row, 'Kode Subkategori', 50, $errors);
        $keterangan = $this->optional($row, 'Keterangan', 500, $errors);

        if ($errors !== []) {
            return RowResult::error($errors);
        }

        $key = mb_strtolower($kategori).'|'.mb_strtolower($sub);

        if (isset($this->seen[$key])) {
            return RowResult::duplikat();
        }
        $this->seen[$key] = true;

        $parent = $this->parent($kategori);
        $exists = $sub === ''
            ? $parent !== null
            : $parent !== null && AssetCategory::where('parent_id', $parent->id)
                ->whereRaw('lower(name) = ?', [mb_strtolower($sub)])->exists();

        return $exists ? RowResult::duplikat() : RowResult::baru([
            'kategori' => $kategori,
            'kode_kategori' => $kodeKategori,
            'subkategori' => $sub,
            'kode_sub' => $kodeSub,
            'keterangan' => $keterangan,
        ]);
    }

    public function save(array $data): void
    {
        $parent = $this->parent($data['kategori']) ?? AssetCategory::create([
            'name' => $data['kategori'],
            'code' => $data['kode_kategori'] ?: null,
            'description' => $data['subkategori'] === '' ? ($data['keterangan'] ?: null) : null,
        ]);

        if ($data['subkategori'] === '') {
            return;
        }

        AssetCategory::create([
            'name' => $data['subkategori'],
            'parent_id' => $parent->id,
            'code' => $data['kode_sub'] ?: null,
            'description' => $data['keterangan'] ?: null,
        ]);
    }

    public function export(array $filters): iterable
    {
        $parents = AssetCategory::query()->whereNull('parent_id')
            ->with(['children' => fn ($q) => $q->orderBy('name')])->orderBy('name')->get();

        foreach ($parents as $parent) {
            if ($parent->children->isEmpty()) {
                yield [$parent->name, $parent->code, '', '', $parent->description];

                continue;
            }

            foreach ($parent->children as $child) {
                yield [$parent->name, $parent->code, $child->name, $child->code, $child->description];
            }
        }
    }

    public function exportCount(array $filters): int
    {
        return AssetCategory::count();
    }

    private function parent(string $name): ?AssetCategory
    {
        return AssetCategory::whereNull('parent_id')->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first();
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportKategoriTest`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add app/Imports/RowResult.php app/Imports/Importer.php app/Imports/KategoriImporter.php tests/Feature/ImportKategoriTest.php
git commit -m "feat(import): importer contract and kategori importer"
```

---

### Task 4: `PegawaiImporter`

**Files:**
- Create: `app/Imports/PegawaiImporter.php`, `tests/Feature/ImportPegawaiTest.php`

**Interfaces:**
- Consumes: `Importer` helpers (Task 3), `App\Models\Pegawai` (`scopeVisibleTo`).
- Produces: `PegawaiImporter` (tanpa dependensi konstruktor); `ImportService::MODUL['pegawai']` memakainya di Task 6.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportPegawaiTest.php`:

```php
<?php

use App\Imports\PegawaiImporter;
use App\Models\Pegawai;

function impPeg(array $o = []): array
{
    return array_merge([
        'Nama' => 'Budi Santoso', 'NIP' => '198001012005011001', 'Pangkat/Golongan' => 'III/a',
        'Jabatan' => 'Staf', 'Status Kepegawaian' => 'PNS', 'Unit' => 'Kelurahan A',
        'No. HP' => '0812', 'Email Dinas' => 'budi@batam.go.id',
    ], $o);
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->importer = app(PegawaiImporter::class);
    $this->importer->begin(userWithRole('kasubag'));
});

it('accepts a valid row and normalises the status', function () {
    $r = $this->importer->validate(impPeg(['Status Kepegawaian' => ' pppk ']));

    expect($r->status)->toBe('baru')
        ->and($r->data)->toMatchArray(['nama' => 'Budi Santoso', 'status' => 'pppk', 'unit_id' => $this->kelA->id]);
});

it('rejects missing required columns, bad status and unknown units', function () {
    $r = $this->importer->validate(impPeg(['Nama' => null, 'Jabatan' => '', 'Status Kepegawaian' => 'Honorer', 'Unit' => 'Kelurahan Z']));

    expect($r->status)->toBe('error')
        ->and(collect($r->errors)->pluck('kolom')->sort()->values()->all())
        ->toBe(['Jabatan', 'Nama', 'Status Kepegawaian', 'Unit']);
});

it('rejects a unit outside the importing account scope', function () {
    $importer = app(PegawaiImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));

    expect($importer->validate(impPeg(['Unit' => 'Kelurahan A']))->status)->toBe('baru')
        ->and($importer->validate(impPeg(['NIP' => '2', 'Unit' => 'Kelurahan B']))->errors[0]['alasan'])->toContain('di luar cakupan');
});

it('treats an existing NIP as a duplicate, in the database and within the file', function () {
    Pegawai::create(['nama' => 'Lama', 'nip' => '198001012005011001', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    expect($this->importer->validate(impPeg())->status)->toBe('duplikat')
        ->and($this->importer->validate(impPeg(['NIP' => '555']))->status)->toBe('baru')
        ->and($this->importer->validate(impPeg(['NIP' => '555', 'Nama' => 'Lain']))->status)->toBe('duplikat');
});

it('falls back to name plus unit when the NIP is empty', function () {
    Pegawai::create(['nama' => 'Siti', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    expect($this->importer->validate(impPeg(['NIP' => null, 'Nama' => 'siti ']))->status)->toBe('duplikat')
        ->and($this->importer->validate(impPeg(['NIP' => null, 'Nama' => 'Siti', 'Unit' => 'Kelurahan B']))->status)->toBe('baru');
});

it('reads a NIP typed as a number as its full digits', function () {
    $r = $this->importer->validate(impPeg(['NIP' => 198001012005.0]));

    expect($r->data['nip'])->toBe('198001012005');
});

it('saves the pegawai with the resolved unit and nullable optional fields', function () {
    $this->importer->save($this->importer->validate(impPeg(['NIP' => null, 'No. HP' => null, 'Email Dinas' => null]))->data);

    $p = Pegawai::first();

    expect($p->nama)->toBe('Budi Santoso')
        ->and($p->unit_id)->toBe($this->kelA->id)
        ->and($p->status_kepegawaian->value)->toBe('pns')
        ->and($p->nip)->toBeNull();
});

it('exports only pegawai visible to the actor, in template column order', function () {
    Pegawai::create(['nama' => 'A', 'nip' => '1', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pppk', 'unit_id' => $this->kelA->id]);
    Pegawai::create(['nama' => 'B', 'nip' => '2', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelB->id]);

    $importer = app(PegawaiImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));
    $rows = iterator_to_array($importer->export([]), false);

    expect($importer->headers())->toBe(['Nama', 'NIP', 'Pangkat/Golongan', 'Jabatan', 'Status Kepegawaian', 'Unit', 'No. HP', 'Email Dinas'])
        ->and($rows)->toBe([['A', '1', null, 'Staf', 'PPPK', 'Kelurahan A', null, null]])
        ->and($importer->exportCount([]))->toBe(1);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportPegawaiTest`
Expected: FAIL (kelas tidak ada).

- [ ] **Step 3: Implementasi**

`app/Imports/PegawaiImporter.php`:

```php
<?php

namespace App\Imports;

use App\Models\Pegawai;

class PegawaiImporter extends Importer
{
    public function headers(): array
    {
        return ['Nama', 'NIP', 'Pangkat/Golongan', 'Jabatan', 'Status Kepegawaian', 'Unit', 'No. HP', 'Email Dinas'];
    }

    public function contoh(): array
    {
        return ['Budi Santoso', '198001012005011001', 'III/a', 'Staf Pelayanan', 'PNS', 'Kelurahan Sungai Pelunggut', '081234567890', 'budi@batam.go.id'];
    }

    public function petunjuk(): array
    {
        return [
            'Status Kepegawaian diisi PNS atau PPPK. Unit ditulis persis seperti nama unit di sistem.',
            'Format kolom NIP sebagai Teks agar 18 digit tidak berubah menjadi notasi ilmiah.',
            'Baris dengan NIP yang sudah ada dilewati. Tanpa NIP, pasangan Nama + Unit dipakai sebagai kunci.',
            'Foto profil dan akun login tidak diimpor. Hapus baris contoh sebelum mengunggah.',
        ];
    }

    public function validate(array $row): RowResult
    {
        $errors = [];
        $nama = $this->required($row, 'Nama', 255, $errors);
        $nip = $this->optional($row, 'NIP', 30, $errors);
        $pangkat = $this->optional($row, 'Pangkat/Golongan', 100, $errors);
        $jabatan = $this->required($row, 'Jabatan', 150, $errors);
        $status = mb_strtolower($this->required($row, 'Status Kepegawaian', 20, $errors));
        $unitId = $this->unit($this->cell($row, 'Unit'), $errors);
        $hp = $this->optional($row, 'No. HP', 50, $errors);
        $email = $this->optional($row, 'Email Dinas', 150, $errors);

        if ($status !== '' && ! in_array($status, ['pns', 'pppk'], true)) {
            $this->err($errors, 'Status Kepegawaian', 'Status harus PNS atau PPPK.');
        }

        if ($errors !== []) {
            return RowResult::error($errors);
        }

        $key = $nip !== '' ? "nip:{$nip}" : 'nm:'.mb_strtolower($nama).'|'.$unitId;

        if (isset($this->seen[$key])) {
            return RowResult::duplikat();
        }
        $this->seen[$key] = true;

        $exists = $nip !== ''
            ? Pegawai::where('nip', $nip)->exists()
            : Pegawai::where('unit_id', $unitId)->whereRaw('lower(nama) = ?', [mb_strtolower($nama)])->exists();

        return $exists ? RowResult::duplikat() : RowResult::baru([
            'nama' => $nama, 'nip' => $nip, 'pangkat' => $pangkat, 'jabatan' => $jabatan,
            'status' => $status, 'unit_id' => $unitId, 'no_hp' => $hp, 'email_dinas' => $email,
        ]);
    }

    public function save(array $data): void
    {
        Pegawai::create([
            'nama' => $data['nama'],
            'nip' => $data['nip'] ?: null,
            'pangkat_golongan' => $data['pangkat'] ?: null,
            'jabatan' => $data['jabatan'],
            'status_kepegawaian' => $data['status'],
            'unit_id' => $data['unit_id'],
            'no_hp' => $data['no_hp'] ?: null,
            'email_dinas' => $data['email_dinas'] ?: null,
        ]);
    }

    public function export(array $filters): iterable
    {
        foreach ($this->query()->with('unit')->orderBy('nama')->lazy(500) as $p) {
            yield [
                $p->nama, $p->nip, $p->pangkat_golongan, $p->jabatan,
                strtoupper($p->status_kepegawaian->value), $p->unit->name, $p->no_hp, $p->email_dinas,
            ];
        }
    }

    public function exportCount(array $filters): int
    {
        return $this->query()->count();
    }

    private function query()
    {
        return Pegawai::query()->visibleTo($this->actor);
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportPegawaiTest`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add app/Imports/PegawaiImporter.php tests/Feature/ImportPegawaiTest.php
git commit -m "feat(import): pegawai importer"
```

---

### Task 5: `AsetImporter` + `queryVisibleTo` pada repository

**Files:**
- Create: `app/Imports/AsetImporter.php`, `tests/Feature/ImportAsetTest.php`
- Modify: `app/Repositories/Contracts/AssetRepositoryInterface.php`, `app/Repositories/EloquentAssetRepository.php:14-38`

**Interfaces:**
- Consumes: `Importer` (Task 3), `AssetRepositoryInterface::maxRegisterNumber(string): int`.
- Produces: `AssetRepositoryInterface::queryVisibleTo(User $user, array $filters): Builder` (query berurut + filter, `paginateVisibleTo` memakainya); `AsetImporter` (konstruktor menerima `AssetRepositoryInterface`).

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportAsetTest.php`:

```php
<?php

use App\Imports\AsetImporter;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;

function impAset(array $o = []): array
{
    return array_merge([
        'Kode Barang' => '1.3.2.05.02.04.004', 'No. Register' => 7, 'Nama Aset' => 'Meja Kerja',
        'Kategori' => 'ALAT KANTOR', 'Subkategori' => 'MEJA', 'Merk/Tipe' => 'Informa',
        'Tanggal Perolehan' => '14-06-2023', 'Sumber Perolehan' => 'Belanja Modal',
        'Harga Perolehan' => 1000000, 'Nilai Buku' => 800000, 'Kondisi' => 'Baik',
        'Unit' => 'Kelurahan A', 'Penanggung Jawab' => null, 'No. Dokumen' => 'DOC-1', 'Keterangan' => null,
    ], $o);
}

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->importer = app(AsetImporter::class);
    $this->importer->begin(userWithRole('kasubag'));
});

it('accepts a fully valid row and normalises it', function () {
    $r = $this->importer->validate(impAset());

    expect($r->status)->toBe('baru')
        ->and($r->warning)->toBeNull()
        ->and($r->data)->toMatchArray([
            'kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 7, 'category_id' => $this->meja->id,
            'unit_id' => $this->kelA->id, 'tanggal_perolehan' => '2023-06-14', 'kondisi' => 'baik',
            'nilai_perolehan' => 1000000.0, 'nilai_buku' => 800000.0,
        ]);
});

it('rejects a malformed kode barang and a bad register', function () {
    $r = $this->importer->validate(impAset(['Kode Barang' => 'ABC', 'No. Register' => '0']));

    expect(collect($r->errors)->pluck('kolom')->all())->toBe(['Kode Barang', 'No. Register']);
});

it('requires an existing subcategory and never accepts a top-level category', function () {
    $unknown = $this->importer->validate(impAset(['Subkategori' => 'KURSI']));
    $topLevel = $this->importer->validate(impAset(['Kategori' => 'ALAT KANTOR', 'Subkategori' => 'ALAT KANTOR']));

    expect($unknown->status)->toBe('error')
        ->and($unknown->errors[0]['alasan'])->toContain('Impor kategori terlebih dahulu')
        ->and($topLevel->status)->toBe('error');
});

it('parses text dates, ISO dates and Excel serial dates, and rejects impossible or out-of-range ones', function () {
    $ok = fn ($v) => $this->importer->validate(impAset(['Tanggal Perolehan' => $v, 'No. Register' => random_int(100, 99999), 'No. Dokumen' => null]));

    expect($ok('14-06-2023')->data['tanggal_perolehan'])->toBe('2023-06-14')
        ->and($ok('2023-06-14')->data['tanggal_perolehan'])->toBe('2023-06-14')
        ->and($ok(45091.0)->data['tanggal_perolehan'])->toBe('2023-06-14')
        ->and($ok('31-02-2023')->status)->toBe('error')
        ->and($ok('14-06-0202')->status)->toBe('error')
        ->and($ok('01-01-2999')->status)->toBe('error')
        ->and($ok('kemarin')->status)->toBe('error');
});

it('requires plain numbers for money and nilai buku not above harga perolehan', function () {
    $text = $this->importer->validate(impAset(['Harga Perolehan' => '5.000.000']));
    $over = $this->importer->validate(impAset(['Harga Perolehan' => 100, 'Nilai Buku' => 200]));
    $numericText = $this->importer->validate(impAset(['Harga Perolehan' => '5000000', 'Nilai Buku' => '4000000']));

    expect($text->status)->toBe('error')
        ->and($over->errors[0]['kolom'])->toBe('Nilai Buku')
        ->and($numericText->status)->toBe('baru');
});

it('maps kondisi by label and rejects unknown values', function () {
    expect($this->importer->validate(impAset(['Kondisi' => 'rusak berat']))->data['kondisi'])->toBe('rusak_berat')
        ->and($this->importer->validate(impAset(['Kondisi' => 'Bagus', 'No. Register' => 8, 'No. Dokumen' => null]))->status)->toBe('error');
});

it('rejects units that are unknown or outside the importing account scope', function () {
    $importer = app(AsetImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));

    expect($importer->validate(impAset())->status)->toBe('baru')
        ->and($importer->validate(impAset(['Unit' => 'Kelurahan B', 'No. Register' => 8, 'No. Dokumen' => null]))->errors[0]['alasan'])->toContain('di luar cakupan')
        ->and($importer->validate(impAset(['Unit' => 'Nowhere', 'No. Register' => 9, 'No. Dokumen' => null]))->errors[0]['alasan'])->toContain('tidak dikenal');
});

it('resolves the penanggung jawab by name or NIP within the unit and rejects missing or ambiguous ones', function () {
    $budi = Pegawai::create(['nama' => 'Budi', 'nip' => '111', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);
    Pegawai::create(['nama' => 'Sama', 'nip' => '222', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);
    Pegawai::create(['nama' => 'sama', 'nip' => '333', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);
    Pegawai::create(['nama' => 'Luar', 'nip' => '444', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelB->id]);
    $row = fn ($pj, $reg) => impAset(['Penanggung Jawab' => $pj, 'No. Register' => $reg, 'No. Dokumen' => null]);

    expect($this->importer->validate($row('budi', 1))->data['holder_id'])->toBe($budi->id)
        ->and($this->importer->validate($row('111', 2))->data['holder_id'])->toBe($budi->id)
        ->and($this->importer->validate($row(null, 3))->data['holder_id'])->toBeNull()
        ->and($this->importer->validate($row('Luar', 4))->errors[0]['alasan'])->toContain('tidak ditemukan')
        ->and($this->importer->validate($row('Sama', 5))->errors[0]['alasan'])->toContain('lebih dari satu');
});

it('flags (kode barang, register) already in the database or file as duplicates before checking other columns', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 7, 'no_dokumen' => 'DOC-1']);

    expect($this->importer->validate(impAset())->status)->toBe('duplikat')
        ->and($this->importer->validate(impAset(['No. Register' => 8, 'No. Dokumen' => 'DOC-2']))->status)->toBe('baru')
        ->and($this->importer->validate(impAset(['No. Register' => 8, 'No. Dokumen' => 'DOC-3']))->status)->toBe('duplikat');
});

it('rejects a no. dokumen already used by another asset or earlier in the file', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '9.9.9', 'nomor_register' => 1, 'no_dokumen' => 'DOC-1']);

    $inDb = $this->importer->validate(impAset());
    $first = $this->importer->validate(impAset(['No. Register' => 8, 'No. Dokumen' => 'DOC-9']));
    $second = $this->importer->validate(impAset(['No. Register' => 9, 'No. Dokumen' => 'DOC-9']));

    expect($inDb->status)->toBe('error')
        ->and($inDb->errors[0]['kolom'])->toBe('No. Dokumen')
        ->and($first->status)->toBe('baru')
        ->and($second->status)->toBe('error');
});

it('accepts a row without register and warns that re-uploading would duplicate it', function () {
    $r = $this->importer->validate(impAset(['No. Register' => null]));

    expect($r->status)->toBe('baru')
        ->and($r->data['nomor_register'])->toBeNull()
        ->and($r->warning)->toContain('Tanpa No. Register');
});

it('assigns the next register, status aktif and a dibuat history when saving', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '1.3.2.05.02.04.004', 'nomor_register' => 7]);
    $budi = Pegawai::create(['nama' => 'Budi', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    $this->importer->save($this->importer->validate(impAset(['No. Register' => null, 'Penanggung Jawab' => 'Budi', 'No. Dokumen' => null]))->data);

    $asset = Asset::where('nomor_register', 8)->first();

    expect($asset->status->value)->toBe('aktif')
        ->and($asset->current_holder_id)->toBe($budi->id)
        ->and($asset->unit_id)->toBe($this->kelA->id)
        ->and((float) $asset->nilai_buku)->toBe(800000.0)
        ->and($asset->histories()->where('event', 'dibuat')->count())->toBe(1);
});

it('keeps a given register when saving', function () {
    $this->importer->save($this->importer->validate(impAset(['No. Register' => 42]))->data);

    expect(Asset::first()->nomor_register)->toBe(42);
});

it('exports visible assets with the template columns so they can be imported again', function () {
    Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '1.3.2.05.02.04.004',
        'nomor_register' => 7, 'nama_aset' => 'Meja Kerja', 'tanggal_perolehan' => '2023-06-14',
        'nilai_perolehan' => 1000000, 'nilai_buku' => 800000, 'kondisi' => 'baik', 'no_dokumen' => 'DOC-1',
    ]);
    Asset::factory()->create(['unit_id' => $this->kelB->id, 'category_id' => $this->meja->id]);

    $importer = app(AsetImporter::class);
    $importer->begin(userWithRole('admin_kelurahan', $this->kelA));
    $rows = iterator_to_array($importer->export([]), false);

    expect($importer->headers())->toHaveCount(15)
        ->and($rows)->toHaveCount(1)
        ->and($rows[0][0])->toBe('1.3.2.05.02.04.004')
        ->and($rows[0][1])->toBe(7)
        ->and($rows[0][3])->toBe('ALAT KANTOR')
        ->and($rows[0][4])->toBe('MEJA')
        ->and($rows[0][6])->toBe('14-06-2023')
        ->and($rows[0][10])->toBe('Baik')
        ->and($rows[0][11])->toBe('Kelurahan A')
        ->and($importer->exportCount([]))->toBe(1);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportAsetTest`
Expected: FAIL (kelas tidak ada).

- [ ] **Step 3: Implementasi**

`app/Repositories/Contracts/AssetRepositoryInterface.php`: tambahkan impor `use Illuminate\Database\Eloquent\Builder;` dan metode setelah `paginateVisibleTo`:

```php
    /**
     * Query aset yang terlihat oleh user, sudah berfilter dan berurutan (dipakai daftar dan ekspor).
     *
     * @param  array{search?: ?string, category_id?: int|string|null, unit_id?: int|string|null, kondisi?: ?string}  $filters
     */
    public function queryVisibleTo(User $user, array $filters): Builder;
```

`app/Repositories/EloquentAssetRepository.php`: ganti seluruh isi metode `paginateVisibleTo` (baris 14-38) dengan dua metode berikut:

```php
    public function paginateVisibleTo(User $user, array $filters, int $perPage = 15): LengthAwarePaginator
    {
        return $this->queryVisibleTo($user, $filters)
            ->with(['category.parent', 'unit', 'photos'])
            ->paginate($perPage)
            ->withQueryString();
    }

    public function queryVisibleTo(User $user, array $filters): Builder
    {
        return Asset::query()
            ->visibleTo($user)
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $query) use ($search) {
                    $query->where('nama_aset', 'like', "%{$search}%")
                        ->orWhere('kode_barang', 'like', "%{$search}%")
                        ->orWhere('no_dokumen', 'like', "%{$search}%");
                });
            })
            ->when($filters['category_id'] ?? null, function (Builder $query, $categoryId) {
                $query->whereIn('category_id', AssetCategory::query()
                    ->where('id', $categoryId)
                    ->orWhere('parent_id', $categoryId)
                    ->pluck('id'));
            })
            ->when($filters['unit_id'] ?? null, fn (Builder $query, $unitId) => $query->where('unit_id', $unitId))
            ->when($filters['kondisi'] ?? null, fn (Builder $query, $kondisi) => $query->where('kondisi', $kondisi))
            ->orderBy('nama_aset')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register');
    }
```

`app/Imports/AsetImporter.php`:

```php
<?php

namespace App\Imports;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\User;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class AsetImporter extends Importer
{
    private const KODE = '/^\d+(\.\d+)+$/';

    private const MAX_NILAI = 9999999999999;

    /** @var array<string, int>|null */
    private ?array $subkategori = null;

    /** @var array<int, list<Pegawai>> */
    private array $pegawai = [];

    public function __construct(private readonly AssetRepositoryInterface $assets) {}

    public function begin(User $actor): void
    {
        parent::begin($actor);
        $this->subkategori = null;
        $this->pegawai = [];
    }

    public function headers(): array
    {
        return [
            'Kode Barang', 'No. Register', 'Nama Aset', 'Kategori', 'Subkategori', 'Merk/Tipe',
            'Tanggal Perolehan', 'Sumber Perolehan', 'Harga Perolehan', 'Nilai Buku', 'Kondisi',
            'Unit', 'Penanggung Jawab', 'No. Dokumen', 'Keterangan',
        ];
    }

    public function contoh(): array
    {
        return [
            '1.3.2.05.02.04.004', 1, 'Meja Kerja', 'ALAT KANTOR', 'MEJA', 'Informa',
            '14-06-2023', 'Belanja Modal', 1000000, 800000, 'Baik',
            'Kelurahan Sungai Pelunggut', 'Budi Santoso', 'DOC-001', '',
        ];
    }

    public function petunjuk(): array
    {
        return [
            'Impor kategori lebih dulu, lalu pegawai, lalu aset. Kategori dan Subkategori harus sudah ada di sistem.',
            'No. Register disarankan diisi. Terisi = dipakai apa adanya dan menjadi kunci duplikat (Kode Barang + No. Register).',
            'Kosong = sistem membuat nomor berikutnya, tetapi mengunggah ulang berkas yang sama akan menggandakan aset.',
            'Tanggal: sel tanggal Excel atau teks dd-mm-yyyy (antara tahun 1900 dan hari ini).',
            'Harga Perolehan dan Nilai Buku: angka murni tanpa titik/koma pemisah. Nilai Buku tidak boleh melebihi Harga Perolehan.',
            'Kondisi: Baik, Rusak Ringan, Rusak Berat, atau Hilang. Unit ditulis persis seperti nama unit di sistem.',
            'Penanggung Jawab (opsional): nama atau NIP pegawai di unit yang sama. No. Dokumen harus unik.',
            'Status aset selalu Aktif. Foto tidak diimpor. Hapus baris contoh sebelum mengunggah.',
        ];
    }

    public function validate(array $row): RowResult
    {
        $errors = [];
        $kode = $this->required($row, 'Kode Barang', 50, $errors);

        if ($kode !== '' && ! preg_match(self::KODE, $kode)) {
            $this->err($errors, 'Kode Barang', 'Format harus angka dipisah titik, mis. 1.3.2.05.02.04.004.');
        }

        $register = $this->register($row, $errors);

        if ($errors === [] && $register !== null
            && (isset($this->seen["ast:{$kode}|{$register}"])
                || Asset::where('kode_barang', $kode)->where('nomor_register', $register)->exists())) {
            return RowResult::duplikat();
        }

        $nama = $this->required($row, 'Nama Aset', 255, $errors);
        $categoryId = $this->subcategory($this->cell($row, 'Kategori'), $this->cell($row, 'Subkategori'), $errors);
        $merk = $this->optional($row, 'Merk/Tipe', 100, $errors);
        $sumber = $this->optional($row, 'Sumber Perolehan', 100, $errors);
        $tanggal = $this->tanggal($row['Tanggal Perolehan'] ?? null, $errors);
        $harga = $this->uang($row, 'Harga Perolehan', $errors);
        $buku = $this->uang($row, 'Nilai Buku', $errors);

        if ($harga !== null && $buku !== null && $buku > $harga) {
            $this->err($errors, 'Nilai Buku', 'Nilai buku tidak boleh melebihi harga perolehan.');
        }

        $kondisi = $this->kondisi($this->cell($row, 'Kondisi'), $errors);
        $unitId = $this->unit($this->cell($row, 'Unit'), $errors);
        $holderId = $unitId !== null ? $this->holder($this->cell($row, 'Penanggung Jawab'), $unitId, $errors) : null;
        $dokumen = $this->optional($row, 'No. Dokumen', 100, $errors);
        $keterangan = $this->optional($row, 'Keterangan', 2000, $errors);

        if ($dokumen !== '' && (isset($this->seen["doc:{$dokumen}"]) || Asset::where('no_dokumen', $dokumen)->exists())) {
            $this->err($errors, 'No. Dokumen', 'No. dokumen ini sudah dipakai aset lain.');
        }

        if ($errors !== []) {
            return RowResult::error($errors);
        }

        if ($register !== null) {
            $this->seen["ast:{$kode}|{$register}"] = true;
        }
        if ($dokumen !== '') {
            $this->seen["doc:{$dokumen}"] = true;
        }

        return RowResult::baru([
            'kode_barang' => $kode, 'nomor_register' => $register, 'nama_aset' => $nama,
            'category_id' => $categoryId, 'merk_type' => $merk, 'tanggal_perolehan' => $tanggal->toDateString(),
            'sumber_perolehan' => $sumber, 'nilai_perolehan' => $harga, 'nilai_buku' => $buku,
            'kondisi' => $kondisi->value, 'unit_id' => $unitId, 'holder_id' => $holderId,
            'no_dokumen' => $dokumen, 'keterangan' => $keterangan,
        ], $register === null ? 'Tanpa No. Register: dibuatkan nomor baru (mengunggah ulang akan menggandakan aset).' : null);
    }

    public function save(array $data): void
    {
        $register = $data['nomor_register'] ?? ($this->assets->maxRegisterNumber($data['kode_barang']) + 1);

        $asset = Asset::create([
            'kode_barang' => $data['kode_barang'],
            'nomor_register' => $register,
            'nama_aset' => $data['nama_aset'],
            'category_id' => $data['category_id'],
            'unit_id' => $data['unit_id'],
            'current_holder_id' => $data['holder_id'],
            'merk_type' => $data['merk_type'] ?: null,
            'kondisi' => $data['kondisi'],
            'status' => AssetStatus::Aktif,
            'tanggal_perolehan' => $data['tanggal_perolehan'],
            'sumber_perolehan' => $data['sumber_perolehan'] ?: null,
            'nilai_perolehan' => $data['nilai_perolehan'],
            'nilai_buku' => $data['nilai_buku'],
            'no_dokumen' => $data['no_dokumen'] ?: null,
            'keterangan' => $data['keterangan'] ?: null,
        ]);

        $asset->histories()->create([
            'event' => 'dibuat',
            'unit_id' => $asset->unit_id,
            'current_holder_id' => $asset->current_holder_id,
            'kondisi' => $asset->kondisi,
            'user_id' => $this->actor->id,
        ]);
    }

    public function export(array $filters): iterable
    {
        $query = $this->assets->queryVisibleTo($this->actor, $filters)->with(['category.parent', 'unit', 'currentHolder']);

        foreach ($query->lazy(500) as $a) {
            yield [
                $a->kode_barang, $a->nomor_register, $a->nama_aset, $a->category?->parent?->name, $a->category?->name,
                $a->merk_type, $a->tanggal_perolehan->format('d-m-Y'), $a->sumber_perolehan,
                (float) $a->nilai_perolehan, (float) $a->nilai_buku, $a->kondisi->label(),
                $a->unit?->name, $a->currentHolder?->nama, $a->no_dokumen, $a->keterangan,
            ];
        }
    }

    public function exportCount(array $filters): int
    {
        return $this->assets->queryVisibleTo($this->actor, $filters)->count();
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function register(array $row, array &$errors): ?int
    {
        $value = $this->cell($row, 'No. Register');

        if ($value === '') {
            return null;
        }

        if (! ctype_digit($value) || (int) $value < 1) {
            $this->err($errors, 'No. Register', 'No. register harus bilangan bulat positif.');

            return null;
        }

        return (int) $value;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function subcategory(string $kategori, string $sub, array &$errors): ?int
    {
        if ($kategori === '' || $sub === '') {
            $this->err($errors, 'Subkategori', 'Kategori dan Subkategori wajib diisi.');

            return null;
        }

        $this->subkategori ??= AssetCategory::query()->whereNotNull('parent_id')->with('parent')->get()
            ->mapWithKeys(fn ($c) => [mb_strtolower($c->parent->name).'|'.mb_strtolower($c->name) => $c->id])->all();

        $id = $this->subkategori[mb_strtolower($kategori).'|'.mb_strtolower($sub)] ?? null;

        if ($id === null) {
            $this->err($errors, 'Subkategori', "Subkategori \"{$sub}\" pada kategori \"{$kategori}\" tidak ditemukan. Impor kategori terlebih dahulu.");
        }

        return $id;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function tanggal(mixed $value, array &$errors): ?Carbon
    {
        $date = $this->parseDate($value);

        if ($date === null) {
            $this->err($errors, 'Tanggal Perolehan', 'Tanggal tidak valid. Pakai sel tanggal Excel atau teks dd-mm-yyyy.');

            return null;
        }

        if ($date->year < 1900 || $date->isFuture()) {
            $this->err($errors, 'Tanggal Perolehan', 'Tanggal perolehan harus antara tahun 1900 dan hari ini.');

            return null;
        }

        return $date;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (is_int($value) || is_float($value)) {
            return $value > 0 ? Carbon::instance(ExcelDate::excelToDateTimeObject($value))->startOfDay() : null;
        }

        $text = trim((string) $value);

        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $text, $m) && checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
            return Carbon::create((int) $m[3], (int) $m[2], (int) $m[1])->startOfDay();
        }

        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return Carbon::create((int) $m[1], (int) $m[2], (int) $m[3])->startOfDay();
        }

        return null;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function uang(array $row, string $header, array &$errors): ?float
    {
        $value = $row[$header] ?? null;

        if ($value === null || trim((string) $value) === '') {
            $this->err($errors, $header, "{$header} wajib diisi.");

            return null;
        }

        if (! is_numeric($value)) {
            $this->err($errors, $header, "{$header} harus berupa angka murni tanpa titik/koma pemisah (contoh 5000000).");

            return null;
        }

        $number = (float) $value;

        if ($number < 0 || $number > self::MAX_NILAI) {
            $this->err($errors, $header, "{$header} di luar rentang yang diizinkan.");

            return null;
        }

        return $number;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function kondisi(string $value, array &$errors): ?Kondisi
    {
        $needle = mb_strtolower($value);

        foreach (Kondisi::cases() as $kondisi) {
            if ($needle === mb_strtolower($kondisi->label()) || $needle === $kondisi->value) {
                return $kondisi;
            }
        }

        $this->err($errors, 'Kondisi', 'Kondisi harus Baik, Rusak Ringan, Rusak Berat, atau Hilang.');

        return null;
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    private function holder(string $value, int $unitId, array &$errors): ?int
    {
        if ($value === '') {
            return null;
        }

        $this->pegawai[$unitId] ??= Pegawai::where('unit_id', $unitId)->get(['id', 'nama', 'nip'])->all();

        $needle = mb_strtolower($value);
        $hits = array_values(array_filter(
            $this->pegawai[$unitId],
            fn ($p) => $p->nip === $value || mb_strtolower($p->nama) === $needle,
        ));

        if (count($hits) === 1) {
            return $hits[0]->id;
        }

        $this->err($errors, 'Penanggung Jawab', $hits === []
            ? "Pegawai \"{$value}\" tidak ditemukan di unit ini."
            : "Nama \"{$value}\" cocok dengan lebih dari satu pegawai; pakai NIP.");

        return null;
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportAsetTest` lalu `php artisan test --filter=Asset` (regresi repository: daftar aset, filter, foto).
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add app/Imports/AsetImporter.php app/Repositories/Contracts/AssetRepositoryInterface.php app/Repositories/EloquentAssetRepository.php tests/Feature/ImportAsetTest.php
git commit -m "feat(import): aset importer and shared visible-assets query"
```

---

### Task 6: `ImportService` + job antrean

**Files:**
- Create: `app/Services/ImportService.php`, `app/Jobs/ProcessImportJob.php`, `tests/Feature/ImportServiceTest.php`

**Interfaces:**
- Consumes: `ExcelRows`, `TabularExcel` (Task 2); `Importer` + tiga importer (Task 3-5); `ImportBatch` (Task 1); helper `impXlsx`.
- Produces (dipakai Task 7-8):
  - `ImportService::MODUL` (`['kategori'=>..., 'pegawai'=>..., 'aset'=>...]`), `ImportService::importer(string $modul): Importer`
  - `upload(string $modul, UploadedFile $file, User $user): ImportBatch` (melempar `ValidationException` dengan kunci `berkas`)
  - `validate(ImportBatch): void`, `confirm(ImportBatch): bool`, `commit(ImportBatch): void`, `fail(int $batchId, Throwable $e): void`, `preview(ImportBatch, int $limit = 50): array{errors: list<array{baris:int,detail:list<array{kolom:string,alasan:string}>}>, peringatan: array<string,int>}`, `errorReport(ImportBatch): Spreadsheet`, `prune(): int` (jumlah batch yang kedaluwarsa)
  - Job: `ProcessImportJob::dispatch(int $batchId, 'validate'|'commit')`

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportServiceTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\ImportBatch;
use App\Services\ImportService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

function impKatFile(array $rows): UploadedFile
{
    return impXlsx(ImportService::importer('kategori')->headers(), $rows);
}

beforeEach(function () {
    Storage::fake('local');
    $this->kasubag = userWithRole('kasubag');
    $this->service = app(ImportService::class);
});

it('validates an upload into a ready batch with counts and a results file', function () {
    $parent = AssetCategory::create(['name' => 'ELEKTRONIK']);
    AssetCategory::create(['name' => 'LAPTOP', 'parent_id' => $parent->id]);

    $batch = $this->service->upload('kategori', impKatFile([
        ['ALAT KANTOR', null, 'MEJA', null, null],
        ['ALAT KANTOR', null, 'KURSI', null, null],
        ['ELEKTRONIK', null, 'LAPTOP', null, null],
        [null, null, 'X', null, null],
    ]), $this->kasubag)->refresh();

    expect($batch->status)->toBe(ImportBatch::SIAP)
        ->and([$batch->total_baris, $batch->jumlah_baru, $batch->jumlah_duplikat, $batch->jumlah_error])->toBe([4, 2, 1, 1])
        ->and(Storage::disk('local')->exists($batch->path_hasil))->toBeTrue()
        ->and(AssetCategory::where('name', 'MEJA')->exists())->toBeFalse();
});

it('commits only the valid rows after confirmation', function () {
    $batch = $this->service->upload('kategori', impKatFile([
        ['ALAT KANTOR', null, 'MEJA', null, null],
        ['ALAT KANTOR', null, 'KURSI', null, null],
        [null, null, 'X', null, null],
    ]), $this->kasubag);

    expect($this->service->confirm($batch))->toBeTrue();

    $batch->refresh();

    expect($batch->status)->toBe(ImportBatch::SELESAI)
        ->and($batch->jumlah_masuk)->toBe(2)
        ->and(AssetCategory::whereNull('parent_id')->where('name', 'ALAT KANTOR')->count())->toBe(1)
        ->and(AssetCategory::whereIn('name', ['MEJA', 'KURSI'])->count())->toBe(2);
});

it('refuses a second confirmation and a batch without new rows', function () {
    $batch = $this->service->upload('kategori', impKatFile([['ALAT KANTOR', null, 'MEJA', null, null]]), $this->kasubag);
    $this->service->confirm($batch);

    $again = $this->service->confirm($batch);
    $dupOnly = $this->service->upload('kategori', impKatFile([['ALAT KANTOR', null, 'MEJA', null, null]]), $this->kasubag);

    expect($again)->toBeFalse()
        ->and($batch->refresh()->jumlah_masuk)->toBe(1)
        ->and($dupOnly->refresh()->jumlah_baru)->toBe(0)
        ->and($this->service->confirm($dupOnly))->toBeFalse();
});

it('revalidates every row at commit time', function () {
    $batch = $this->service->upload('kategori', impKatFile([['ALAT KANTOR', null, 'MEJA', null, null]]), $this->kasubag);

    $parent = AssetCategory::create(['name' => 'ALAT KANTOR']);
    AssetCategory::create(['name' => 'MEJA', 'parent_id' => $parent->id]);

    $this->service->confirm($batch);
    $batch->refresh();

    expect($batch->jumlah_masuk)->toBe(0)
        ->and($batch->jumlah_duplikat)->toBe(1)
        ->and(AssetCategory::where('name', 'MEJA')->count())->toBe(1);
});

it('does not duplicate anything when the same file is uploaded again', function () {
    $rows = [['ALAT KANTOR', null, 'MEJA', null, null], ['ALAT KANTOR', null, 'KURSI', null, null]];

    $this->service->confirm($this->service->upload('kategori', impKatFile($rows), $this->kasubag));
    $second = $this->service->upload('kategori', impKatFile($rows), $this->kasubag)->refresh();

    expect($second->jumlah_baru)->toBe(0)
        ->and($second->jumlah_duplikat)->toBe(2)
        ->and(AssetCategory::count())->toBe(3);
});

it('rejects a file whose header does not match the template and cleans it up', function () {
    $file = impXlsx(['Salah', 'Header'], [['a', 'b']]);

    expect(fn () => $this->service->upload('kategori', $file, $this->kasubag))
        ->toThrow(ValidationException::class, 'Header kolom tidak sesuai template');
    expect(Storage::disk('local')->allFiles('imports'))->toBe([])
        ->and(ImportBatch::count())->toBe(0);
});

it('rejects a file with more rows than the limit and a file without data', function () {
    config(['import.max_rows' => 2]);

    expect(fn () => $this->service->upload('kategori', impKatFile([
        ['A', null, 'a', null, null], ['A', null, 'b', null, null], ['A', null, 'c', null, null],
    ]), $this->kasubag))->toThrow(ValidationException::class, 'melebihi batas');

    expect(fn () => $this->service->upload('kategori', impKatFile([]), $this->kasubag))
        ->toThrow(ValidationException::class, 'tidak berisi data');
});

it('rejects a file that is not a real xlsx without a server error', function () {
    $path = tempnam(sys_get_temp_dir(), 'bad').'.xlsx';
    file_put_contents($path, "Kategori,Subkategori\nA,B\n");
    $fake = new UploadedFile($path, 'data.xlsx', null, null, true);

    expect(fn () => $this->service->upload('kategori', $fake, $this->kasubag))
        ->toThrow(ValidationException::class, 'tidak dapat dibaca');
    expect(Storage::disk('local')->allFiles('imports'))->toBe([]);
});

it('marks a batch as failed with a friendly message', function () {
    $batch = ImportBatch::create(['modul' => 'kategori', 'user_id' => $this->kasubag->id, 'nama_berkas' => 'a.xlsx', 'path' => 'imports/a.xlsx']);

    $this->service->fail($batch->id, new RuntimeException('boom'));

    $batch->refresh();

    expect($batch->status)->toBe(ImportBatch::GAGAL)
        ->and($batch->pesan)->toContain('Proses impor gagal')
        ->and($batch->pesan)->not->toContain('boom');
});

it('expires ready batches older than the retention period and removes their files', function () {
    $old = $this->service->upload('kategori', impKatFile([['A', null, 'a', null, null]]), $this->kasubag);
    $fresh = $this->service->upload('kategori', impKatFile([['B', null, 'b', null, null]]), $this->kasubag);
    $old->forceFill(['created_at' => now()->subDays(8)])->save();
    $oldFiles = [$old->path, $old->path_hasil];

    expect($this->service->prune())->toBe(1);

    expect($old->refresh()->status)->toBe(ImportBatch::KEDALUWARSA)
        ->and($fresh->refresh()->status)->toBe(ImportBatch::SIAP)
        ->and(Storage::disk('local')->exists($oldFiles[0]))->toBeFalse()
        ->and(Storage::disk('local')->exists($oldFiles[1]))->toBeFalse();
});

it('previews at most the first N errors and counts warnings', function () {
    $batch = $this->service->upload('kategori', impKatFile([
        [null, null, 'a', null, null], [null, null, 'b', null, null], ['OK', null, 'c', null, null],
    ]), $this->kasubag);

    $preview = $this->service->preview($batch->refresh(), 1);

    expect($preview['errors'])->toHaveCount(1)
        ->and($preview['errors'][0]['baris'])->toBe(2)
        ->and($preview['errors'][0]['detail'][0]['kolom'])->toBe('Kategori')
        ->and($preview['peringatan'])->toBe([]);
});

it('builds an error report with the original columns plus the reason', function () {
    $batch = $this->service->upload('kategori', impKatFile([
        ['OK', null, 'c', null, null], [null, null, 'sub', '1.2', 'ket'],
    ]), $this->kasubag);

    $path = tempnam(sys_get_temp_dir(), 'err').'.xlsx';
    (new Xlsx($this->service->errorReport($batch->refresh())))->save($path);
    $rows = IOFactory::load($path)->getSheetByName('Data')->toArray(null, true, false, false);

    expect($rows)->toHaveCount(2)
        ->and($rows[0])->toBe(['Kategori', 'Kode Kategori', 'Subkategori', 'Kode Subkategori', 'Keterangan', 'Alasan'])
        ->and($rows[1][2])->toBe('sub')
        ->and($rows[1][5])->toBe('Kategori: Kategori wajib diisi.');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportServiceTest`
Expected: FAIL (kelas tidak ada).

- [ ] **Step 3: Implementasi**

`app/Services/ImportService.php`:

```php
<?php

namespace App\Services;

use App\Imports\AsetImporter;
use App\Imports\Importer;
use App\Imports\KategoriImporter;
use App\Imports\PegawaiImporter;
use App\Jobs\ProcessImportJob;
use App\Models\ImportBatch;
use App\Models\User;
use App\Support\ExcelRows;
use App\Support\TabularExcel;
use Generator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Throwable;

class ImportService
{
    public const MODUL = [
        'kategori' => KategoriImporter::class,
        'pegawai' => PegawaiImporter::class,
        'aset' => AsetImporter::class,
    ];

    public static function importer(string $modul): Importer
    {
        return app(self::MODUL[$modul]);
    }

    public function upload(string $modul, UploadedFile $file, User $user): ImportBatch
    {
        $importer = self::importer($modul);
        $disk = Storage::disk('local');
        $path = $file->store('imports', 'local');

        try {
            $header = ExcelRows::headers($disk->path($path), count($importer->headers()));
            $total = ExcelRows::totalRows($disk->path($path));
        } catch (Throwable) {
            $disk->delete($path);

            throw ValidationException::withMessages(['berkas' => 'Berkas tidak dapat dibaca. Pastikan berformat .xlsx.']);
        }

        $reject = function (string $message) use ($disk, $path) {
            $disk->delete($path);

            throw ValidationException::withMessages(['berkas' => $message]);
        };

        if (array_map('mb_strtolower', $header) !== array_map('mb_strtolower', $importer->headers())) {
            $reject('Header kolom tidak sesuai template. Unduh template terbaru lalu salin data Anda ke sana.');
        }

        if ($total === 0) {
            $reject('Berkas tidak berisi data.');
        }

        if ($total > config('import.max_rows')) {
            $reject("Berkas berisi {$total} baris, melebihi batas ".config('import.max_rows').' baris per impor.');
        }

        $batch = ImportBatch::create([
            'modul' => $modul,
            'user_id' => $user->id,
            'nama_berkas' => $file->getClientOriginalName(),
            'path' => $path,
            'total_baris' => $total,
        ]);

        ProcessImportJob::dispatch($batch->id, 'validate');

        return $batch;
    }

    /** Dry-run: semua baris divalidasi, hasilnya ditulis ke berkas JSON-lines; tidak ada data modul yang berubah. */
    public function validate(ImportBatch $batch): void
    {
        $importer = self::importer($batch->modul);
        $importer->begin($batch->user);

        $disk = Storage::disk('local');
        $hasil = "imports/{$batch->id}-hasil.jsonl";
        $out = fopen($disk->path($hasil), 'w');
        $count = ['baru' => 0, 'duplikat' => 0, 'error' => 0];
        $done = 0;

        foreach (ExcelRows::chunks($disk->path($batch->path), $importer->headers(), config('import.chunk')) as $rows) {
            foreach ($rows as $no => $raw) {
                $result = $importer->validate($raw);
                $count[$result->status]++;

                fwrite($out, json_encode([
                    'row' => $no, 'status' => $result->status, 'errors' => $result->errors,
                    'warning' => $result->warning, 'raw' => $raw,
                ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n");
            }

            $done += count($rows);
            $batch->update(['progres' => $done]);
        }

        fclose($out);

        $batch->update([
            'status' => ImportBatch::SIAP,
            'path_hasil' => $hasil,
            'jumlah_baru' => $count['baru'],
            'jumlah_duplikat' => $count['duplikat'],
            'jumlah_error' => $count['error'],
            'progres' => $batch->total_baris,
        ]);
    }

    /** Klaim atomik: hanya satu pemanggil yang bisa memulai commit. */
    public function confirm(ImportBatch $batch): bool
    {
        $claimed = ImportBatch::whereKey($batch->id)
            ->where('status', ImportBatch::SIAP)
            ->where('jumlah_baru', '>', 0)
            ->update(['status' => ImportBatch::MEMPROSES, 'progres' => 0]);

        if ($claimed === 1) {
            ProcessImportJob::dispatch($batch->id, 'commit');
        }

        return $claimed === 1;
    }

    /**
     * Tiap baris baru divalidasi ulang (data bisa berubah sejak pratinjau) dan disimpan
     * dalam transaksinya sendiri, sehingga satu baris gagal tidak membatalkan yang lain.
     */
    public function commit(ImportBatch $batch): void
    {
        $importer = self::importer($batch->modul);
        $importer->begin($batch->user);

        $masuk = 0;
        $duplikat = $batch->jumlah_duplikat;
        $error = $batch->jumlah_error;
        $done = 0;

        foreach ($this->lines($batch) as $line) {
            if ($line['status'] !== 'baru') {
                continue;
            }

            $result = $importer->validate($line['raw']);

            if ($result->status === 'baru') {
                try {
                    DB::transaction(fn () => $importer->save($result->data));
                    $masuk++;
                } catch (Throwable $e) {
                    report($e);
                    $error++;
                }
            } elseif ($result->status === 'duplikat') {
                $duplikat++;
            } else {
                $error++;
            }

            if (++$done % config('import.chunk') === 0) {
                $batch->update(['progres' => $done, 'jumlah_masuk' => $masuk]);
            }
        }

        $batch->update([
            'status' => ImportBatch::SELESAI,
            'progres' => $batch->jumlah_baru,
            'jumlah_masuk' => $masuk,
            'jumlah_duplikat' => $duplikat,
            'jumlah_error' => $error,
        ]);
    }

    public function fail(int $batchId, Throwable $e): void
    {
        report($e);

        ImportBatch::whereKey($batchId)->update([
            'status' => ImportBatch::GAGAL,
            'pesan' => 'Proses impor gagal. Coba unggah ulang; bila berulang, hubungi administrator.',
        ]);
    }

    /** @return array{errors: list<array{baris: int, detail: list<array{kolom: string, alasan: string}>}>, peringatan: array<string, int>} */
    public function preview(ImportBatch $batch, int $limit = 50): array
    {
        $errors = [];
        $peringatan = [];

        foreach ($this->lines($batch) as $line) {
            if ($line['status'] === 'error' && count($errors) < $limit) {
                $errors[] = ['baris' => $line['row'], 'detail' => $line['errors']];
            }

            if ($line['status'] === 'baru' && $line['warning']) {
                $peringatan[$line['warning']] = ($peringatan[$line['warning']] ?? 0) + 1;
            }
        }

        return ['errors' => $errors, 'peringatan' => $peringatan];
    }

    /** Laporan dibuat saat diminta dari berkas hasil, bukan disimpan terpisah. */
    public function errorReport(ImportBatch $batch): Spreadsheet
    {
        $headers = self::importer($batch->modul)->headers();

        $rows = (function () use ($batch) {
            foreach ($this->lines($batch) as $line) {
                if ($line['status'] === 'error') {
                    yield [...array_values($line['raw']), implode('; ', array_map(
                        fn ($e) => "{$e['kolom']}: {$e['alasan']}", $line['errors'],
                    ))];
                }
            }
        })();

        return TabularExcel::build([...$headers, 'Alasan'], $rows);
    }

    /** Batch siap yang tak dikonfirmasi melewati masa simpan: berkas dihapus, status kedaluwarsa. */
    public function prune(): int
    {
        $stale = ImportBatch::where('status', ImportBatch::SIAP)
            ->where('created_at', '<', now()->subDays(config('import.expire_days')))->get();

        foreach ($stale as $batch) {
            Storage::disk('local')->delete(array_filter([$batch->path, $batch->path_hasil]));
            $batch->update(['status' => ImportBatch::KEDALUWARSA]);
        }

        return $stale->count();
    }

    /** @return Generator<int, array<string, mixed>> */
    private function lines(ImportBatch $batch): Generator
    {
        if ($batch->path_hasil === null || ! Storage::disk('local')->exists($batch->path_hasil)) {
            return;
        }

        $handle = fopen(Storage::disk('local')->path($batch->path_hasil), 'r');

        while (($line = fgets($handle)) !== false) {
            yield json_decode($line, true);
        }

        fclose($handle);
    }
}
```

`app/Jobs/ProcessImportJob.php`:

```php
<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Services\ImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessImportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout;

    /** @param 'validate'|'commit' $phase */
    public function __construct(public int $batchId, public string $phase)
    {
        $this->timeout = (int) config('import.job_timeout');
    }

    public function handle(ImportService $imports): void
    {
        $batch = ImportBatch::findOrFail($this->batchId);

        $this->phase === 'validate' ? $imports->validate($batch) : $imports->commit($batch);
    }

    public function failed(Throwable $e): void
    {
        app(ImportService::class)->fail($this->batchId, $e);
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportServiceTest`
Expected: PASS (12 test).

- [ ] **Step 5: Commit**

```bash
git add app/Services/ImportService.php app/Jobs/ProcessImportJob.php tests/Feature/ImportServiceTest.php
git commit -m "feat(import): import engine with validate and commit queue jobs"
```

---

### Task 7: Controller, rute, template, dan `import:prune`

**Files:**
- Create: `app/Http/Controllers/ImportController.php`, `app/Console/Commands/PruneImports.php`, `tests/Feature/ImportControllerTest.php`
- Modify: `routes/web.php` (di dalam grup `auth`, setelah rute `pegawais.create-user`), `routes/console.php`

**Interfaces:**
- Consumes: `ImportService` (Task 6), `TabularExcel` (Task 2), permission (Task 1).
- Produces: rute `import.show` (`GET /import/{modul}`, query `?batch=ID`), `import.store` (`POST /import/{modul}`, field `berkas`), `import.template` (`GET /import/{modul}/template`), `import.confirm` (`POST /import/{modul}/batches/{batch}/confirm`), `import.errors` (`GET /import/{modul}/batches/{batch}/errors`); komponen Inertia `Import/Index` dengan props `modul`, `label`, `batch` (`id,nama_berkas,status,total_baris,jumlah_baru,jumlah_duplikat,jumlah_error,jumlah_masuk,progres,pesan` atau `null`), `preview` (`{errors, peringatan}`), `riwayat` (daftar `id,nama_berkas,status,jumlah_baru,jumlah_duplikat,jumlah_error,jumlah_masuk,created_at,pengunggah`), `maxKb`, `maxRows`; perintah `import:prune`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ImportControllerTest.php`:

```php
<?php

use App\Models\AssetCategory;
use App\Models\ImportBatch;
use App\Services\ImportService;
use Illuminate\Support\Facades\Storage;

function impKatUpload(array $rows)
{
    return impXlsx(ImportService::importer('kategori')->headers(), $rows);
}

beforeEach(function () {
    Storage::fake('local');
    // Halaman Import/Index dibangun di Task 9; hapus baris ini di sana.
    config(['inertia.testing.ensure_pages_exist' => false]);
    $this->kasubag = impUser('kasubag', null, ['import-kategori', 'import-pegawai']);
});

it('redirects guests to login and forbids users without the permission', function () {
    $this->get(route('import.show', 'kategori'))->assertRedirect('/login');

    $this->actingAs(userWithRole('lurah', makeKelurahan(makeKecamatan(), 'Kel A')))
        ->get(route('import.show', 'kategori'))->assertForbidden();
});

it('returns 404 for an unknown module', function () {
    $this->actingAs($this->kasubag)->get('/import/lainnya')->assertNotFound();
});

it('shows the import page with the history of the module', function () {
    $this->actingAs($this->kasubag)->get(route('import.show', 'kategori'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Import/Index')
            ->where('modul', 'kategori')->where('batch', null)->has('riwayat', 0));
});

it('uploads a file, validates it through the queue and redirects to the batch', function () {
    $response = $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impKatUpload([['ALAT KANTOR', null, 'MEJA', null, null]]),
    ]);

    $batch = ImportBatch::firstOrFail();

    $response->assertRedirect(route('import.show', ['modul' => 'kategori', 'batch' => $batch->id]));
    expect($batch->status)->toBe(ImportBatch::SIAP)->and($batch->jumlah_baru)->toBe(1);

    $this->actingAs($this->kasubag)->get(route('import.show', ['modul' => 'kategori', 'batch' => $batch->id]))
        ->assertInertia(fn ($page) => $page->where('batch.id', $batch->id)->where('batch.status', 'siap')->has('preview.errors', 0)
            ->missing('batch.path'));
});

it('rejects a wrong file type and a header mismatch with a message on the berkas field', function () {
    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => \Illuminate\Http\UploadedFile::fake()->create('data.csv', 5),
    ])->assertSessionHasErrors('berkas');

    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impXlsx(['Salah'], [['x']]),
    ])->assertSessionHasErrors('berkas');

    expect(ImportBatch::count())->toBe(0);
});

it('confirms a ready batch and writes the rows', function () {
    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impKatUpload([['ALAT KANTOR', null, 'MEJA', null, null]]),
    ]);
    $batch = ImportBatch::firstOrFail();

    $this->actingAs($this->kasubag)->post(route('import.confirm', ['modul' => 'kategori', 'batch' => $batch->id]))
        ->assertRedirect()->assertSessionHas('success');

    expect($batch->refresh()->status)->toBe(ImportBatch::SELESAI)
        ->and(AssetCategory::where('name', 'MEJA')->exists())->toBeTrue();

    $this->actingAs($this->kasubag)->post(route('import.confirm', ['modul' => 'kategori', 'batch' => $batch->id]))
        ->assertSessionHas('error');
});

it('hides batches of other users unless the account has unrestricted unit scope', function () {
    $kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');
    $owner = impUser('admin_kelurahan', $kel, ['import-pegawai']);
    $other = impUser('admin_kelurahan', $kel, ['import-pegawai']);
    $headers = ImportService::importer('pegawai')->headers();

    $this->actingAs($owner)->post(route('import.store', 'pegawai'), [
        'berkas' => impXlsx($headers, [['Budi', '1', null, 'Staf', 'PNS', 'Kelurahan A', null, null]]),
    ]);
    $batch = ImportBatch::firstOrFail();

    $this->actingAs($other)->post(route('import.confirm', ['modul' => 'pegawai', 'batch' => $batch->id]))->assertNotFound();
    $this->actingAs($other)->get(route('import.errors', ['modul' => 'pegawai', 'batch' => $batch->id]))->assertNotFound();
    $this->actingAs($other)->get(route('import.show', 'pegawai'))->assertInertia(fn ($page) => $page->has('riwayat', 0));
    $this->actingAs($this->kasubag)->get(route('import.show', 'pegawai'))->assertInertia(fn ($page) => $page->has('riwayat', 1));
});

it('does not let a batch be reached through another module path', function () {
    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impKatUpload([['A', null, 'a', null, null]]),
    ]);
    $batch = ImportBatch::firstOrFail();

    $this->actingAs($this->kasubag)->post(route('import.confirm', ['modul' => 'pegawai', 'batch' => $batch->id]))->assertNotFound();
});

it('downloads the template and the error report as xlsx', function () {
    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impKatUpload([[null, null, 'sub', null, null]]),
    ]);
    $batch = ImportBatch::firstOrFail();

    $template = $this->actingAs($this->kasubag)->get(route('import.template', 'kategori'));
    $errors = $this->actingAs($this->kasubag)->get(route('import.errors', ['modul' => 'kategori', 'batch' => $batch->id]));

    $template->assertOk()->assertHeader('content-disposition');
    $errors->assertOk();
    expect($template->headers->get('content-disposition'))->toContain('template-impor-kategori.xlsx')
        ->and($errors->headers->get('content-disposition'))->toContain('laporan-error-kategori-'.$batch->id.'.xlsx');
});

it('prunes stale ready batches through the import:prune command', function () {
    $this->actingAs($this->kasubag)->post(route('import.store', 'kategori'), [
        'berkas' => impKatUpload([['A', null, 'a', null, null]]),
    ]);
    ImportBatch::firstOrFail()->forceFill(['created_at' => now()->subDays(8)])->save();

    $this->artisan('import:prune')->expectsOutputToContain('1')->assertSuccessful();

    expect(ImportBatch::first()->status)->toBe(ImportBatch::KEDALUWARSA);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ImportControllerTest`
Expected: FAIL (rute tidak ada).

- [ ] **Step 3: Implementasi**

`app/Http/Controllers/ImportController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\ImportBatch;
use App\Services\ImportService;
use App\Support\TabularExcel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    private const LABEL = ['kategori' => 'Kategori Aset', 'pegawai' => 'Pegawai', 'aset' => 'Data Aset'];

    private const BATCH_FIELDS = [
        'id', 'nama_berkas', 'status', 'total_baris', 'jumlah_baru', 'jumlah_duplikat',
        'jumlah_error', 'jumlah_masuk', 'progres', 'pesan',
    ];

    public function __construct(private readonly ImportService $imports) {}

    public function show(Request $request, string $modul): Response
    {
        $this->authorizeModul($request, $modul);

        $riwayat = $this->visibleBatches($request, $modul)->with('user')->latest('id')->limit(20)->get();
        $batch = $request->filled('batch')
            ? $riwayat->firstWhere('id', $request->integer('batch'))
            : $riwayat->first(fn (ImportBatch $b) => in_array($b->status, [ImportBatch::MEMERIKSA, ImportBatch::SIAP, ImportBatch::MEMPROSES], true));
        $showPreview = $batch !== null && in_array($batch->status, [ImportBatch::SIAP, ImportBatch::SELESAI], true);

        return Inertia::render('Import/Index', [
            'modul' => $modul,
            'label' => self::LABEL[$modul],
            'batch' => $batch?->only(self::BATCH_FIELDS),
            'preview' => $showPreview ? $this->imports->preview($batch) : ['errors' => [], 'peringatan' => []],
            'riwayat' => $riwayat->map(fn (ImportBatch $b) => $b->only([
                'id', 'nama_berkas', 'status', 'jumlah_baru', 'jumlah_duplikat', 'jumlah_error', 'jumlah_masuk', 'created_at',
            ]) + ['pengunggah' => $b->user?->name])->values(),
            'maxKb' => config('import.max_kb'),
            'maxRows' => config('import.max_rows'),
        ]);
    }

    public function store(Request $request, string $modul): RedirectResponse
    {
        $this->authorizeModul($request, $modul);

        $request->validate(
            ['berkas' => ['required', 'file', 'extensions:xlsx', 'max:'.config('import.max_kb')]],
            [
                'berkas.required' => 'Pilih berkas Excel (.xlsx).',
                'berkas.extensions' => 'Berkas harus berformat .xlsx.',
                'berkas.max' => 'Ukuran berkas maksimal '.(config('import.max_kb') / 1024).' MB.',
            ],
        );

        $batch = $this->imports->upload($modul, $request->file('berkas'), $request->user());

        return redirect()->route('import.show', ['modul' => $modul, 'batch' => $batch->id]);
    }

    public function confirm(Request $request, string $modul, ImportBatch $batch): RedirectResponse
    {
        $this->authorizeBatch($request, $modul, $batch);

        $started = $this->imports->confirm($batch);

        return redirect()->route('import.show', ['modul' => $modul, 'batch' => $batch->id])->with(
            $started ? 'success' : 'error',
            $started ? 'Impor dimulai.' : 'Batch ini tidak bisa dikonfirmasi (sudah diproses atau tidak ada baris baru).',
        );
    }

    public function errors(Request $request, string $modul, ImportBatch $batch): StreamedResponse
    {
        $this->authorizeBatch($request, $modul, $batch);

        return TabularExcel::download($this->imports->errorReport($batch), "laporan-error-{$modul}-{$batch->id}.xlsx");
    }

    public function template(Request $request, string $modul): StreamedResponse
    {
        $this->authorizeModul($request, $modul);

        $importer = ImportService::importer($modul);

        return TabularExcel::download(
            TabularExcel::build($importer->headers(), [$importer->contoh()], $importer->petunjuk()),
            "template-impor-{$modul}.xlsx",
        );
    }

    private function authorizeModul(Request $request, string $modul): void
    {
        abort_unless($request->user()->can("import-{$modul}"), 403);
    }

    private function authorizeBatch(Request $request, string $modul, ImportBatch $batch): void
    {
        $this->authorizeModul($request, $modul);

        abort_unless($batch->modul === $modul && $this->canSee($request, $batch), 404);
    }

    private function canSee(Request $request, ImportBatch $batch): bool
    {
        return $request->user()->accessibleUnitIds() === null || $batch->user_id === $request->user()->id;
    }

    /** @return Builder<ImportBatch> */
    private function visibleBatches(Request $request, string $modul): Builder
    {
        return ImportBatch::query()->where('modul', $modul)
            ->when($request->user()->accessibleUnitIds() !== null, fn (Builder $q) => $q->where('user_id', $request->user()->id));
    }
}
```

`routes/web.php`: tambahkan `use App\Http\Controllers\ImportController;` pada daftar `use`, dan di dalam grup `Route::middleware('auth')->group(...)` setelah baris `pegawais.create-user`:

```php
    Route::prefix('import/{modul}')->where(['modul' => 'kategori|pegawai|aset'])->group(function () {
        Route::get('/', [ImportController::class, 'show'])->name('import.show');
        Route::post('/', [ImportController::class, 'store'])->name('import.store');
        Route::get('template', [ImportController::class, 'template'])->name('import.template');
        Route::post('batches/{batch}/confirm', [ImportController::class, 'confirm'])->name('import.confirm');
        Route::get('batches/{batch}/errors', [ImportController::class, 'errors'])->name('import.errors');
    });
```

`app/Console/Commands/PruneImports.php`:

```php
<?php

namespace App\Console\Commands;

use App\Services\ImportService;
use Illuminate\Console\Command;

class PruneImports extends Command
{
    protected $signature = 'import:prune';

    protected $description = 'Kedaluwarsakan batch import yang siap tetapi tidak dikonfirmasi dan hapus berkasnya';

    public function handle(ImportService $imports): int
    {
        $this->info($imports->prune().' batch dikedaluwarsakan.');

        return self::SUCCESS;
    }
}
```

`routes/console.php`: tambahkan `use Illuminate\Support\Facades\Schedule;` pada daftar `use` dan di akhir berkas: `Schedule::command('import:prune')->daily();`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ImportControllerTest` lalu `php artisan route:list --name=import`
Expected: PASS (9 test); daftar menampilkan lima rute `import.*`.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ImportController.php app/Console/Commands/PruneImports.php routes/web.php routes/console.php tests/Feature/ImportControllerTest.php
git commit -m "feat(import): import controller, routes, template download and prune command"
```

---

### Task 8: Ekspor

**Files:**
- Create: `app/Http/Controllers/ExportController.php`, `tests/Feature/ExportTest.php`
- Modify: `routes/web.php` (grup `auth`, setelah blok `import/{modul}`)

**Interfaces:**
- Consumes: `ImportService::importer`, `TabularExcel` (Task 2), `Importer::export/exportCount` (Task 3-5).
- Produces: rute `export` (`GET /export/{modul}`, query filter aset opsional `search,category_id,unit_id,kondisi`); unduhan `data-{modul}-{Y-m-d}.xlsx`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/Feature/ExportTest.php`:

```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\ImportBatch;
use App\Models\Pegawai;
use App\Services\ImportService;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Illuminate\Support\Facades\Storage;

function impSheetRows($response): array
{
    $path = tempnam(sys_get_temp_dir(), 'exp').'.xlsx';
    file_put_contents($path, $response->streamedContent());

    return IOFactory::load($path)->getSheetByName('Data')->toArray(null, true, false, false);
}

beforeEach(function () {
    Storage::fake('local');
    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->alat = AssetCategory::create(['name' => 'ALAT KANTOR']);
    $this->meja = AssetCategory::create(['name' => 'MEJA', 'parent_id' => $this->alat->id]);
    $this->kasubag = impUser('kasubag', null, ['export-aset', 'export-pegawai', 'export-kategori', 'import-aset', 'import-pegawai', 'import-kategori']);
});

it('forbids exporting without the permission and returns 404 for unknown modules', function () {
    $this->actingAs(userWithRole('lurah', $this->kelA))->get(route('export', 'aset'))->assertForbidden();
    $this->actingAs($this->kasubag)->get('/export/lainnya')->assertNotFound();
    $this->get(route('export', 'aset'))->assertRedirect('/login');
});

it('exports kategori with the template header', function () {
    $rows = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'kategori')));

    expect($rows[0])->toBe(ImportService::importer('kategori')->headers())
        ->and($rows[1][0])->toBe('ALAT KANTOR')
        ->and($rows[1][2])->toBe('MEJA');
});

it('exports only assets in the account scope and honours the list filters', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Kerja', 'kondisi' => 'baik']);
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Rusak', 'kondisi' => 'rusak_berat']);
    Asset::factory()->create(['unit_id' => makeKelurahan($this->kec, 'Kelurahan B')->id, 'category_id' => $this->meja->id, 'nama_aset' => 'Meja Luar']);
    $admin = impUser('admin_kelurahan', $this->kelA, ['export-aset']);

    $all = impSheetRows($this->actingAs($admin)->get(route('export', 'aset')));
    $filtered = impSheetRows($this->actingAs($admin)->get(route('export', ['modul' => 'aset', 'kondisi' => 'rusak_berat'])));

    expect(array_column($all, 2))->toBe(['Nama Aset', 'Meja Kerja', 'Meja Rusak'])
        ->and(array_column($filtered, 2))->toBe(['Nama Aset', 'Meja Rusak']);
});

it('refuses to export more rows than the limit with a clear message', function () {
    config(['import.export_max' => 1]);
    AssetCategory::create(['name' => 'LAIN']);

    $this->actingAs($this->kasubag)->from('/asset-categories')->get(route('export', 'kategori'))
        ->assertRedirect('/asset-categories')->assertSessionHas('error');
});

it('keeps formula-looking values as text in the export', function () {
    Asset::factory()->create(['unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'nama_aset' => '=SUM(1+1)']);

    $rows = impSheetRows($this->actingAs($this->kasubag)->get(route('export', 'aset')));

    expect($rows[1][2])->toBe('=SUM(1+1)');
});

it('round-trips: exported kategori, pegawai and aset import back into an empty database', function () {
    Storage::fake('local');
    $user = $this->kasubag;
    Asset::factory()->create([
        'unit_id' => $this->kelA->id, 'category_id' => $this->meja->id, 'kode_barang' => '1.3.2.05.02.04.004',
        'nomor_register' => 7, 'nama_aset' => 'Meja Kerja', 'tanggal_perolehan' => '2023-06-14',
        'nilai_perolehan' => 1000000, 'nilai_buku' => 800000, 'kondisi' => 'baik', 'no_dokumen' => 'DOC-1',
    ]);
    Pegawai::create(['nama' => 'Budi', 'nip' => '198001012005011001', 'jabatan' => 'Staf', 'status_kepegawaian' => 'pns', 'unit_id' => $this->kelA->id]);

    $exports = [];
    foreach (['kategori', 'pegawai', 'aset'] as $modul) {
        $exports[$modul] = impSheetRows($this->actingAs($user)->get(route('export', $modul)));
    }

    Asset::query()->delete();
    Pegawai::query()->delete();
    AssetCategory::query()->whereNotNull('parent_id')->delete();
    AssetCategory::query()->delete();

    foreach (['kategori', 'pegawai', 'aset'] as $modul) {
        $headers = array_shift($exports[$modul]);
        $batch = app(ImportService::class)->upload($modul, impXlsx($headers, $exports[$modul]), $user)->refresh();

        expect($batch->jumlah_baru)->toBe(1, "modul {$modul}")
            ->and($batch->jumlah_error)->toBe(0, "modul {$modul}");
        app(ImportService::class)->confirm($batch);
    }

    $asset = Asset::firstOrFail();

    expect($asset->nama_aset)->toBe('Meja Kerja')
        ->and($asset->nomor_register)->toBe(7)
        ->and($asset->tanggal_perolehan->toDateString())->toBe('2023-06-14')
        ->and((float) $asset->nilai_buku)->toBe(800000.0)
        ->and(Pegawai::first()->nip)->toBe('198001012005011001')
        ->and(AssetCategory::count())->toBe(2)
        ->and(ImportBatch::where('status', ImportBatch::SELESAI)->count())->toBe(3);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `php artisan test --filter=ExportTest`
Expected: FAIL (rute `export` tidak ada).

- [ ] **Step 3: Implementasi**

`app/Http/Controllers/ExportController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Services\ImportService;
use App\Support\TabularExcel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __invoke(Request $request, string $modul): StreamedResponse|RedirectResponse
    {
        abort_unless($request->user()->can("export-{$modul}"), 403);

        $importer = ImportService::importer($modul);
        $importer->begin($request->user());
        $filters = $request->only(['search', 'category_id', 'unit_id', 'kondisi']);

        if ($importer->exportCount($filters) > config('import.export_max')) {
            return back()->with('error', 'Data melebihi '.number_format(config('import.export_max'), 0, ',', '.').' baris. Persempit dengan filter lalu ekspor lagi.');
        }

        return TabularExcel::download(
            TabularExcel::build($importer->headers(), $importer->export($filters)),
            "data-{$modul}-".now()->format('Y-m-d').'.xlsx',
        );
    }
}
```

`routes/web.php`: tambahkan `use App\Http\Controllers\ExportController;` dan, setelah blok `import/{modul}` di dalam grup `auth`:

```php
    Route::get('/export/{modul}', ExportController::class)->where('modul', 'kategori|pegawai|aset')->name('export');
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `php artisan test --filter=ExportTest`
Expected: PASS (6 test, termasuk round-trip tiga modul).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ExportController.php routes/web.php tests/Feature/ExportTest.php
git commit -m "feat(export): excel export for kategori, pegawai and aset with round-trip"
```

---

### Task 9: Frontend (halaman import dan tombol)

**Files:**
- Create: `resources/js/Pages/Import/Index.tsx`, `resources/js/Components/ImportExportButtons.tsx`
- Modify: `resources/js/Pages/Assets/Index.tsx:148`, `resources/js/Pages/Pegawai/Index.tsx` (blok `{can.create && (` pada header, sekitar baris 109), `resources/js/Pages/AssetCategories/Index.tsx:177`, `tests/Feature/ImportControllerTest.php` (hapus override `inertia.testing.ensure_pages_exist`)

**Interfaces:**
- Consumes: props Inertia dari Task 7 (`Import/Index`), `auth.user.permissions` (Task 1), rute `import.*` dan `export`.
- Produces: komponen `ImportExportButtons({ modul, query? })`.

- [ ] **Step 1: Tulis komponen dan halaman**

`resources/js/Components/ImportExportButtons.tsx`:

```tsx
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';

type Modul = 'aset' | 'pegawai' | 'kategori';

const BUTTON =
    'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2';

export default function ImportExportButtons({ modul, query = {} }: { modul: Modul; query?: object }) {
    const permissions = usePage<PageProps>().props.auth.user?.permissions ?? [];
    const canImport = permissions.includes(`import-${modul}`);
    const canExport = permissions.includes(`export-${modul}`);

    if (!canImport && !canExport) return null;

    const params = Object.fromEntries(
        Object.entries(query as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );

    return (
        <>
            {canImport && (
                <Link href={route('import.show', modul)} className={BUTTON}>
                    Impor
                </Link>
            )}
            {canExport && (
                <a href={route('export', { modul, ...params })} className={BUTTON}>
                    Ekspor
                </a>
            )}
        </>
    );
}
```

`resources/js/Pages/Import/Index.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect } from 'react';

interface Batch {
    id: number;
    nama_berkas: string;
    status: string;
    total_baris: number;
    jumlah_baru: number;
    jumlah_duplikat: number;
    jumlah_error: number;
    jumlah_masuk: number;
    progres: number;
    pesan: string | null;
}

interface Riwayat {
    id: number;
    nama_berkas: string;
    status: string;
    jumlah_baru: number;
    jumlah_duplikat: number;
    jumlah_error: number;
    jumlah_masuk: number;
    created_at: string;
    pengunggah: string | null;
}

interface ErrorRow {
    baris: number;
    detail: { kolom: string; alasan: string }[];
}

interface Props extends PageProps {
    modul: string;
    label: string;
    batch: Batch | null;
    preview: { errors: ErrorRow[]; peringatan: Record<string, number> };
    riwayat: Riwayat[];
    maxKb: number;
    maxRows: number;
}

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const PRIMARY =
    'inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50';
const SECONDARY =
    'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2';

const STATUS: Record<string, { label: string; cls: string }> = {
    memeriksa: { label: 'Memeriksa', cls: 'bg-amber-50 text-amber-800' },
    siap: { label: 'Siap dikonfirmasi', cls: 'bg-blue-50 text-blue-800' },
    memproses: { label: 'Memproses', cls: 'bg-amber-50 text-amber-800' },
    selesai: { label: 'Selesai', cls: 'bg-green-50 text-green-800' },
    gagal: { label: 'Gagal', cls: 'bg-red-50 text-red-800' },
    kedaluwarsa: { label: 'Kedaluwarsa', cls: 'bg-slate-100 text-slate-600' },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
    return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString('id-ID')}</p>
        </div>
    );
}

export default function Index({ modul, label, batch, preview, riwayat, maxKb, maxRows }: Props) {
    const form = useForm<{ berkas: File | null }>({ berkas: null });
    const active = batch !== null && (batch.status === 'memeriksa' || batch.status === 'memproses');
    const percent = batch && batch.total_baris > 0 ? Math.min(100, Math.round((batch.progres / batch.total_baris) * 100)) : 0;

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => router.reload({ only: ['batch', 'preview', 'riwayat'] }), 2000);
        return () => clearInterval(timer);
    }, [active]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('import.store', modul), { forceFormData: true, onSuccess: () => form.reset() });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Impor ${label}`} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Impor {label}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Unggah berkas Excel, periksa pratinjau, lalu konfirmasi. Baris yang sudah ada dilewati.
                    </p>
                </div>

                <form onSubmit={submit} className={`${CARD} space-y-3`}>
                    <label htmlFor="berkas" className="block text-sm font-medium text-slate-900">
                        Berkas Excel (.xlsx)
                    </label>
                    <input
                        id="berkas"
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => form.setData('berkas', e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold"
                    />
                    {form.errors.berkas && <p className="text-sm text-red-700">{form.errors.berkas}</p>}
                    <p className="text-xs text-slate-500">
                        Maksimal {maxKb / 1024} MB dan {maxRows.toLocaleString('id-ID')} baris per berkas.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={!form.data.berkas || form.processing} className={PRIMARY}>
                            {form.processing ? 'Mengunggah…' : 'Unggah & periksa'}
                        </button>
                        <a href={route('import.template', modul)} className={SECONDARY}>
                            Unduh template
                        </a>
                    </div>
                </form>

                {batch && (
                    <section className={`${CARD} space-y-4`} aria-live="polite">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{batch.nama_berkas}</p>
                                <p className="text-xs text-slate-500">{batch.total_baris.toLocaleString('id-ID')} baris</p>
                            </div>
                            <StatusBadge status={batch.status} />
                        </div>

                        {active && (
                            <div>
                                <div className="h-2 overflow-hidden rounded bg-slate-100">
                                    <div className="h-2 bg-blue-700 transition-all" style={{ width: `${percent}%` }} />
                                </div>
                                <p className="mt-1 text-xs tabular-nums text-slate-500">
                                    {batch.progres.toLocaleString('id-ID')} / {batch.total_baris.toLocaleString('id-ID')} baris
                                </p>
                            </div>
                        )}

                        {batch.status === 'gagal' && <p className="text-sm text-red-700">{batch.pesan}</p>}

                        {(batch.status === 'siap' || batch.status === 'selesai') && (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <Stat label="Baru" value={batch.jumlah_baru} />
                                    <Stat label="Sudah ada (dilewati)" value={batch.jumlah_duplikat} />
                                    <Stat label="Error" value={batch.jumlah_error} />
                                    {batch.status === 'selesai' && <Stat label="Berhasil masuk" value={batch.jumlah_masuk} />}
                                </div>

                                {Object.entries(preview.peringatan).map(([text, n]) => (
                                    <p key={text} className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                        {n.toLocaleString('id-ID')} baris — {text}
                                    </p>
                                ))}

                                {preview.errors.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <caption className="mb-2 text-left text-sm font-semibold text-slate-900">
                                                Baris bermasalah (menampilkan {preview.errors.length} pertama)
                                            </caption>
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-3 py-2">Baris</th>
                                                    <th className="px-3 py-2">Kolom</th>
                                                    <th className="px-3 py-2">Alasan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.errors.flatMap((row) =>
                                                    row.detail.map((d, i) => (
                                                        <tr key={`${row.baris}-${i}`} className="border-t border-slate-100">
                                                            <td className="px-3 py-2 tabular-nums">{row.baris}</td>
                                                            <td className="px-3 py-2">{d.kolom}</td>
                                                            <td className="px-3 py-2">{d.alasan}</td>
                                                        </tr>
                                                    )),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {batch.status === 'siap' && batch.jumlah_baru > 0 && (
                                        <button
                                            type="button"
                                            className={PRIMARY}
                                            onClick={() => router.post(route('import.confirm', { modul, batch: batch.id }))}
                                        >
                                            Konfirmasi impor {batch.jumlah_baru.toLocaleString('id-ID')} baris
                                        </button>
                                    )}
                                    {batch.jumlah_error > 0 && (
                                        <a href={route('import.errors', { modul, batch: batch.id })} className={SECONDARY}>
                                            Unduh laporan error
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                )}

                <section className={CARD}>
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Riwayat impor</h2>
                    {riwayat.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada impor.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Waktu</th>
                                        <th className="px-3 py-2">Berkas</th>
                                        <th className="px-3 py-2">Oleh</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2 text-right">Baru</th>
                                        <th className="px-3 py-2 text-right">Dilewati</th>
                                        <th className="px-3 py-2 text-right">Error</th>
                                        <th className="px-3 py-2 text-right">Masuk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {riwayat.map((r) => (
                                        <tr key={r.id} className="border-t border-slate-100">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-3 py-2">
                                                <Link href={route('import.show', { modul, batch: r.id })} className="text-blue-700 hover:underline">
                                                    {r.nama_berkas}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2">{r.pengunggah ?? '—'}</td>
                                            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_baru}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_duplikat}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_error}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_masuk}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Pasang tombol di tiga halaman**

`resources/js/Pages/Assets/Index.tsx`: tambahkan `import ImportExportButtons from '@/Components/ImportExportButtons';` pada daftar impor; lalu tepat sebelum `{can.create && (` (sekitar baris 148, di dalam `div` flex yang sama dengan tombol "Tambah Aset Baru") sisipkan:

```tsx
                        <ImportExportButtons modul="aset" query={filters} />
```

`resources/js/Pages/Pegawai/Index.tsx`: tambahkan impor yang sama; ganti blok tombol tambah di header:

```tsx
                    {can.create && (
                        <Link
                            href={route('pegawais.create')}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Tambah Pegawai Baru</span>
                        </Link>
                    )}
```

dengan:

```tsx
                    <div className="flex flex-wrap items-center gap-2">
                        <ImportExportButtons modul="pegawai" />
                        {can.create && (
                            <Link
                                href={route('pegawais.create')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Tambah Pegawai Baru</span>
                            </Link>
                        )}
                    </div>
```

`resources/js/Pages/AssetCategories/Index.tsx`: tambahkan impor yang sama; ganti elemen `<Link href={route('asset-categories.create')} ...>...</Link>` (baris 177-183) dengan pembungkus:

```tsx
                    <div className="flex flex-wrap items-center gap-2">
                        <ImportExportButtons modul="kategori" />
                        <Link
                            href={route('asset-categories.create')}
                            className="shadow-xs inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-5 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span>Tambah Kategori</span>
                        </Link>
                    </div>
```

`tests/Feature/ImportControllerTest.php`: hapus dua baris di `beforeEach` (komentar "Halaman Import/Index dibangun di Task 9..." dan `config(['inertia.testing.ensure_pages_exist' => false]);`).

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` lalu `npm run build` lalu `php artisan test --filter="ImportControllerTest|ImportFoundationTest"`
Expected: `tsc` tanpa error, build sukses, test PASS (kini dengan pemeriksaan keberadaan halaman Inertia aktif).

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Import/Index.tsx resources/js/Components/ImportExportButtons.tsx resources/js/Pages/Assets/Index.tsx resources/js/Pages/Pegawai/Index.tsx resources/js/Pages/AssetCategories/Index.tsx tests/Feature/ImportControllerTest.php
git commit -m "feat(import): import page and import/export buttons"
```

---

### Task 10: Dokumentasi queue, catatan keputusan, verifikasi akhir

**Files:**
- Create: `docs/ops/queue-setup.md`
- Modify: `docs/superpowers/specs/2026-10-08-import-ekspor-design.md` (tambah bagian "9. Keputusan saat implementasi")

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: panduan setup queue worker dev dan produksi; spec yang sinkron dengan implementasi.

- [ ] **Step 1: Tulis panduan queue**

`docs/ops/queue-setup.md`:

````markdown
# Setup Queue Worker (Import Excel)

Import Excel berjalan di antrean (`QUEUE_CONNECTION=database`, tabel `jobs`). **Tanpa worker yang aktif, batch import berhenti di status "Memeriksa" dan tidak pernah selesai.** Scheduler harian (`import:prune`) juga butuh cron.

## Variabel .env

```
QUEUE_CONNECTION=database
DB_QUEUE_RETRY_AFTER=900
```

`DB_QUEUE_RETRY_AFTER` (detik) **harus lebih besar** dari `import.job_timeout` (600 detik, `config/import.php`). Bila lebih kecil, job yang masih berjalan dianggap macet dan dijalankan ganda. Test `ImportFoundationTest` menjaga hal ini.

## Development

Cara termudah: `composer dev` (menjalankan server, `queue:listen`, log, dan Vite sekaligus). `queue:listen` memuat ulang kode di setiap job, jadi perubahan kode langsung berlaku.

Hanya worker saja: `php artisan queue:listen --tries=1 --timeout=0`.

Cek cepat: unggah template kategori di halaman Impor; status harus berubah dari "Memeriksa" ke "Siap dikonfirmasi" dalam hitungan detik. Bila tetap "Memeriksa", worker tidak berjalan.

## Produksi (Ubuntu, Nginx + PHP-FPM, Supervisor)

1. Pasang Supervisor: `sudo apt install supervisor`.
2. `/etc/supervisor/conf.d/sibima-queue.conf`:

```ini
[program:sibima-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/sibima/artisan queue:work database --sleep=3 --tries=1 --timeout=600 --max-time=3600 --memory=512
directory=/var/www/sibima
user=www-data
numprocs=1
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stopwaitsecs=660
redirect_stderr=true
stdout_logfile=/var/www/sibima/storage/logs/queue-worker.log
```

3. Aktifkan: `sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start sibima-queue:*`.
4. Cron untuk scheduler (`import:prune` harian): `* * * * * cd /var/www/sibima && php artisan schedule:run >> /dev/null 2>&1` (crontab user `www-data`).
5. Batas unggahan: Nginx `client_max_body_size 8m;`, `php.ini` (FPM) `upload_max_filesize=8M` dan `post_max_size=8M`. Batas aplikasi 5 MB dan 10.000 baris ada di `config/import.php`.
6. Memori: worker memakai `memory_limit` CLI; `--memory=512` membuat worker restart bila melewati 512 MB. Pembacaan Excel per chunk 500 baris sehingga kebutuhan nyata jauh di bawah itu.

## Setiap deploy

```
php artisan migrate --force
php artisan db:seed --class=PermissionSeeder --force
php artisan queue:restart
```

`queue:restart` membuat worker memuat kode baru setelah job berjalan selesai. `PermissionSeeder` idempotent (aman diulang) dan menugaskan permission import/ekspor ke role.

## Pemecahan masalah

| Gejala | Pemeriksaan |
|---|---|
| Batch tetap "Memeriksa" | `sudo supervisorctl status`; lihat `storage/logs/queue-worker.log`. |
| Batch "Gagal" | `storage/logs/laravel.log` (detail teknis tidak ditampilkan ke pengguna); `php artisan queue:failed`. |
| Impor jalan dua kali | `DB_QUEUE_RETRY_AFTER` lebih kecil dari timeout job. |
| Batch "Siap" lama tidak berubah | Normal: dikedaluwarsakan setelah 7 hari oleh `import:prune` (butuh cron aktif). |
````

- [ ] **Step 2: Sinkronkan spec dengan keputusan implementasi**

Di akhir `docs/superpowers/specs/2026-10-08-import-ekspor-design.md` tambahkan:

```markdown

---

## 9. Keputusan saat implementasi

Penyesuaian terhadap bagian di atas yang diputuskan saat menulis plan (`docs/superpowers/plans/2026-10-08-import-ekspor.md`):

- **Laporan error tidak disimpan** (`path_error` dihapus dari §3.1): dibuat saat diminta dari berkas hasil validasi.
- **Transaksi per baris, bukan per chunk** (§3.2): satu baris gagal tidak membatalkan baris lain; chunk hanya menentukan seberapa sering `progres` diperbarui.
- **Tombol "Unduh template" ada di halaman Impor**, bukan di halaman modul (§5): halaman modul hanya punya "Impor" dan "Ekspor".
- **Batch terlihat oleh pengunggahnya dan oleh akun dengan cakupan unit tanpa batas** (`accessibleUnitIds() === null`), bukan per unit batch (§3.4): batch tidak punya unit.
- **Permission dibagikan ke frontend** sebagai `auth.user.permissions`; tombol Impor/Ekspor memeriksa nama permission, bukan role.
- **Validasi unggahan memakai `extensions:xlsx`**, bukan `mimes`, karena deteksi MIME berkas xlsx kecil tidak konsisten; berkas yang bukan xlsx sungguhan ditolak oleh pembaca dengan pesan yang sama.
- **Interface `Importer` tidak dibuat**: `Importer` adalah kelas abstrak (satu hierarki, tiga turunan) yang juga memuat helper bersama.
- **Satu job `ProcessImportJob` dengan fase `validate`/`commit`**, bukan dua kelas job.
- **Antrean:** `retry_after` database dinaikkan ke 900 detik (> timeout job 600 detik); panduan setup di `docs/ops/queue-setup.md`.
```

- [ ] **Step 3: Verifikasi akhir**

Run: `php artisan test` lalu `npx tsc --noEmit` lalu `npm run build`
Expected: seluruh suite hijau (baseline 464 + test baru), `tsc` tanpa error, build sukses. Jangan membuka browser; cek UI manual menunggu perintah pengguna.

- [ ] **Step 4: Commit**

```bash
git add docs/ops/queue-setup.md docs/superpowers/specs/2026-10-08-import-ekspor-design.md
git commit -m "docs: queue worker setup for dev and prod, record import/export implementation rulings"
```
