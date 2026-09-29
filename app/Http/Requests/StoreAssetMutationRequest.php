<?php

namespace App\Http\Requests;

use App\Enums\MutationType;
use App\Models\AssetMutation;
use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetMutationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $originUnit = Unit::find($this->input('origin_unit_id'));

        return $this->user()->can('create', [AssetMutation::class, $originUnit]);
    }

    public function rules(): array
    {
        return [
            'nomor_mutasi' => ['required', 'string', 'max:50', 'unique:asset_mutations,nomor_mutasi'],
            'jenis_mutasi' => ['required', Rule::enum(MutationType::class)],
            'origin_unit_id' => ['required', 'integer', 'exists:units,id'],
            'destination_unit_id' => ['required', 'integer', 'exists:units,id'],
            'tanggal_mutasi' => ['required', 'date'],
            'keterangan' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.asset_id' => ['required', 'integer', 'exists:assets,id'],
            'items.*.target_holder_id' => ['nullable', 'integer', 'exists:pegawais,id'],
            'items.*.catatan' => ['nullable', 'string', 'max:255'],
        ];
    }
}
