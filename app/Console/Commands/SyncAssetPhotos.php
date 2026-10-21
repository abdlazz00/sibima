<?php

namespace App\Console\Commands;

use App\Models\Asset;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class SyncAssetPhotos extends Command
{
    protected $signature = 'sibima:sync-asset-photos 
                            {--file=docs/PHOTO BARANG.xlsx : Lokasi file Excel foto barang}
                            {--limit=0 : Batasi jumlah foto yang diunduh (0 untuk semua)}
                            {--overwrite : Unduh ulang foto meskipun aset sudah memiliki foto}';

    protected $description = 'Sinkronisasi dan unduh foto aset dari Google Drive di spreadsheet PHOTO BARANG ke storage SIBIMA';

    public function handle(): int
    {
        ini_set('memory_limit', '1024M');

        $jsonPath = database_path('seeders/data/asset_photos_mapping.json');
        $customFile = (string) $this->option('file');
        $excelPath = base_path($customFile);

        $photoEntries = [];

        if (file_exists($jsonPath) && ($customFile === 'docs/PHOTO BARANG.xlsx' || ! file_exists($excelPath))) {
            $this->info("Membaca pemetaan foto dari: {$jsonPath}...");
            $photoEntries = json_decode((string) file_get_contents($jsonPath), true) ?: [];
        } elseif (file_exists($excelPath)) {
            $this->info("Membaca berkas foto Excel: {$excelPath}...");

            $reader = IOFactory::createReaderForFile($excelPath);
            $reader->setLoadSheetsOnly(['DATA MASTER']);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($excelPath);

            $sheet = $spreadsheet->getActiveSheet();
            $highestRow = $sheet->getHighestRow();

            for ($r = 2; $r <= $highestRow; $r++) {
                $kib = trim((string) $sheet->getCell("A{$r}")->getValue());
                $regRaw = trim((string) $sheet->getCell("M{$r}")->getValue());
                $url = trim((string) $sheet->getCell("N{$r}")->getValue());

                if ($kib === '' || $regRaw === '' || $url === '') {
                    continue;
                }

                if (preg_match('/id=([a-zA-Z0-9_-]+)/', $url, $m)) {
                    $photoEntries[] = [
                        'row' => $r,
                        'kode_barang' => $kib,
                        'nomor_register' => (int) $regRaw,
                        'drive_id' => $m[1],
                        'url' => $url,
                    ];
                }
            }

            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        } else {
            $this->error("Berkas foto tidak ditemukan di {$jsonPath} maupun {$excelPath}");

            return self::FAILURE;
        }

        $totalFound = count($photoEntries);
        $this->info("Ditemukan {$totalFound} tautan foto Google Drive siap diproses.");

        $limit = (int) $this->option('limit');
        if ($limit > 0 && $limit < $totalFound) {
            $photoEntries = array_slice($photoEntries, 0, $limit);
            $this->comment("Dibatasi hingga {$limit} foto sesuai opsi --limit.");
        }

        $successCount = 0;
        $skippedCount = 0;
        $failedCount = 0;
        $notFoundCount = 0;

        $bar = $this->output->createProgressBar(count($photoEntries));
        $bar->start();

        foreach ($photoEntries as $entry) {
            $kodeBarang = $entry['kode_barang'] ?? $entry['kib'] ?? null;
            $reg = (int) ($entry['nomor_register'] ?? $entry['reg'] ?? 0);

            $asset = Asset::where('kode_barang', $kodeBarang)
                ->where('nomor_register', $reg)
                ->first();

            if (! $asset) {
                $notFoundCount++;
                $bar->advance();

                continue;
            }

            if (! $this->option('overwrite') && $asset->photos()->exists()) {
                $skippedCount++;
                $bar->advance();

                continue;
            }

            $downloadUrl = "https://drive.usercontent.google.com/download?id={$entry['drive_id']}&export=view";

            try {
                $response = Http::withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                ])->timeout(25)->get($downloadUrl);

                if (! $response->successful()) {
                    // Fallback to alternative Google Drive endpoint
                    $altUrl = "https://drive.google.com/uc?export=download&id={$entry['drive_id']}";
                    $response = Http::withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    ])->timeout(25)->get($altUrl);
                }

                if ($response->successful()) {
                    $body = $response->body();
                    $filename = Str::random(32).'.jpg';
                    $storagePath = "assets/{$asset->id}/{$filename}";

                    Storage::disk('public')->put($storagePath, $body);

                    if ($this->option('overwrite')) {
                        // Hapus foto lama jika overwrite
                        foreach ($asset->photos as $oldPhoto) {
                            Storage::disk('public')->delete($oldPhoto->path);
                            $oldPhoto->delete();
                        }
                    }

                    $asset->photos()->create([
                        'path' => $storagePath,
                    ]);

                    $successCount++;
                } else {
                    $failedCount++;
                }
            } catch (\Throwable $e) {
                $failedCount++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['Metrik', 'Jumlah'],
            [
                ['Total Tautan Diproses', count($photoEntries)],
                ['Berhasil Diunduh & Tersimpan', $successCount],
                ['Dilewati (Sudah ada foto)', $skippedCount],
                ['Aset Belum Ada di Database', $notFoundCount],
                ['Gagal Unduh / Timeout', $failedCount],
            ]
        );

        return self::SUCCESS;
    }
}
