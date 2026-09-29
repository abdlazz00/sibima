<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Models\AssetHistory;
use App\Models\AssetMutation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetMutationEffect implements WorkflowEffect
{
    public function apply(Model $approvable): void
    {
        if (! $approvable instanceof AssetMutation) {
            throw new InvalidArgumentException('Effect ini hanya berlaku untuk model AssetMutation.');
        }

        DB::transaction(function () use ($approvable) {
            $approvable->load(['items.asset', 'originUnit', 'destinationUnit']);

            foreach ($approvable->items as $item) {
                $asset = $item->asset;

                $asset->update([
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'status' => AssetStatus::Aktif,
                ]);

                AssetHistory::create([
                    'asset_id' => $asset->id,
                    'event' => 'mutasi',
                    'unit_id' => $approvable->destination_unit_id,
                    'current_holder_id' => $item->target_holder_id,
                    'kondisi' => $asset->kondisi,
                    'user_id' => auth()->id() ?? $approvable->created_by,
                    'keterangan' => "Mutasi {$approvable->jenis_mutasi->label()} ({$approvable->originUnit->name} -> {$approvable->destinationUnit->name}) No. {$approvable->nomor_mutasi}. ".($item->catatan ?? ''),
                ]);
            }

            $approvable->update(['status' => MutationStatus::Approved]);
        });
    }
}
