<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('pengaturan.role') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:50|regex:/^[a-z0-9_]+$/|unique:roles,name',
            'display_name' => 'required|string|max:100',
            'unit_scope' => 'required|in:all,binaan,own',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ];
    }

    /** Role baru tidak boleh melebihi hak dan cakupan pembuatnya. */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $actor = $this->user();

            if (! $actor->covers($this->input('permissions', []))) {
                $validator->errors()->add('permissions', 'Anda tidak dapat memberikan izin yang tidak Anda miliki.');
            }

            if (! $actor->covers([], $this->input('unit_scope'))) {
                $validator->errors()->add('unit_scope', 'Cakupan unit melebihi cakupan Anda.');
            }
        }];
    }
}
