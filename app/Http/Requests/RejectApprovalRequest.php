<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RejectApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Eligibility depends on the specific request's current step, so the
        // controller checks ApprovalWorkflowService::canAct() explicitly.
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
        return ['note.required' => 'Alasan penolakan wajib diisi.'];
    }
}
