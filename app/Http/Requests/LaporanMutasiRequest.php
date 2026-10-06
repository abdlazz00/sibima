<?php

namespace App\Http\Requests;

use App\Enums\MutationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LaporanMutasiRequest extends FormRequest
{
    public const SORTABLE = ['nomor_mutasi', 'tanggal_mutasi', 'jumlah_aset', 'nilai', 'status'];

    private const FILTER_KEYS = ['dari', 'sampai', 'jenis_mutasi', 'status', 'asal_id', 'tujuan_id'];

    public function authorize(): bool
    {
        return $this->user()?->can('laporan.mutasi') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'dari' => ['nullable', 'date'],
            'sampai' => ['nullable', 'date', 'after_or_equal:dari'],
            'jenis_mutasi' => ['nullable', Rule::enum(MutationType::class)],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'asal_id' => ['nullable', 'integer', 'exists:units,id'],
            'tujuan_id' => ['nullable', 'integer', 'exists:units,id'],
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
            'urut' => $this->validated('urut') ?: 'tanggal_mutasi',
            'arah' => $this->validated('arah') ?: 'desc',
        ];
    }
}
