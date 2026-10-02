<?php

namespace App\Enums;

enum ApprovalActionType: string
{
    case Approve = 'approve';
    case Reject = 'reject';
    case Cancel = 'cancel';
    case Reassign = 'reassign';

    public function label(): string
    {
        return match ($this) {
            self::Approve => 'Menyetujui',
            self::Reject => 'Menolak',
            self::Cancel => 'Membatalkan',
            self::Reassign => 'Mengalihkan',
        };
    }
}
