<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        collect(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai'])
            ->each(fn (string $role) => Role::findOrCreate($role));
    }
}
