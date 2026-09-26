<?php

namespace App\Http\Requests;

use App\Models\Pegawai;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PegawaiRequest extends FormRequest
{
    public function authorize(): bool
    {
        $pegawai = $this->route('pegawai');

        return $pegawai instanceof Pegawai
            ? $this->user()->can('update', $pegawai)
            : $this->user()->can('create', Pegawai::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $pegawai = $this->route('pegawai');

        return [
            'nama' => ['required', 'string', 'max:150'],
            'nip' => ['nullable', 'string', 'max:30', Rule::unique('pegawais', 'nip')->ignore($pegawai?->id)],
            'pangkat_golongan' => ['nullable', 'string', 'max:100'],
            'jabatan' => ['required', 'string', 'max:150'],
            'status_kepegawaian' => ['required', Rule::in(['pns', 'pppk'])],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')],
            'foto_profile' => ['nullable', 'image', 'max:2048'],
            'no_hp' => ['nullable', 'string', 'max:50'],
            'email_dinas' => ['nullable', 'string', 'max:150'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama pegawai wajib diisi.',
            'nip.unique' => 'NIP ini sudah dipakai pegawai lain.',
            'jabatan.required' => 'Jabatan wajib diisi.',
            'unit_id.required' => 'Unit wajib dipilih.',
            'foto_profile.image' => 'Foto harus berupa gambar.',
        ];
    }
}
