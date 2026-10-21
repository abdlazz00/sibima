<?php

namespace App\Models;

use App\Enums\StatusKepegawaian;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Pegawai extends Model
{
    use HasFactory, LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('pegawai')
            ->logOnly(['nama', 'nip', 'pangkat_golongan', 'jabatan', 'status_kepegawaian', 'unit_id', 'no_hp', 'email_dinas'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    protected $fillable = [
        'nama',
        'nip',
        'pangkat_golongan',
        'jabatan',
        'status_kepegawaian',
        'unit_id',
        'foto_profile',
        'no_hp',
        'email_dinas',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'status_kepegawaian' => StatusKepegawaian::class,
            'unit_id' => 'integer',
            'user_id' => 'integer',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'current_holder_id');
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $ids = $user->accessibleUnitIds();

        if ($ids !== null) {
            $query->whereIn('unit_id', $ids);
        }
    }
}
