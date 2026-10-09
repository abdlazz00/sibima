<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('user.manage-access') && $this->user()->canManage($this->route('user'));
    }

    public function rules(): array
    {
        $userId = $this->route('user')->id;

        return [
            'email' => "required|email|max:255|unique:users,email,{$userId}",
            'password' => 'nullable|string|min:8|confirmed',
            'is_active' => 'required|boolean',
            'role' => 'required|string|exists:roles,name',
            'direct_permissions' => 'nullable|array',
            'direct_permissions.*' => 'string|exists:permissions,name',
            'unit_scope_override' => 'nullable|in:all,binaan,own',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $actor = $this->user();
            $target = $this->route('user');

            if ($this->filled('password') && ! $actor->can('user.reset-password')) {
                $validator->errors()->add('password', 'Anda tidak berwenang mengganti kata sandi pengguna.');
            }

            // Mengganti email akun lain lalu memakai "lupa password" sama dengan mengganti kata sandinya.
            if ($target->id !== $actor->id && $this->input('email') !== $target->email && ! $actor->can('user.reset-password')) {
                $validator->errors()->add('email', 'Anda tidak berwenang mengganti email pengguna lain.');
            }
        }, function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $actor = $this->user();
            $role = Role::with('permissions')->where('name', $this->input('role'))->first();

            if (! $actor->covers($role->permissions->pluck('name')->all(), $role->unit_scope)) {
                $validator->errors()->add('role', 'Anda tidak dapat memberikan role dengan hak akses atau cakupan melebihi milik Anda.');
            }

            if (! $actor->covers($this->input('direct_permissions', []))) {
                $validator->errors()->add('direct_permissions', 'Anda tidak dapat memberikan izin yang tidak Anda miliki.');
            }

            if ($this->filled('unit_scope_override') && ! $actor->covers([], $this->input('unit_scope_override'))) {
                $validator->errors()->add('unit_scope_override', 'Cakupan unit melebihi cakupan Anda.');
            }
        }];
    }
}
