<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('pengaturan.role') ?? false;
    }

    public function rules(): array
    {
        $role = $this->route('role');
        $nameRule = $role->is_system
            ? 'nullable|string'
            : 'required|string|max:50|regex:/^[a-z0-9_]+$/|unique:roles,name,'.$role->id;

        return [
            'name' => $nameRule,
            'display_name' => 'required|string|max:100',
            'unit_scope' => 'required|in:all,binaan,own',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ];
    }

    /** Role kasubag tidak boleh dilucuti sampai tak ada lagi yang bisa mengelola akses. */
    public function after(): array
    {
        return [function (Validator $validator) {
            $role = $this->route('role');

            if ($role->name !== 'kasubag' || $validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->input('unit_scope') !== 'all') {
                $validator->errors()->add('unit_scope', 'Role Kasubag harus tetap bercakupan semua unit.');
            }

            if ($this->has('permissions') && array_diff(['pengaturan.role', 'user.manage-access'], $this->input('permissions', [])) !== []) {
                $validator->errors()->add('permissions', 'Role Kasubag harus tetap memiliki izin Pengaturan Role dan Kelola Akses Pengguna.');
            }
        }];
    }
}
