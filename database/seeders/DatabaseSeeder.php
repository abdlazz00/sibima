<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Jalankan seeder aplikasi.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            UnitSeeder::class,
            AssetCategorySeeder::class,
            WorkflowDefinitionSeeder::class,
        ]);

        if (app()->environment(['local', 'testing'])) {
            $this->call([
                PegawaiSeeder::class,
                UserSeeder::class,
            ]);
        }

        if (app()->environment('local')) {
            $this->call([
                AssetExcelSeeder::class,
            ]);
        }
    }
}
