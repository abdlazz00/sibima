<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class WorkflowDefinition extends Model
{
    use LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('alur')
            ->logOnly(['code', 'name'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    protected $fillable = ['code', 'name'];

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class)->orderBy('step_order');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class);
    }

    public function changeLogs(): HasMany
    {
        return $this->hasMany(WorkflowChangeLog::class)->latest('id');
    }
}
