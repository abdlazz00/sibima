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
