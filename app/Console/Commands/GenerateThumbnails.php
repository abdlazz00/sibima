<?php

namespace App\Console\Commands;

use App\Models\AssetPhoto;
use App\Models\Pegawai;
use App\Models\User;
use App\Services\ThumbnailService;
use Illuminate\Console\Command;

class GenerateThumbnails extends Command
{
    protected $signature = 'sibima:generate-thumbnails {--force : Generate ulang thumbnail meskipun sudah ada}';

    protected $description = 'Generate thumbnail WebP ringan (96x96) untuk semua foto aset, pegawai, dan pengguna';

    public function handle(ThumbnailService $thumbnails): int
    {
        $this->info('Memulai pembuatan thumbnail foto (Aset, Pegawai, Pengguna)...');

        $paths = collect();

        // 1. Asset Photos
        foreach (AssetPhoto::all() as $photo) {
            if ($photo->path) {
                $paths->push(['type' => 'Aset', 'path' => $photo->path]);
            }
        }

        // 2. Pegawai Photos
        foreach (Pegawai::whereNotNull('foto_profile')->get() as $p) {
            $paths->push(['type' => 'Pegawai', 'path' => $p->foto_profile]);
        }

        // 3. User Photos
        foreach (User::whereNotNull('foto_profile')->get() as $u) {
            $paths->push(['type' => 'Pengguna', 'path' => $u->foto_profile]);
        }

        $paths = $paths->unique('path')->values();
        $total = $paths->count();

        if ($total === 0) {
            $this->info('Tidak ada foto yang perlu diproses.');

            return self::SUCCESS;
        }

        $this->info("Ditemukan {$total} berkas foto unik untuk dibuatkan thumbnail.");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $success = 0;
        $failed = 0;

        foreach ($paths as $item) {
            $generated = $thumbnails->generate($item['path']);
            if ($generated) {
                $success++;
            } else {
                $failed++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['Metrik', 'Jumlah'],
            [
                ['Total Foto Diproses', $total],
                ['Thumbnail Berhasil Dibuat', $success],
                ['Gagal / Berkas Tidak Ada di Disk', $failed],
            ]
        );

        return self::SUCCESS;
    }
}
