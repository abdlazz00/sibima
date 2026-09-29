<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CancelApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only the submitter may cancel; the controller checks ApprovalWorkflowService::canCancel().
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['note' => ['required', 'string', 'max:1000']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['note.required' => 'Alasan pembatalan wajib diisi.'];
    }
}
