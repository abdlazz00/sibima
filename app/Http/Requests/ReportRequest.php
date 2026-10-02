<?php

namespace App\Http\Requests;

use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReportRequest extends FormRequest
{
    public const PAGE_KINDS = ['rusak-hilang'];

    public const SORTABLE = ['kode_barang', 'nomor_register', 'nama_aset', 'tanggal_perolehan', 'kondisi', 'nilai_perolehan', 'nilai_buku'];

    private const FILTER_KEYS = ['unit_id', 'category_id', 'kondisi', 'dari', 'sampai', 'status', 'jenis'];

    public function authorize(): bool
    {
        return $this->user()->getRoleNames()->isNotEmpty();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'laporan' => ['nullable', Rule::in(self::PAGE_KINDS)],
            'unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'kondisi' => ['nullable', Rule::enum(Kondisi::class)],
            'dari' => ['nullable', 'date'],
            'sampai' => ['nullable', 'date', 'after_or_equal:dari'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'jenis' => ['nullable', Rule::enum(AssetReportType::class)],
            'urut' => ['nullable', Rule::in(self::SORTABLE)],
            'arah' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator) {
            $unitId = $this->input('unit_id');

            if ($unitId === null || $unitId === '' || $validator->errors()->has('unit_id')) {
                return;
            }

            $unit = Unit::find($unitId);

            if ($unit === null || ! $this->user()->canAccessUnit($unit)) {
                $validator->errors()->add('unit_id', 'Unit di luar cakupan Anda.');
            }
        }];
    }

    /** @return array<string, mixed> */
    public function filters(): array
    {
        return array_filter(
            $this->safe()->only(self::FILTER_KEYS),
            fn ($value) => $value !== null && $value !== '',
        );
    }

    /** @return array{urut: string, arah: string} */
    public function sorting(): array
    {
        return [
            'urut' => $this->validated('urut') ?: 'kode_barang',
            'arah' => $this->validated('arah') ?: 'asc',
        ];
    }
}
