<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;

class LoginLog extends Model
{
    use MassPrunable;

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'identifier', 'event', 'ip_address', 'user_agent'];

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(90));
    }
}
