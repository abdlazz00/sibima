<?php

namespace App\Models;

use App\Contracts\Approvable;
use App\Contracts\HandlesApprovalOutcome;
use App\Enums\AssetRequestStatus;
use App\Enums\AssetRequestType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetRequest extends Model implements Approvable, HandlesApprovalOutcome
{
    use HasFactory;

    protected $fillable = [
        'nomor_permohonan', 'jenis', 'pegawai_id', 'unit_id', 'category_id', 'jumlah', 'keterangan',
        'status', 'created_by', 'mutation_id', 'fulfilled_by', 'fulfilled_at', 'catatan_penutupan',
    ];

    protected function casts(): array
    {
        return [
            'jenis' => AssetRequestType::class,
            'status' => AssetRequestStatus::class,
            'jumlah' => 'integer',
            'pegawai_id' => 'integer',
            'unit_id' => 'integer',
            'category_id' => 'integer',
            'created_by' => 'integer',
            'mutation_id' => 'integer',
            'fulfilled_at' => 'datetime',
        ];
    }

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function fulfiller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fulfilled_by');
    }

    public function mutation(): BelongsTo
    {
        return $this->belongsTo(AssetMutation::class, 'mutation_id');
    }

    public function assets(): BelongsToMany
    {
        return $this->belongsToMany(Asset::class, 'asset_request_assets');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function approvalTitle(): string
    {
        return "Permohonan Aset #{$this->nomor_permohonan}";
    }

    public function approvalShowUrl(): string
    {
        return route('asset-requests.show', $this);
    }

    public function onApprovalRejected(): void
    {
        $this->update(['status' => AssetRequestStatus::Rejected]);
    }

    public function onApprovalCancelled(): void
    {
        $this->update(['status' => AssetRequestStatus::Cancelled]);
    }
}
