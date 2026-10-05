<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $ids = [332, 333, 334, 335, 336];
        $targetKode = '1.3.2.10.02.03.005';

        // Check if records exist
        $existing = DB::table('assets')->whereIn('id', $ids)->orderBy('id')->pluck('id')->all();

        if (count($existing) === 5) {
            foreach ($existing as $idx => $id) {
                DB::table('assets')->where('id', $id)->update([
                    'kode_barang' => $targetKode,
                    'nomor_register' => $idx + 1,
                    'nama_aset' => 'Laptop asus #1',
                ]);
            }
        }
    }

    public function down(): void
    {
        $originalCodes = [
            332 => ['1.3.2.10.02.03.005', 'Laptop asus vivobook'],
            333 => ['1.3.2.10.02.03.006', 'Laptop asus #1'],
            334 => ['1.3.2.10.02.03.007', 'Laptop asus #1'],
            335 => ['1.3.2.10.02.03.008', 'Laptop asus #1'],
            336 => ['1.3.2.10.02.03.009', 'Laptop asus #1'],
        ];

        foreach ($originalCodes as $id => [$code, $name]) {
            DB::table('assets')->where('id', $id)->update([
                'kode_barang' => $code,
                'nomor_register' => 1,
                'nama_aset' => $name,
            ]);
        }
    }
};
