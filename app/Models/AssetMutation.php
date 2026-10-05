<?php

namespace App\Models;

use App\Contracts\Approvable;
use App\Contracts\HandlesApprovalOutcome;
use App\Contracts\HasWorkflowUnits;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class AssetMutation extends Model implements Approvable, HandlesApprovalOutcome, HasWorkflowUnits
{
    use HasFactory;

    protected $fillable = [
        'nomor_mutasi',
        'jenis_mutasi',
        'origin_unit_id',
        'destination_unit_id',
        'tanggal_mutasi',
        'keterangan',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'jenis_mutasi' => MutationType::class,
            'status' => MutationStatus::class,
            'tanggal_mutasi' => 'date:Y-m-d',
            'origin_unit_id' => 'integer',
            'destination_unit_id' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function originUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'origin_unit_id');
    }

    public function destinationUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'destination_unit_id');
    }

    /** Unit pengaju bagi langkah "Atasan Unit": unit asal (pada pengembalian, asal = tujuan). */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'origin_unit_id');
    }

    public function getOriginUnit(): Unit
    {
        return $this->originUnit;
    }

    public function getDestinationUnit(): Unit
    {
        return $this->destinationUnit;
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetMutationItem::class);
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
        return "Mutasi Aset #{$this->nomor_mutasi}";
    }

    public function approvalShowUrl(): string
    {
        return route('asset-mutations.show', $this);
    }

    public function onApprovalRejected(): void
    {
        $this->release(MutationStatus::Rejected);
    }

    public function onApprovalCancelled(): void
    {
        $this->release(MutationStatus::Cancelled);
    }

    private function release(MutationStatus $status): void
    {
        $this->update(['status' => $status]);
        Asset::whereIn('id', $this->items()->pluck('asset_id'))->update(['status' => AssetStatus::Aktif]);

        AssetRequest::where('mutation_id', $this->id)->get()->each(function (AssetRequest $request) {
            $request->assets()->detach();
            $request->update(['mutation_id' => null]);
        });
    }
}
