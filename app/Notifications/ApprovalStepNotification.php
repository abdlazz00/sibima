<?php

namespace App\Notifications;

use App\Models\ApprovalRequest;
use Illuminate\Notifications\Notification;

class ApprovalStepNotification extends Notification
{
    public function __construct(
        private readonly ApprovalRequest $request,
        private readonly string $message,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'approval_request_id' => $this->request->id,
            'workflow_code' => $this->request->definition->code,
            'message' => $this->message,
        ];
    }
}
