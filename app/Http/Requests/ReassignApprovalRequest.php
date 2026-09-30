<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReassignApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only kasubag may reassign; the controller checks ApprovalWorkflowService::canReassign().
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'note' => ['required', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Pilih user tujuan pengalihan.',
            'note.required' => 'Alasan pengalihan wajib diisi.',
        ];
    }
}
