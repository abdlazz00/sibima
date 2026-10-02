<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Services\ImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessImportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout;

    /** @param 'validate'|'commit' $phase */
    public function __construct(public int $batchId, public string $phase)
    {
        $this->timeout = (int) config('import.job_timeout');
    }

    public function handle(ImportService $imports): void
    {
        $batch = ImportBatch::findOrFail($this->batchId);

        $this->phase === 'validate' ? $imports->validate($batch) : $imports->commit($batch);
    }

    public function failed(Throwable $e): void
    {
        app(ImportService::class)->fail($this->batchId, $e);
    }
}
