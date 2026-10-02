<?php

namespace App\Console\Commands;

use App\Services\ImportService;
use Illuminate\Console\Command;

class PruneImports extends Command
{
    protected $signature = 'import:prune';

    protected $description = 'Kedaluwarsakan batch import yang siap tetapi tidak dikonfirmasi dan hapus berkasnya';

    public function handle(ImportService $imports): int
    {
        $this->info($imports->prune().' batch dikedaluwarsakan.');

        return self::SUCCESS;
    }
}
