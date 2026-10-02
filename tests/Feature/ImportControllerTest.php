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
