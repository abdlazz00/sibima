<?php

namespace App\Http\Requests;

use App\Enums\AssetReportType;
use App\Models\Asset;
use App\Models\AssetReport;
use App\Services\AssetReportService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [AssetReport::class, Asset::find($this->input('asset_id'))]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'jenis' => ['required', Rule::enum(AssetReportType::class)],
            'kondisi_baru' => ['nullable', Rule::in(['rusak_ringan', 'rusak_berat']), 'required_if:jenis,rusak'],
            'tanggal_kejadian' => ['required', 'date', 'before_or_equal:today'],
            'kronologi' => ['required', 'string', 'max:5000'],
            'photos' => ['nullable', 'array', 'max:'.AssetReportService::MAX_PHOTOS],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kronologi.required' => 'Kronologi wajib diisi.',
            'kondisi_baru.required_if' => 'Pilih kondisi baru untuk laporan rusak.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh di masa depan.',
            'photos.max' => 'Maksimal '.AssetReportService::MAX_PHOTOS.' foto per laporan.',
            'photos.*.image' => 'File harus berupa gambar.',
            'photos.*.mimes' => 'Foto harus JPG, PNG, atau WEBP.',
            'photos.*.max' => 'Ukuran foto maksimal 5 MB.',
        ];
    }
}
