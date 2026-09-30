<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FulfillPermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('fulfill', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['asset_ids.required' => 'Pilih aset yang akan diserahkan.'];
    }
}
