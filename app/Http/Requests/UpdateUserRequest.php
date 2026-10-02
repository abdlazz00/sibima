<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('user.manage-access');
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
}
