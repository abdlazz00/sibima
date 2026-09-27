<?php

namespace App\Http\Requests;

use App\Models\Asset;
use App\Services\AssetLabelService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PrintAssetLabelsRequest extends FormRequest
{
    public const MAX_LABELS = 99;

    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Asset::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_LABELS],
            'ids.*' => ['integer', 'distinct', Rule::exists('assets', 'id')],
            'size' => ['required', Rule::in(array_keys(AssetLabelService::SIZES))],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'ids.required' => 'Pilih minimal satu aset untuk dicetak labelnya.',
            'ids.max' => 'Maksimal '.self::MAX_LABELS.' label sekali cetak.',
            'size.required' => 'Pilih ukuran label.',
            'size.in' => 'Ukuran label tidak valid.',
        ];
    }
}
