<?php

namespace App\Models;

use App\Contracts\Approvable;
use App\Contracts\HandlesApprovalOutcome;
use App\Enums\AssetReportStatus;
use App\Enums\AssetReportType;
use App\Enums\Kondisi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetReport extends Model implements Approvable, HandlesApprovalOutcome
{
    use HasFactory;

    protected $fillable = [
        'nomor_laporan', 'asset_id', 'unit_id', 'pegawai_id', 'jenis', 'kondisi_baru',
        'tanggal_kejadian', 'kronologi', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'jenis' => AssetReportType::class,
            'kondisi_baru' => Kondisi::class,
            'status' => AssetReportStatus::class,
            'tanggal_kejadian' => 'date:Y-m-d',
            'asset_id' => 'integer',
            'unit_id' => 'integer',
            'pegawai_id' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(AssetPhoto::class, 'photoable');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function approvalTitle(): string
    {
        return "Laporan {$this->jenis->label()} #{$this->nomor_laporan}";
    }

    public function approvalShowUrl(): string
    {
        return route('asset-reports.show', $this);
    }

    public function onApprovalRejected(): void
    {
        $this->update(['status' => AssetReportStatus::Rejected]);
    }

    public function onApprovalCancelled(): void
    {
        $this->update(['status' => AssetReportStatus::Cancelled]);
    }
}
