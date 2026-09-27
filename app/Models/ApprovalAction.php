<?php

namespace App\Models;

use App\Enums\ApprovalActionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalAction extends Model
{
    protected $fillable = ['approval_request_id', 'step_order', 'user_id', 'action', 'note'];

    protected function casts(): array
    {
        return ['action' => ApprovalActionType::class, 'step_order' => 'integer'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
