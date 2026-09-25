<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    /** Kategori => Subkategori, taken from the client's DATA MASTER sheet (docs/PHOTO BARANG.xlsx). */
    private const CATEGORIES = [
        'ALAT ANGKUTAN DARAT BERMOTOR' => [
            'KENDARAAN BERMOTOR ANGKUTAN BARANG',
            'KENDARAAN BERMOTOR BERODA DUA',
            'KENDARAAN DINAS BERMOTOR PERORANGAN',
        ],
        'ALAT KANTOR' => ['ALAT KANTOR LAINNYA', 'ALAT PENYIMPAN PERLENGKAPAN KANTOR'],
        'ALAT RUMAH TANGGA' => ['ALAT DAPUR', 'ALAT PENDINGIN', 'ALAT RUMAH TANGGA LAINNYA (HOME USE)', 'MEUBELAIR'],
        'ALAT STUDIO' => ['PERALATAN STUDIO VIDEO DAN FILM'],
        'KOMPUTER UNIT' => ['PERSONAL KOMPUTER'],
        'MEJA DAN KURSI KERJA/RAPAT PEJABAT' => ['KURSI KERJA PEJABAT', 'LEMARI DAN ARSIP PEJABAT', 'MEJA KERJA PEJABAT'],
        'PERALATAN KOMPUTER' => ['PERALATAN PERSONAL KOMPUTER'],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $kategori => $subkategori) {
            $parent = AssetCategory::firstOrCreate(['name' => $kategori, 'parent_id' => null]);

            foreach ($subkategori as $name) {
                AssetCategory::firstOrCreate(['name' => $name, 'parent_id' => $parent->id]);
            }
        }
    }
}
