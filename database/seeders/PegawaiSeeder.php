<?php

namespace Database\Seeders;

use App\Enums\StatusKepegawaian;
use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\Seeder;
use PhpOffice\PhpSpreadsheet\IOFactory;

class PegawaiSeeder extends Seeder
{
    /**
     * Jalankan seeder untuk data pegawai dari Excel absensi riil.
     */
    public function run(): void
    {
        $filePath = base_path('docs/ABSENN STAF PNS DAN PPPK.xlsx');

        if (! file_exists($filePath)) {
            $this->fallbackSeed();

            return;
        }

        ini_set('memory_limit', '512M');

        $reader = IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($filePath);

        $units = Unit::all()->keyBy('name');
        $kecamatan = Unit::where('type', 'kecamatan')->first() ?? Unit::first();

        $sheetsConfig = [
            'ABSEN KECAMATAN SAGULUNG' => 'auto',
            'ABSEN STAF PNS' => 'pns',
            'Absen Staf PPPK' => 'pppk',
        ];

        $pegawais = [];

        foreach ($sheetsConfig as $sheetName => $defaultStatus) {
            $sheet = $spreadsheet->getSheetByName($sheetName);
            if (! $sheet) {
                continue;
            }

            $highestRow = $sheet->getHighestRow();

            for ($r = 10; $r <= $highestRow; $r++) {
                $nama = trim((string) $sheet->getCell('B'.$r)->getValue());
                if ($nama === '' || preg_match('/^(jumlah|total|rekap)/i', $nama)) {
                    continue;
                }

                $nipRaw = (string) $sheet->getCell('C'.$r)->getValue();
                $cleanNip = preg_replace('/[^0-9]/', '', $nipRaw);
                $nip = strlen($cleanNip) >= 9 ? $cleanNip : null;

                $gol = trim((string) $sheet->getCell('D'.$r)->getValue()) ?: null;
                $jabatan = trim(preg_replace('/\s+/', ' ', (string) $sheet->getCell('E'.$r)->getValue()));

                if ($defaultStatus === 'auto') {
                    if (in_array(strtoupper($gol ?? ''), ['IX', 'V', 'VII', 'X', 'XI', 'XII', 'VIII', 'VI'])) {
                        $status = StatusKepegawaian::Pppk;
                    } else {
                        $status = StatusKepegawaian::Pns;
                    }
                } elseif ($defaultStatus === 'pppk') {
                    $status = StatusKepegawaian::Pppk;
                } else {
                    $status = StatusKepegawaian::Pns;
                }

                $unitName = $this->resolveUnitName($jabatan);
                $unit = $units->get($unitName) ?? $kecamatan;

                $dedupKey = $nip ? 'nip:'.$nip : 'name:'.strtolower($nama).':'.$unit->id;

                if (! isset($pegawais[$dedupKey])) {
                    $pegawais[$dedupKey] = [
                        'nama' => $nama,
                        'nip' => $nip,
                        'pangkat_golongan' => $gol,
                        'jabatan' => $jabatan,
                        'status_kepegawaian' => $status,
                        'unit_id' => $unit->id,
                    ];
                } else {
                    if (! $pegawais[$dedupKey]['nip'] && $nip) {
                        $pegawais[$dedupKey]['nip'] = $nip;
                    }
                    if (! $pegawais[$dedupKey]['pangkat_golongan'] && $gol) {
                        $pegawais[$dedupKey]['pangkat_golongan'] = $gol;
                    }
                }
            }
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        foreach ($pegawais as $data) {
            Pegawai::updateOrCreate(
                ['nama' => $data['nama'], 'unit_id' => $data['unit_id']],
                $data
            );
        }

        $count = count($pegawais);
        $this->command?->info("Berhasil mengimpor {$count} data pegawai dari Excel absensi.");
    }

    /**
     * Memetakan nama unit kerja berdasarkan keterangan jabatan pegawai.
     */
    private function resolveUnitName(string $jabatan): string
    {
        $j = strtolower($jabatan);

        if (str_contains($j, 'sagulung kota')) {
            return 'Kelurahan Sagulung Kota';
        }

        if (str_contains($j, 'sei binti') || str_contains($j, 'sungai binti')) {
            return 'Kelurahan Sungai Binti';
        }

        if (str_contains($j, 'sei langkai') || str_contains($j, 'sungai langkai') || str_contains($j, 'kelurahan langkai')) {
            return 'Kelurahan Sungai Langkai';
        }

        if (str_contains($j, 'sei lekop') || str_contains($j, 'sungai lekop')) {
            return 'Kelurahan Sungai Lekop';
        }

        if (str_contains($j, 'sei pelunggut') || str_contains($j, 'sungai pelunggut')) {
            return 'Kelurahan Sungai Pelunggut';
        }

        if (str_contains($j, 'tembesi')) {
            return 'Kelurahan Tembesi';
        }

        return 'Kecamatan Sagulung';
    }

    /**
     * Seeder cadangan jika berkas Excel absensi tidak tersedia.
     */
    private function fallbackSeed(): void
    {
        $kecamatan = Unit::where('type', 'kecamatan')->firstOrFail();
        $kelurahan = Unit::where('type', 'kelurahan')->firstOrFail();

        $pegawais = [
            [
                'nama' => 'Ahmad Fauzi',
                'nip' => '198501012010011001',
                'pangkat_golongan' => 'Penata Muda / III.a',
                'jabatan' => 'Staff Kecamatan',
                'status_kepegawaian' => StatusKepegawaian::Pns,
                'unit_id' => $kecamatan->id,
            ],
            [
                'nama' => 'Siti Aminah',
                'nip' => null,
                'pangkat_golongan' => null,
                'jabatan' => 'Staff Kelurahan',
                'status_kepegawaian' => StatusKepegawaian::Pppk,
                'unit_id' => $kelurahan->id,
            ],
        ];

        foreach ($pegawais as $data) {
            Pegawai::firstOrCreate(['nama' => $data['nama'], 'unit_id' => $data['unit_id']], $data);
        }
    }
}
