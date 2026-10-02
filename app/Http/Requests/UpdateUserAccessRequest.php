<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('pegawai.create-user')
            || $this->user()?->can('pengaturan.user')
            || ($this->user()?->hasRole('kasubag') ?? false);
    }

    public function rules(): array
    {
        return [
            'role' => 'required|string|exists:roles,name',
            'direct_permissions' => 'nullable|array',
            'direct_permissions.*' => 'string|exists:permissions,name',
            'unit_scope_override' => 'nullable|in:all,binaan,own',
        ];
    }
}
