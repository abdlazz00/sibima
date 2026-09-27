<?php

namespace App\Http\Requests;

use App\Enums\Kondisi;
use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBeritaAcaraRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', BeritaAcaraPenerimaan::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'no_berita_acara' => ['required', 'string', 'max:100', Rule::unique('berita_acara_penerimaans', 'no_berita_acara')],
            'tanggal_penerimaan' => ['required', 'date'],
            'sumber_perolehan' => ['nullable', 'string', 'max:255'],
            'no_kontrak_spk' => ['required', 'string', 'max:100'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'catatan' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['draft', 'submitted'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.nama_aset' => ['required', 'string', 'max:255'],
            'items.*.merk_type' => ['nullable', 'string', 'max:255'],
            'items.*.category_id' => [
                'required', 'integer',
                Rule::exists('asset_categories', 'id')->whereNotNull('parent_id'),
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Fail fast at submit time — Task 5's PenerimaanAsetEffect re-checks this
                    // again at final approval as a race-condition guard (the code could be
                    // cleared between submit and approve).
                    if ($this->input('status') !== 'submitted') {
                        return;
                    }

                    $category = AssetCategory::find($value);

                    if ($category && blank($category->code)) {
                        $fail("Kategori \"{$category->name}\" belum punya kode BMD. Isi dulu lewat halaman Kategori Aset.");
                    }
                },
            ],
            'items.*.jumlah_unit' => ['required', 'integer', 'min:1'],
            'items.*.nilai_per_unit' => ['required', 'numeric', 'min:0'],
            'items.*.kondisi_awal' => ['required', Rule::in(array_column(Kondisi::cases(), 'value'))],
            'dokumen' => ['nullable', 'array'],
            'dokumen.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'no_berita_acara.unique' => 'Nomor Berita Acara ini sudah dipakai.',
            'items.required' => 'Tambahkan minimal satu barang yang diterima.',
        ];
    }
}
