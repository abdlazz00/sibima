<?php

namespace App\Models;

use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), [
            'is_system' => 'boolean',
        ]);
    }
}
