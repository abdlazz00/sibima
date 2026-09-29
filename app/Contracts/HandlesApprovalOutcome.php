<?php

namespace App\Contracts;

interface HandlesApprovalOutcome
{
    public function onApprovalRejected(): void;

    public function onApprovalCancelled(): void;
}
