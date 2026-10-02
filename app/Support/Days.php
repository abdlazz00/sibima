<?php

namespace App\Support;

use Carbon\CarbonInterface;

class Days
{
    /** Days from $from to $to with one decimal (both the page and the Excel use this so they round alike). */
    public static function between(CarbonInterface $from, CarbonInterface $to): float
    {
        return round(($to->getTimestamp() - $from->getTimestamp()) / 86400, 1);
    }
}
