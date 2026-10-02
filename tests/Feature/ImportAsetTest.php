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
