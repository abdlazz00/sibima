<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreatePegawaiUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('createUser', $this->route('pegawai'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah', 'pegawai'])],
        ];
    }
}
