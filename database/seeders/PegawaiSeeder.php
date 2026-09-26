<?php

namespace Database\Seeders;

use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class PegawaiSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::where('type', 'kecamatan')->firstOrFail();
        $kelurahan = Unit::where('type', 'kelurahan')->firstOrFail();

        $pegawais = [
            [
                'nama' => 'Ahmad Fauzi',
                'nip' => '198501012010011001',
                'pangkat_golongan' => 'Penata Muda / III.a',
                'jabatan' => 'Staff Kecamatan',
                'status_kepegawaian' => 'pns',
                'unit_id' => $kecamatan->id,
            ],
            [
                'nama' => 'Siti Aminah',
                'nip' => null,
                'pangkat_golongan' => null,
                'jabatan' => 'Staff Kelurahan',
                'status_kepegawaian' => 'pppk',
                'unit_id' => $kelurahan->id,
            ],
        ];

        foreach ($pegawais as $data) {
            Pegawai::firstOrCreate(['nama' => $data['nama'], 'unit_id' => $data['unit_id']], $data);
        }
    }
}
