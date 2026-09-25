<?php

namespace App\Http\Requests;

use App\Models\AssetCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssetCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $category = $this->route('assetCategory');

        return $category instanceof AssetCategory
            ? $this->user()->can('update', $category)
            : $this->user()->can('create', AssetCategory::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $category = $this->route('assetCategory');
        $parentId = $this->input('parent_id');

        return [
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('asset_categories', 'name')
                    ->where(fn ($query) => $parentId === null
                        ? $query->whereNull('parent_id')
                        : $query->where('parent_id', $parentId))
                    ->ignore($category?->id),
            ],
            'parent_id' => [
                'nullable', 'integer',
                Rule::exists('asset_categories', 'id')->whereNull('parent_id'),
                Rule::notIn(array_filter([$category?->id])),
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $category = $this->route('assetCategory');

                if ($category instanceof AssetCategory && $this->input('parent_id') !== null && $category->children()->exists()) {
                    $validator->errors()->add('parent_id', 'Kategori yang punya subkategori tidak bisa dipindah menjadi subkategori.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama kategori wajib diisi.',
            'name.unique' => 'Nama ini sudah dipakai di level yang sama.',
            'parent_id.exists' => 'Induk harus kategori utama, bukan subkategori.',
            'parent_id.not_in' => 'Kategori tidak boleh menjadi induk dirinya sendiri.',
        ];
    }
}
