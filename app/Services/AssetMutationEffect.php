<?php

namespace App\Services;

use App\Contracts\WorkflowEffect;
use App\Enums\AssetStatus;
use App\Enums\MutationStatus;
use App\Models\Asset;
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
            $approvable->load(['items', 'originUnit', 'destinationUnit']);

            $assets = Asset::whereIn('id', $approvable->items->pluck('asset_id'))->lockForUpdate()->get()->keyBy('id');

            foreach ($approvable->items as $item) {
                $asset = $assets->get($item->asset_id);

                if ($asset === null || $asset->unit_id !== $approvable->origin_unit_id || $asset->status !== AssetStatus::DalamProses) {
                    $name = $asset?->nama_aset ?? "#{$item->asset_id}";
                    throw new InvalidArgumentException("Aset \"{$name}\" sudah tidak berada di unit asal atau tidak lagi dalam proses mutasi ini.");
                }
            }

            foreach ($approvable->items as $item) {
                $asset = $assets->get($item->asset_id);

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
