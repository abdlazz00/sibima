<?php

namespace App\Services;

use App\Imports\AsetImporter;
use App\Imports\Importer;
use App\Imports\KategoriImporter;
use App\Imports\PegawaiImporter;
use App\Jobs\ProcessImportJob;
use App\Models\ImportBatch;
use App\Models\User;
use App\Support\ExcelRows;
use App\Support\TabularExcel;
use Generator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Throwable;

class ImportService
{
    public const MODUL = [
        'kategori' => KategoriImporter::class,
        'pegawai' => PegawaiImporter::class,
        'aset' => AsetImporter::class,
    ];

    public static function importer(string $modul): Importer
    {
        return app(self::MODUL[$modul]);
    }

    public function upload(string $modul, UploadedFile $file, User $user): ImportBatch
    {
        $importer = self::importer($modul);
        $disk = Storage::disk('local');
        $path = $file->store('imports', 'local');

        try {
            $header = ExcelRows::headers($disk->path($path), count($importer->headers()));
            $total = ExcelRows::totalRows($disk->path($path));
        } catch (Throwable) {
            $disk->delete($path);

            throw ValidationException::withMessages(['berkas' => 'Berkas tidak dapat dibaca. Pastikan berformat .xlsx.']);
        }

        $reject = function (string $message) use ($disk, $path) {
            $disk->delete($path);

            throw ValidationException::withMessages(['berkas' => $message]);
        };

        if (array_map('mb_strtolower', $header) !== array_map('mb_strtolower', $importer->headers())) {
            $reject('Header kolom tidak sesuai template. Unduh template terbaru lalu salin data Anda ke sana.');
        }

        if ($total === 0) {
            $reject('Berkas tidak berisi data.');
        }

        if ($total > config('import.max_rows')) {
            $reject("Berkas berisi {$total} baris, melebihi batas ".config('import.max_rows').' baris per impor.');
        }

        $batch = ImportBatch::create([
            'modul' => $modul,
            'user_id' => $user->id,
            'nama_berkas' => $file->getClientOriginalName(),
            'path' => $path,
            'total_baris' => $total,
        ]);

        ProcessImportJob::dispatch($batch->id, 'validate');

        return $batch;
    }

    /** Dry-run: semua baris divalidasi, hasilnya ditulis ke berkas JSON-lines; tidak ada data modul yang berubah. */
    public function validate(ImportBatch $batch): void
    {
        $importer = self::importer($batch->modul);
        $importer->begin($batch->user);

        $disk = Storage::disk('local');
        $hasil = "imports/{$batch->id}-hasil.jsonl";
        $out = fopen($disk->path($hasil), 'w');
        $count = ['baru' => 0, 'duplikat' => 0, 'error' => 0];
        $done = 0;

        foreach (ExcelRows::chunks($disk->path($batch->path), $importer->headers(), config('import.chunk')) as $rows) {
            foreach ($rows as $no => $raw) {
                $result = $importer->validate($raw);
                $count[$result->status]++;

                fwrite($out, json_encode([
                    'row' => $no, 'status' => $result->status, 'errors' => $result->errors,
                    'warning' => $result->warning, 'raw' => $raw,
                ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n");
            }

            $done += count($rows);
            $batch->update(['progres' => $done]);
        }

        fclose($out);

        $batch->update([
            'status' => ImportBatch::SIAP,
            'path_hasil' => $hasil,
            'jumlah_baru' => $count['baru'],
            'jumlah_duplikat' => $count['duplikat'],
            'jumlah_error' => $count['error'],
            'progres' => $batch->total_baris,
        ]);
    }

    /** Klaim atomik: hanya satu pemanggil yang bisa memulai commit. */
    public function confirm(ImportBatch $batch): bool
    {
        $claimed = ImportBatch::whereKey($batch->id)
            ->where('status', ImportBatch::SIAP)
            ->where('jumlah_baru', '>', 0)
            ->update(['status' => ImportBatch::MEMPROSES, 'progres' => 0]);

        if ($claimed === 1) {
            ProcessImportJob::dispatch($batch->id, 'commit');
        }

        return $claimed === 1;
    }

    /**
     * Tiap baris baru divalidasi ulang (data bisa berubah sejak pratinjau) dan disimpan
     * dalam transaksinya sendiri, sehingga satu baris gagal tidak membatalkan yang lain.
     */
    public function commit(ImportBatch $batch): void
    {
        $importer = self::importer($batch->modul);
        $importer->begin($batch->user);

        $masuk = 0;
        $duplikat = $batch->jumlah_duplikat;
        $error = $batch->jumlah_error;
        $done = 0;

        foreach ($this->lines($batch) as $line) {
            if ($line['status'] !== 'baru') {
                continue;
            }

            $result = $importer->validate($line['raw']);

            if ($result->status === 'baru') {
                try {
                    DB::transaction(fn () => $importer->save($result->data));
                    $masuk++;
                } catch (Throwable $e) {
                    report($e);
                    $error++;
                }
            } elseif ($result->status === 'duplikat') {
                $duplikat++;
            } else {
                $error++;
            }

            if (++$done % config('import.chunk') === 0) {
                $batch->update(['progres' => $done, 'jumlah_masuk' => $masuk]);
            }
        }

        $batch->update([
            'status' => ImportBatch::SELESAI,
            'progres' => $batch->jumlah_baru,
            'jumlah_masuk' => $masuk,
            'jumlah_duplikat' => $duplikat,
            'jumlah_error' => $error,
        ]);
    }

    public function fail(int $batchId, Throwable $e): void
    {
        report($e);

        ImportBatch::whereKey($batchId)->update([
            'status' => ImportBatch::GAGAL,
            'pesan' => 'Proses impor gagal. Coba unggah ulang; bila berulang, hubungi administrator.',
        ]);
    }

    /** @return array{errors: list<array{baris: int, detail: list<array{kolom: string, alasan: string}>}>, peringatan: array<string, int>} */
    public function preview(ImportBatch $batch, int $limit = 50): array
    {
        $errors = [];
        $peringatan = [];

        foreach ($this->lines($batch) as $line) {
            if ($line['status'] === 'error' && count($errors) < $limit) {
                $errors[] = ['baris' => $line['row'], 'detail' => $line['errors']];
            }

            if ($line['status'] === 'baru' && $line['warning']) {
                $peringatan[$line['warning']] = ($peringatan[$line['warning']] ?? 0) + 1;
            }
        }

        return ['errors' => $errors, 'peringatan' => $peringatan];
    }

    /** Laporan dibuat saat diminta dari berkas hasil, bukan disimpan terpisah. */
    public function errorReport(ImportBatch $batch): Spreadsheet
    {
        $headers = self::importer($batch->modul)->headers();

        $rows = (function () use ($batch) {
            foreach ($this->lines($batch) as $line) {
                if ($line['status'] === 'error') {
                    yield [...array_values($line['raw']), implode('; ', array_map(
                        fn ($e) => "{$e['kolom']}: {$e['alasan']}", $line['errors'],
                    ))];
                }
            }
        })();

        return TabularExcel::build([...$headers, 'Alasan'], $rows);
    }

    /** Batch siap yang tak dikonfirmasi melewati masa simpan: berkas dihapus, status kedaluwarsa. */
    public function prune(): int
    {
        $stale = ImportBatch::where('status', ImportBatch::SIAP)
            ->where('created_at', '<', now()->subDays(config('import.expire_days')))->get();

        foreach ($stale as $batch) {
            Storage::disk('local')->delete(array_filter([$batch->path, $batch->path_hasil]));
            $batch->update(['status' => ImportBatch::KEDALUWARSA]);
        }

        return $stale->count();
    }

    /** @return Generator<int, array<string, mixed>> */
    private function lines(ImportBatch $batch): Generator
    {
        if ($batch->path_hasil === null || ! Storage::disk('local')->exists($batch->path_hasil)) {
            return;
        }

        $handle = fopen(Storage::disk('local')->path($batch->path_hasil), 'r');

        while (($line = fgets($handle)) !== false) {
            yield json_decode($line, true);
        }

        fclose($handle);
    }
}
