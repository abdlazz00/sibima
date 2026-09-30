<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetRequestStatus;
use App\Models\AssetRequest;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class AssetRequestEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetRequest) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetRequest.');
        }

        if ($approvable->status !== AssetRequestStatus::Pending) {
            throw new InvalidArgumentException('Permohonan ini sudah tidak menunggu persetujuan.');
        }

        $approvable->update(['status' => AssetRequestStatus::Approved]);
    }
}
