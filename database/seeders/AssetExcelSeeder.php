<?php

namespace Database\Seeders;

use App\Enums\AssetStatus;
use App\Enums\Kondisi;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class AssetExcelSeeder extends Seeder
{
    /**
     * Menginjeksi data aset riil dari template Excel Kecamatan Sagulung.
     */
    public function run(): void
    {
        ini_set('memory_limit', '1024M');

        $file = base_path('docs/Template_Database_Aset_Kecamatan_Sagulung.xlsx');
        if (! file_exists($file)) {
            $this->command?->error("File template tidak ditemukan di: {$file}");

            return;
        }

        $hasAssets = Asset::exists();
        if ($hasAssets && $this->command && ! $this->command->hasOption('force')) {
            $isInteractive = method_exists($this->command->getOutput(), 'isInteractive')
                ? $this->command->getOutput()->isInteractive()
                : true;

            if ($isInteractive && ! $this->command->confirm('Database sudah memiliki aset. Kosongkan aset & transaksi lama untuk impor ulang dari Excel template?', false)) {
                $this->command->warn('Dibatalkan, data aset tidak diubah.');

                return;
            }
        }

        // 1. Bersihkan tabel transaksi dan data aset lama jika tabel ada isinya
        if ($hasAssets) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            DB::table('asset_mutation_items')->truncate();
            DB::table('asset_mutations')->truncate();
            DB::table('berita_acara_items')->truncate();
            DB::table('berita_acara_penerimaans')->truncate();
            DB::table('asset_reports')->truncate();
            DB::table('asset_requests')->truncate();
            DB::table('approval_actions')->truncate();
            DB::table('approval_request_steps')->truncate();
            DB::table('approval_requests')->truncate();
            DB::table('workflow_change_logs')->truncate();
            DB::table('notifications')->truncate();
            DB::table('asset_histories')->truncate();
            DB::table('asset_photos')->truncate();
            DB::table('assets')->truncate();

            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        }

        // 2. Baca file Excel template database aset
        $reader = IOFactory::createReaderForFile($file);
        $reader->setReadDataOnly(true);
        $reader->setLoadSheetsOnly(['MASTER_ASET']);
        $spreadsheet = $reader->load($file);
        $sheet = $spreadsheet->getActiveSheet();
        $highestRow = $sheet->getHighestRow();

        // 3. Cache data Unit dan Pegawai
        $units = Unit::all()->keyBy(fn (Unit $u): string => strtolower(trim($u->name)));
        $defaultUnit = Unit::where('type', 'kecamatan')->first() ?? Unit::first();
        $allPegawais = Pegawai::all();

        // 4. Injeksi baris demi baris
        $insertedCount = 0;

        for ($r = 3; $r <= $highestRow; $r++) {
            $namaAset = trim((string) $sheet->getCell('F'.$r)->getValue());
            if ($namaAset === '') {
                continue;
            }

            $kodeBarang = trim((string) $sheet->getCell('D'.$r)->getValue());
            $nomorRegister = (int) $sheet->getCell('E'.$r)->getValue();
            $catName = trim((string) $sheet->getCell('G'.$r)->getValue());
            $subName = trim((string) $sheet->getCell('H'.$r)->getValue());
            $subCode = trim((string) $sheet->getCell('B'.$r)->getValue());
            $merkType = trim((string) $sheet->getCell('I'.$r)->getValue());
            $rawDate = trim((string) $sheet->getCell('L'.$r)->getValue());
            $sumberPerolehan = trim((string) $sheet->getCell('M'.$r)->getValue());
            $hargaPerolehan = (float) str_replace([',', ' '], '', (string) $sheet->getCell('N'.$r)->getValue());
            $nilaiBuku = (float) str_replace([',', ' '], '', (string) $sheet->getCell('O'.$r)->getValue());
            $kondisiRaw = trim((string) $sheet->getCell('P'.$r)->getValue());
            $statusRaw = trim((string) $sheet->getCell('Q'.$r)->getValue());
            $unitName = trim((string) $sheet->getCell('S'.$r)->getValue());
            $penanggungJawab = trim((string) $sheet->getCell('T'.$r)->getValue());
            $noDokumen = trim((string) $sheet->getCell('U'.$r)->getValue());
            $keterangan = trim((string) $sheet->getCell('W'.$r)->getValue());

            // Kategori Induk & Subkategori
            $parentCategory = AssetCategory::firstOrCreate(
                ['name' => $catName, 'parent_id' => null]
            );

            $subCategory = AssetCategory::firstOrCreate(
                ['name' => $subName, 'parent_id' => $parentCategory->id],
                ['code' => $subCode ?: null]
            );

            if ($subCode && empty($subCategory->code)) {
                $subCategory->update(['code' => $subCode]);
            }

            // Unit Kerja
            $unitKey = strtolower($unitName);
            $unit = $units->get($unitKey);
            if (! $unit) {
                $unit = $defaultUnit;
                $this->command?->warn("Baris {$r}: unit '{$unitName}' tidak dikenal, dipakai {$defaultUnit->name}.");
            }

            // Tanggal Perolehan
            $tanggalPerolehan = '2023-01-01';
            if ($rawDate !== '') {
                try {
                    $tanggalPerolehan = Carbon::createFromFormat('d-m-Y', $rawDate)->format('Y-m-d');
                } catch (\Throwable) {
                    $parsed = strtotime($rawDate);
                    $tanggalPerolehan = $parsed ? date('Y-m-d', $parsed) : '2023-01-01';
                    $this->command?->warn("Baris {$r}: tanggal '{$rawDate}' tidak sesuai d-m-Y, ".($parsed ? 'ditebak' : 'dipakai 2023-01-01').'.');
                }
            }

            // Kondisi Aset
            $kondisi = match (strtolower($kondisiRaw)) {
                'rusak ringan', 'rusak_ringan' => Kondisi::RusakRingan,
                'rusak berat', 'rusak_berat' => Kondisi::RusakBerat,
                'hilang' => Kondisi::Hilang,
                default => Kondisi::Baik,
            };

            // Status Aset
            $status = match (strtolower($statusRaw)) {
                'dalam proses', 'dalam_proses' => AssetStatus::DalamProses,
                default => AssetStatus::Aktif,
            };

            // Pemegang / Penanggung Jawab
            $holderId = $this->resolveHolderId($penanggungJawab, $unit, $allPegawais);

            Asset::create([
                'qr_token' => Str::random(16),
                'kode_barang' => $kodeBarang,
                'nomor_register' => $nomorRegister,
                'nama_aset' => $namaAset,
                'category_id' => $subCategory->id,
                'unit_id' => $unit->id,
                'current_holder_id' => $holderId,
                'merk_type' => $merkType ?: null,
                'kondisi' => $kondisi,
                'status' => $status,
                'tanggal_perolehan' => $tanggalPerolehan,
                'sumber_perolehan' => $sumberPerolehan ?: 'Belanja Modal',
                'nilai_perolehan' => $hargaPerolehan,
                'nilai_buku' => $nilaiBuku,
                'no_dokumen' => $noDokumen ?: null,
                'keterangan' => $keterangan ?: null,
            ]);

            $insertedCount++;
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        $this->command?->info("Berhasil menginjeksi {$insertedCount} data aset riil dari template Excel!");
    }

    /**
     * Resolusi ID Pegawai pemegang aset secara cerdas berdasarkan nama/jabatan penanggung jawab.
     *
     * @param  Collection<int, Pegawai>  $allPegawais
     */
    private function resolveHolderId(string $penanggungJawab, Unit $unit, $allPegawais): ?int
    {
        $pj = trim($penanggungJawab);
        if ($pj === '') {
            return null;
        }

        // 1. Jika penanggung jawab adalah Camat, langsung arahkan ke Camat Sagulung
        if (stripos($pj, 'camat') !== false) {
            $camat = $allPegawais->first(function (Pegawai $p): bool {
                return stripos($p->jabatan, 'Camat Sagulung') !== false || stripos($p->jabatan, 'Camat') !== false;
            });

            if ($camat) {
                return $camat->id;
            }
        }

        // 2. Jika penanggung jawab adalah Lurah, cari Lurah di unit tersebut
        if (stripos($pj, 'lurah') !== false) {
            $lurah = $allPegawais->first(function (Pegawai $p) use ($unit): bool {
                return $p->unit_id === $unit->id && (
                    stripos($p->jabatan, 'Lurah') === 0 ||
                    stripos($p->jabatan, 'Lurah '.$unit->name) !== false
                );
            });

            if ($lurah) {
                return $lurah->id;
            }
        }

        // 3. Cari pegawai dalam unit yang sama berdasarkan kecocokan nama atau jabatan
        $holderInUnit = $allPegawais->first(function (Pegawai $p) use ($pj, $unit): bool {
            if ($p->unit_id !== $unit->id) {
                return false;
            }

            return stripos($p->nama, $pj) !== false || stripos($p->jabatan, $pj) !== false;
        });

        if ($holderInUnit) {
            return $holderInUnit->id;
        }

        // 4. Fallback: cari pegawai di seluruh unit
        $fallback = $allPegawais->first(function (Pegawai $p) use ($pj): bool {
            return stripos($p->nama, $pj) !== false || stripos($p->jabatan, $pj) !== false;
        });

        return $fallback?->id;
    }
}
