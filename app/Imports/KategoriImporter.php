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
