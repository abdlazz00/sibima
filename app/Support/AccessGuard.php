<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

/** Menjaga agar selalu ada pengguna aktif yang dapat mengelola role dan akses pengguna, apa pun nama rolenya. */
final class AccessGuard
{
    public const REQUIRED = ['pengaturan.role', 'user.manage-access'];

    public const MESSAGE = 'Perubahan ini akan membuat tidak ada lagi pengguna aktif yang dapat mengelola role dan akses pengguna.';

    public static function isHolder(User $user): bool
    {
        return collect(self::REQUIRED)->every(fn (string $permission) => $user->can($permission));
    }

    /**
     * Pengguna aktif selain $exceptIds yang memegang semua izin pengelola.
     *
     * @param  list<int>  $exceptIds
     * @return Collection<int, User>
     */
    public static function others(array $exceptIds): Collection
    {
        // ponytail: memeriksa pengguna aktif satu per satu; cukup untuk ratusan akun, ganti query bila membengkak.
        return User::where('is_active', true)->whereNotIn('id', $exceptIds)->get()
            ->filter(fn (User $user) => self::isHolder($user));
    }

    /**
     * Apakah masih ada pemegang bila izin $role diganti menjadi $permissions.
     *
     * @param  list<string>  $permissions
     */
    public static function survivesRoleEdit(Role $role, array $permissions): bool
    {
        return User::where('is_active', true)->with(['roles.permissions', 'permissions'])->get()
            ->contains(function (User $user) use ($role, $permissions) {
                $granted = $user->permissions->pluck('name');

                foreach ($user->roles as $assigned) {
                    $granted = $granted->merge($assigned->id === $role->id ? $permissions : $assigned->permissions->pluck('name'));
                }

                return array_diff(self::REQUIRED, $granted->all()) === [];
            });
    }
}
