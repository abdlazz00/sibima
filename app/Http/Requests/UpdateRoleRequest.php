<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
}
