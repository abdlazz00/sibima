<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Role;

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
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $role = Role::where('name', $this->input('role'))->first();
            if ($role && ! $this->user()->canManageRole($role)) {
                $validator->errors()->add('role', 'Anda tidak memiliki wewenang untuk memberikan role ini.');
            }
        }];
    }
}
