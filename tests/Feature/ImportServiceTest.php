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
    $old = $this->service->upload('kategori', impKatFile([['A', null, 'a', null, null]]), $this->kasubag)->refresh();
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
