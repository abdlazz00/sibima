<?php

namespace App\Enums;

enum UnitScope: string
{
    case None = 'none';
    case Subject = 'subject';
    case Origin = 'origin';
    case Destination = 'destination';
}
