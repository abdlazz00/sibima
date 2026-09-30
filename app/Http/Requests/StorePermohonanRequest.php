<?php

namespace App\Http\Requests;

use App\Enums\AssetRequestType;
use App\Models\AssetRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePermohonanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', AssetRequest::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'jenis' => ['required', Rule::enum(AssetRequestType::class)],
            'pegawai_id' => ['nullable', 'integer', 'required_if:jenis,pegawai'],
            'jumlah' => ['nullable', 'integer', 'min:1', 'max:1000', 'required_if:jenis,unit'],
            'category_id' => ['required', 'integer', Rule::exists('asset_categories', 'id')->whereNotNull('parent_id')],
            'keterangan' => ['required', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'keterangan.required' => 'Keterangan wajib diisi.',
            'pegawai_id.required_if' => 'Pilih pegawai yang mengajukan permohonan.',
            'jumlah.required_if' => 'Jumlah barang wajib diisi.',
            'category_id.exists' => 'Pilih subkategori aset yang valid.',
        ];
    }
}
