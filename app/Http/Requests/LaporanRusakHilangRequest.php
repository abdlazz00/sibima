<?php

namespace App\Http\Requests;

use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LaporanRusakHilangRequest extends FormRequest
{
    public const SORTABLE = [
        'nomor_laporan',
        'tanggal_kejadian',
        'nama_aset',
        'kondisi_baru',
        'nilai_perolehan',
        'nilai_buku',
        'status',
    ];

    private const FILTER_KEYS = ['dari', 'sampai', 'kondisi', 'status', 'unit_id', 'category_id'];

    public function authorize(): bool
    {
        return $this->user()?->getRoleNames()->isNotEmpty() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'dari' => ['nullable', 'date'],
            'sampai' => ['nullable', 'date', 'after_or_equal:dari'],
            'kondisi' => ['nullable', Rule::enum(Kondisi::class)],
            'status' => ['nullable', Rule::enum(AssetReportStatus::class)],
            'unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'urut' => ['nullable', Rule::in(self::SORTABLE)],
            'arah' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
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
            'urut' => $this->validated('urut') ?: 'tanggal_kejadian',
            'arah' => $this->validated('arah') ?: 'desc',
        ];
    }
}
