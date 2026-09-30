<?php

namespace App\Enums;

enum AssetRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Fulfilled = 'fulfilled';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Menunggu Pemenuhan',
            self::Fulfilled => 'Dipenuhi',
            self::Rejected => 'Ditolak',
            self::Cancelled => 'Dibatalkan',
        };
    }
}
