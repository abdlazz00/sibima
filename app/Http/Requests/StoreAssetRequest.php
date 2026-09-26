<?php

namespace App\Http\Requests;

use App\Enums\Kondisi;
use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetRequest extends FormRequest
{
    public const MAX_PHOTOS = 10;

    public function authorize(): bool
    {
        return $this->user()->can('create', Asset::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...$this->descriptiveRules(),
            'kondisi' => ['required', Rule::enum(Kondisi::class)],
            ...$this->photoRules(),
        ];
    }

    /** @return array<string, mixed> */
    protected function descriptiveRules(): array
    {
        $asset = $this->route('asset');

        return [
            'kode_barang' => ['required', 'string', 'max:50', 'regex:/^\d+(\.\d+)+$/'],
            'nama_aset' => ['required', 'string', 'max:255'],
            'category_id' => ['required', 'integer', Rule::exists('asset_categories', 'id')->whereNotNull('parent_id')],
            'merk_type' => ['nullable', 'string', 'max:100'],
            'tanggal_perolehan' => ['required', 'date', 'before_or_equal:today'],
            'sumber_perolehan' => ['nullable', 'string', 'max:100'],
            'nilai_perolehan' => ['required', 'numeric', 'min:0', 'max:9999999999999'],
            'nilai_buku' => ['required', 'numeric', 'min:0', 'lte:nilai_perolehan'],
            'no_dokumen' => ['nullable', 'string', 'max:100', Rule::unique('assets', 'no_dokumen')->ignore($asset?->id)],
            'keterangan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, mixed> */
    protected function photoRules(): array
    {
        return [
            'photos' => ['nullable', 'array', 'max:'.self::MAX_PHOTOS],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kode_barang.regex' => 'Format kode barang harus angka dipisah titik, mis. 1.3.2.05.02.04.004.',
            'category_id.exists' => 'Pilih subkategori, bukan kategori utama.',
            'nilai_buku.lte' => 'Nilai buku tidak boleh melebihi nilai perolehan.',
            'tanggal_perolehan.before_or_equal' => 'Tanggal perolehan tidak boleh di masa depan.',
            'no_dokumen.unique' => 'No. dokumen ini sudah dipakai aset lain.',
            'photos.max' => 'Maksimal '.self::MAX_PHOTOS.' foto.',
            'photos.*.image' => 'File harus berupa gambar.',
            'photos.*.mimes' => 'Foto harus JPG, PNG, atau WEBP.',
            'photos.*.max' => 'Ukuran foto maksimal 5 MB.',
        ];
    }
}
