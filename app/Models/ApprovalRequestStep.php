<?php

namespace App\Models;

use App\Enums\ApproverType;
use App\Enums\UnitScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalRequestStep extends Model
{
    protected $fillable = [
        'approval_request_id', 'step_order', 'label', 'approver_type',
        'approver_role', 'unit_scope', 'approver_user_id',
    ];

    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'approver_type' => ApproverType::class,
            'unit_scope' => UnitScope::class,
            'approver_user_id' => 'integer',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
