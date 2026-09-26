<?php

namespace Database\Factories;

use App\Enums\StatusKepegawaian;
use App\Models\Pegawai;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Pegawai> */
class PegawaiFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nama' => fake()->name(),
            'nip' => fake()->unique()->numerify('################'),
            'pangkat_golongan' => 'Penata Muda / III.a',
            'jabatan' => 'Staff',
            'status_kepegawaian' => StatusKepegawaian::Pns,
            'unit_id' => fn () => Unit::create(['name' => 'Kecamatan '.fake()->unique()->word(), 'type' => 'kecamatan'])->id,
            'foto_profile' => null,
            'user_id' => null,
        ];
    }
}
