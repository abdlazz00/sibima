<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateBeritaAcaraRequest extends StoreBeritaAcaraRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('beritaAcara'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'no_berita_acara' => [
                'required', 'string', 'max:100',
                Rule::unique('berita_acara_penerimaans', 'no_berita_acara')->ignore($this->route('beritaAcara')),
            ],
            'hapus_dokumen' => ['nullable', 'array'],
            'hapus_dokumen.*' => ['integer'],
        ]);
    }
}
