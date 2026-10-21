<?php

namespace App\Http\Requests;

use App\Models\Asset;
use App\Services\AssetLabelService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PrintAssetLabelsRequest extends FormRequest
{
    public const MAX_LABELS = 99;

    public function authorize(): bool
    {
        return $this->user()?->can('aset.print-label') ?? false;
    }

    protected function prepareForValidation(): void
    {
        $ids = $this->input('ids');
        if (is_string($ids)) {
            $parsed = array_values(array_filter(explode(',', $ids), fn ($v) => trim($v) !== ''));
            $this->merge(['ids' => $parsed]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_LABELS],
            'ids.*' => ['integer', 'distinct'],
            'size' => ['required', Rule::in(array_keys(AssetLabelService::SIZES))],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $ids = (array) $this->input('ids');
            if (! empty($ids) && count($ids) <= self::MAX_LABELS && ! $validator->errors()->has('ids.*')) {
                $uniqueIds = array_unique(array_filter($ids, 'is_numeric'));
                if (count($uniqueIds) > 0) {
                    $foundCount = Asset::whereIn('id', $uniqueIds)->count();
                    if ($foundCount !== count($uniqueIds)) {
                        $validator->errors()->add('ids', 'Satu atau lebih aset tidak ditemukan.');
                    }
                }
            }
        });
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
