<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The only place that applies unit scope and filters to the three reports.
 * Used by the page (row count) and by the exporter (rows), so both always agree.
 */
class ReportQuery
{
    public const KINDS = ['aset', 'mutasi', 'rusak-hilang'];

    public function __construct(private readonly User $user) {}

    /** @param  array<string, mixed>  $f */
    public function build(string $kind, array $f): Builder
    {
        return match ($kind) {
            'aset' => $this->aset($f),
            'mutasi' => $this->mutasi($f),
            'rusak-hilang' => $this->rusakHilang($f),
        };
    }

    /** @param  array<string, mixed>  $f */
    private function aset(array $f): Builder
    {
        return Asset::query()
            ->visibleTo($this->user)
            ->with(['category.parent', 'unit', 'currentHolder'])
            ->when($f['unit_id'] ?? null, fn (Builder $q, $id) => $q->where('unit_id', $id))
            ->when($f['category_id'] ?? null, fn (Builder $q, $id) => $q->whereIn('category_id', AssetCategory::query()
                ->where('id', $id)
                ->orWhere('parent_id', $id)
                ->pluck('id')))
            ->when($f['kondisi'] ?? null, fn (Builder $q, $kondisi) => $q->where('kondisi', $kondisi))
            ->orderBy('unit_id')
            ->orderBy('kode_barang')
            ->orderBy('nomor_register');
    }

    /** @param  array<string, mixed>  $f */
    private function mutasi(array $f): Builder
    {
        $ids = $this->user->accessibleUnitIds();

        return AssetMutation::query()
            ->with([
                'originUnit', 'destinationUnit', 'creator',
                'items.asset.category.parent', 'items.targetHolder',
                'approvalRequest.steps', 'approvalRequest.actions.user',
            ])
            ->when($ids !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereIn('asset_mutations.origin_unit_id', $ids)
                ->orWhereIn('asset_mutations.destination_unit_id', $ids)))
            ->when($f['asal_id'] ?? null, fn (Builder $q, $id) => $q->where('asset_mutations.origin_unit_id', $id))
            ->when($f['tujuan_id'] ?? null, fn (Builder $q, $id) => $q->where('asset_mutations.destination_unit_id', $id))
            ->when($f['jenis_mutasi'] ?? null, fn (Builder $q, $jenis) => $q->where('asset_mutations.jenis_mutasi', $jenis))
            ->when($f['status'] ?? null, fn (Builder $q, $status) => $q->where('asset_mutations.status', $status))
            ->when($f['dari'] ?? null, fn (Builder $q, $date) => $q->whereDate('asset_mutations.tanggal_mutasi', '>=', $date))
            ->when($f['sampai'] ?? null, fn (Builder $q, $date) => $q->whereDate('asset_mutations.tanggal_mutasi', '<=', $date))
            ->orderByDesc('asset_mutations.tanggal_mutasi')
            ->orderByDesc('asset_mutations.id');
    }

    /** @param  array<string, mixed>  $f */
    private function rusakHilang(array $f): Builder
    {
        $ids = $this->user->accessibleUnitIds();

        return AssetReport::query()
            ->with(['asset', 'unit', 'pegawai', 'creator'])
            ->when($ids !== null, fn (Builder $q) => $q->whereIn('unit_id', $ids))
            ->when($f['unit_id'] ?? null, fn (Builder $q, $id) => $q->where('unit_id', $id))
            ->when($f['jenis'] ?? null, fn (Builder $q, $jenis) => $q->where('jenis', $jenis))
            ->when($f['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
            ->when($f['dari'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_kejadian', '>=', $date))
            ->when($f['sampai'] ?? null, fn (Builder $q, $date) => $q->whereDate('tanggal_kejadian', '<=', $date))
            ->orderByDesc('tanggal_kejadian')
            ->orderByDesc('id');
    }
}
