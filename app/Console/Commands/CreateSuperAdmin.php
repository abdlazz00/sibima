<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateSuperAdmin extends Command
{
    protected $signature = 'sibima:create-super-admin {email} {name=Super Admin} {--password=}';

    protected $description = 'Buat akun Super Admin pertama untuk SIBIMA';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));
        $name = trim((string) $this->argument('name')) ?: 'Super Admin';
        $role = Role::where('name', 'super-admin')->first();

        if ($role === null) {
            $this->error('Role super-admin belum ada. Jalankan: php artisan db:seed --force');

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error("Email {$email} sudah terdaftar.");

            return self::FAILURE;
        }

        $explicitPassword = $this->option('password');
        $plainPassword = is_string($explicitPassword) && $explicitPassword !== ''
            ? $explicitPassword
            : Str::password(16);

        $user = DB::transaction(function () use ($name, $email, $plainPassword, $role): User {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => $plainPassword,
                'unit_id' => null,
                'is_active' => true,
            ]);

            $user->markEmailAsVerified();
            $user->assignRole($role);

            return $user;
        });

        $this->info("Super Admin berhasil dibuat. ({$user->email})");

        if (! is_string($explicitPassword) || $explicitPassword === '') {
            $this->line("Password Sementara: {$plainPassword}");
            $this->comment('Silakan login dan segera ganti password melalui menu Profil.');
        }

        return self::SUCCESS;
    }
}
