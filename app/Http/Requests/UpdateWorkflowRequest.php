<?php

namespace App\Http\Requests;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('workflow'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'steps' => ['required', 'array', 'min:1'],
            'steps.*.label' => ['required', 'string', 'max:100'],
            'steps.*.approver_type' => ['required', Rule::enum(ApproverType::class)],
            'steps.*.approver_role' => ['nullable', 'string'],
            'steps.*.approver_user_id' => ['nullable', 'integer'],
            'steps.*.unit_scope' => ['nullable', Rule::enum(UnitScope::class)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'steps.required' => 'Alur harus punya minimal satu langkah.',
            'steps.min' => 'Alur harus punya minimal satu langkah.',
            'steps.*.label.required' => 'Nama langkah wajib diisi.',
        ];
    }

    /** @return array<int, \Closure> */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $capability = config('workflow.capabilities.'.$this->route('workflow')->code, 'none');

            foreach ($this->input('steps', []) as $i => $step) {
                $type = ApproverType::from($step['approver_type']);

                match ($type) {
                    ApproverType::Role => $this->checkRoleStep($validator, $i, $step, $capability),
                    ApproverType::User => $this->checkUserStep($validator, $i, $step),
                    ApproverType::AtasanUnit => $capability === 'subject'
                        ? null
                        : $validator->errors()->add("steps.$i.approver_type", 'Tipe "Atasan unit" hanya untuk alur yang punya unit subjek.'),
                };
            }
        }];
    }

    private function checkRoleStep(Validator $validator, int $i, array $step, string $capability): void
    {
        $role = $step['approver_role'] ?? null;

        if (! is_string($role) || ! Role::where('name', $role)->exists()) {
            $validator->errors()->add("steps.$i.approver_role", 'Pilih role approver yang valid.');

            return;
        }

        if (! User::role($role)->exists()) {
            $validator->errors()->add("steps.$i.approver_role", "Belum ada user dengan role {$role}, pengajuan bisa macet.");
        }

        $scope = $step['unit_scope'] ?? 'none';
        $allowed = match ($capability) {
            'subject' => ['none', 'subject'],
            'origin_destination' => ['none', 'origin', 'destination'],
            default => ['none'],
        };

        if (! in_array($scope, $allowed, true)) {
            $validator->errors()->add("steps.$i.unit_scope", 'Cakupan unit ini tidak tersedia untuk alur tersebut.');
        }
    }

    private function checkUserStep(Validator $validator, int $i, array $step): void
    {
        $id = $step['approver_user_id'] ?? null;

        if ($id === null || ! User::whereKey($id)->has('roles')->exists()) {
            $validator->errors()->add("steps.$i.approver_user_id", 'Pilih user yang memiliki akun dengan role yang valid.');
        }
    }
}
