<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ClosePermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('fulfill', $this->route('assetRequest'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['note' => ['required', 'string', 'max:1000']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['note.required' => 'Alasan penutupan wajib diisi.'];
    }
}
