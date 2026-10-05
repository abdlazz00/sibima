<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'unit_id', 'unit_scope_override', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    protected $attributes = [
        'is_active' => true,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'unit_id' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function pegawai(): HasOne
    {
        return $this->hasOne(Pegawai::class);
    }

    public function approvalActions(): HasMany
    {
        return $this->hasMany(ApprovalAction::class);
    }

    protected function fotoProfileUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                $path = $this->pegawai?->foto_profile;
                return $path ? Storage::disk('public')->url($path) : null;
            }
        );
    }

    public function resolveUnitScope(): string
    {
        if ($this->unit_scope_override) {
            return $this->unit_scope_override;
        }

        /** @var \Spatie\Permission\Models\Role|null $role */
        $role = $this->roles->first();

        if ($role) {
            return $role->unit_scope ?? 'own';
        }

        return 'own';
    }

    /**
     * Unit ids this user may see: null means every unit.
     *
     * @return list<int>|null
     */
    public function accessibleUnitIds(): ?array
    {
        if ($this->getRoleNames()->isEmpty()) {
            return [];
        }

        $scope = $this->resolveUnitScope();

        if ($scope === 'all') {
            return null;
        }

        if ($this->unit_id === null) {
            return [];
        }

        if ($scope === 'binaan') {
            return Unit::query()
                ->where('id', $this->unit_id)
                ->orWhere('parent_id', $this->unit_id)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return [$this->unit_id];
    }

    /** Apakah seluruh permission dan cakupan ini tidak melebihi milik user ini (batas delegasi). */
    public function covers(array $permissions, string $scope = 'own'): bool
    {
        $rank = ['own' => 1, 'binaan' => 2, 'all' => 3];

        return array_diff($permissions, $this->getAllPermissions()->pluck('name')->all()) === []
            && $rank[$scope] <= $rank[$this->resolveUnitScope()];
    }

    /** Boleh mengelola akun lain: unitnya dalam cakupan dan akun itu tidak lebih berkuasa dari user ini. */
    public function canManage(self $target): bool
    {
        $ids = $this->accessibleUnitIds();

        return ($ids === null || in_array($target->unit_id, $ids, true))
            && $this->covers($target->getAllPermissions()->pluck('name')->all(), $target->resolveUnitScope());
    }

    /** Role dipakai lintas unit: user bercakupan sempit tidak boleh mengubahnya bila ada pemegang di luar cakupannya. */
    public function canManageRole(Role $role): bool
    {
        $ids = $this->accessibleUnitIds();

        return $this->covers($role->permissions->pluck('name')->all(), $role->unit_scope)
            && ($ids === null || ! $role->users()->where(fn ($q) => $q->whereNull('users.unit_id')->orWhereNotIn('users.unit_id', $ids))->exists());
    }

    public function canAccessUnit(Unit $unit): bool
    {
        $ids = $this->accessibleUnitIds();

        return $ids === null || in_array($unit->id, $ids, true);
    }
}
