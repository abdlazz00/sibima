<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    /**
     * Kategori => [Subkategori => kode BMD resmi].
     * Kode diambil dari docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx (sheet MASTER_ASET, 341 baris data real).
     */
    private const CATEGORIES = [
        'ALAT ANGKUTAN DARAT BERMOTOR' => [
            'KENDARAAN BERMOTOR ANGKUTAN BARANG' => '1.3.2.02.01.03',
            'KENDARAAN BERMOTOR BERODA DUA' => '1.3.2.02.01.04',
            'KENDARAAN DINAS BERMOTOR PERORANGAN' => '1.3.2.02.01.01',
        ],
        'ALAT KANTOR' => [
            'ALAT KANTOR LAINNYA' => '1.3.2.05.01.05',
            'ALAT PENYIMPAN PERLENGKAPAN KANTOR' => '1.3.2.05.01.04',
        ],
        'ALAT RUMAH TANGGA' => [
            'ALAT DAPUR' => '1.3.2.05.02.05',
            'ALAT PENDINGIN' => '1.3.2.05.02.04',
            'ALAT RUMAH TANGGA LAINNYA (HOME USE)' => '1.3.2.05.02.06',
            'MEUBELAIR' => '1.3.2.05.02.01',
        ],
        'ALAT STUDIO' => [
            'PERALATAN STUDIO VIDEO DAN FILM' => '1.3.2.06.01.02',
        ],
        'KOMPUTER UNIT' => [
            'PERSONAL KOMPUTER' => '1.3.2.10.01.02',
        ],
        'MEJA DAN KURSI KERJA/RAPAT PEJABAT' => [
            'KURSI KERJA PEJABAT' => '1.3.2.05.03.03',
            'LEMARI DAN ARSIP PEJABAT' => '1.3.2.05.03.07',
            'MEJA KERJA PEJABAT' => '1.3.2.05.03.01',
        ],
        'PERALATAN KOMPUTER' => [
            'PERALATAN PERSONAL KOMPUTER' => '1.3.2.10.02.03',
        ],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $kategori => $subkategori) {
            $parent = AssetCategory::updateOrCreate(
                ['name' => $kategori, 'parent_id' => null],
                []
            );

            foreach ($subkategori as $name => $code) {
                AssetCategory::updateOrCreate(
                    ['name' => $name, 'parent_id' => $parent->id],
                    ['code' => $code]
                );
            }
        }
    }
}
