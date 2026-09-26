<?php

namespace App\Http\Requests;

use Illuminate\Validation\Validator;

class UpdateAssetRequest extends StoreAssetRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('asset'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [...$this->descriptiveRules(), ...$this->photoRules()];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $existing = $this->route('asset')->photos()->count();
                $incoming = count($this->file('photos', []));

                if ($existing + $incoming > self::MAX_PHOTOS) {
                    $validator->errors()->add('photos', 'Maksimal '.self::MAX_PHOTOS." foto per aset (sudah ada {$existing}).");
                }
            },
        ];
    }
}
