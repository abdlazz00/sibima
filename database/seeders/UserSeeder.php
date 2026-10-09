<?php

namespace Database\Seeders;

use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $kecamatan = Unit::where('type', 'kecamatan')->firstOrFail();
        $kelurahan = Unit::where('type', 'kelurahan')->firstOrFail();

        $accounts = [
            ['name' => 'Super Admin Demo', 'email' => 'superadmin@simaset.test', 'unit_id' => null, 'role' => 'super-admin'],
            ['name' => 'Kasubag Demo', 'email' => 'kasubag@simaset.test', 'unit_id' => null, 'role' => 'kasubag'],
            ['name' => 'Camat Demo', 'email' => 'camat@simaset.test', 'unit_id' => $kecamatan->id, 'role' => 'camat'],
            ['name' => 'Admin Kecamatan Demo', 'email' => 'admin.kecamatan@simaset.test', 'unit_id' => $kecamatan->id, 'role' => 'admin_kecamatan'],
            ['name' => 'Admin Kelurahan Demo', 'email' => 'admin.kelurahan@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'admin_kelurahan'],
            ['name' => 'Lurah Demo', 'email' => 'lurah@simaset.test', 'unit_id' => $kelurahan->id, 'role' => 'lurah'],
        ];

        foreach ($accounts as $account) {
            $user = User::firstOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'unit_id' => $account['unit_id'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                ],
            );

            if (! $user->hasRole($account['role'])) {
                $user->assignRole($account['role']);
            }
        }
    }
}
