<?php

namespace App\Services;

use App\Enums\AssetReportStatus;
use App\Enums\AssetRequestStatus;
use App\Enums\BeritaAcaraStatus;
use App\Enums\Kondisi;
use App\Enums\MutationStatus;
use App\Models\AssetMutation;
use App\Models\AssetReport;
use App\Models\AssetRequest;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function __construct(
        private readonly ApprovalWorkflowService $workflow,
        private readonly AssetRequestService $requests,
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user, ?int $unitId = null): array
    {
        $accessible = $user->accessibleUnitIds();
        $scope = Unit::query()
            ->when($accessible !== null, fn ($q) => $q->whereIn('id', $accessible))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name', 'type']);

        $scopeIds = $scope->pluck('id')->map(fn ($id) => (int) $id)->all();
        $multi = count($scopeIds) > 1;
        $selected = $multi && $unitId !== null && in_array($unitId, $scopeIds, true) ? $unitId : null;
        $ids = $selected !== null ? [$selected] : $scopeIds;

        return [
            ...$this->recap($scope, $scopeIds, $ids, $multi),
            'per_kategori' => $this->perKategori($ids),
            'antrean' => $this->antrean($user, $scopeIds),
            'transaksi' => $this->transaksi($scopeIds),
            'units' => $multi ? $scope->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name])->all() : [],
            'selected_unit_id' => $selected,
        ];
    }

    /**
     * @param  list<int>  $scopeIds
     * @param  list<int>  $ids
     * @return array<string, mixed>
     */
    private function recap($scope, array $scopeIds, array $ids, bool $multi): array
    {
        $zero = array_fill_keys(array_map(fn (Kondisi $k) => $k->value, Kondisi::cases()), 0);
        $totals = ['jumlah_aset' => 0, 'nilai_perolehan' => 0.0, 'nilai_buku' => 0.0];
        $perKondisi = $zero;
        $perUnit = [];

        foreach ($scope as $unit) {
            $perUnit[(int) $unit->id] = ['id' => (int) $unit->id, 'name' => $unit->name, 'jumlah' => 0, 'kondisi' => $zero, 'nilai_buku' => 0.0];
        }

        $rows = DB::table('assets')
            ->whereIn('unit_id', $scopeIds)
            ->selectRaw('unit_id, kondisi, COUNT(*) as jumlah, COALESCE(SUM(nilai_perolehan), 0) as nilai_perolehan, COALESCE(SUM(nilai_buku), 0) as nilai_buku')
            ->groupBy('unit_id', 'kondisi')
            ->get();

        foreach ($rows as $row) {
            $unit = (int) $row->unit_id;
            $perUnit[$unit]['jumlah'] += (int) $row->jumlah;
            $perUnit[$unit]['kondisi'][$row->kondisi] += (int) $row->jumlah;
            $perUnit[$unit]['nilai_buku'] += (float) $row->nilai_buku;

            if (in_array($unit, $ids, true)) {
                $totals['jumlah_aset'] += (int) $row->jumlah;
                $totals['nilai_perolehan'] += (float) $row->nilai_perolehan;
                $totals['nilai_buku'] += (float) $row->nilai_buku;
                $perKondisi[$row->kondisi] += (int) $row->jumlah;
            }
        }

        return [
            'totals' => $totals,
            'per_kondisi' => $perKondisi,
            'per_unit' => $multi ? array_values($perUnit) : null,
        ];
    }

    /**
     * @param  list<int>  $ids
     * @return list<array{id: int, nama: string, jumlah: int, nilai_buku: float}>
     */
    private function perKategori(array $ids): array
    {
        return DB::table('assets')
            ->join('asset_categories as c', 'c.id', '=', 'assets.category_id')
            ->leftJoin('asset_categories as p', 'p.id', '=', 'c.parent_id')
            ->whereIn('assets.unit_id', $ids)
            ->selectRaw('COALESCE(p.id, c.id) as kategori_id, COALESCE(p.name, c.name) as kategori, COUNT(*) as jumlah, COALESCE(SUM(assets.nilai_buku), 0) as nilai_buku')
            ->groupByRaw('COALESCE(p.id, c.id), COALESCE(p.name, c.name)')
            ->orderByDesc('jumlah')
            ->orderBy('kategori')
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->kategori_id,
                'nama' => $r->kategori,
                'jumlah' => (int) $r->jumlah,
                'nilai_buku' => (float) $r->nilai_buku,
            ])
            ->all();
    }

    /**
     * @param  list<int>  $scopeIds
     * @return array<string, int>
     */
    private function antrean(User $user, array $scopeIds): array
    {
        return [
            'persetujuan_menunggu' => $this->workflow->pendingFor($user)->count(),
            'permohonan_menunggu_pemenuhan' => AssetRequest::with('unit')
                ->where('status', AssetRequestStatus::Approved)
                ->whereNull('mutation_id')
                ->get()
                ->filter(fn (AssetRequest $r) => $this->requests->canFulfill($user, $r))
                ->count(),
            'laporan_pending' => AssetReport::where('status', AssetReportStatus::Pending)
                ->whereIn('unit_id', $scopeIds)
                ->count(),
            'mutasi_pending' => AssetMutation::where('status', MutationStatus::Pending)
                ->where(fn (Builder $q) => $q->whereIn('origin_unit_id', $scopeIds)->orWhereIn('destination_unit_id', $scopeIds))
                ->count(),
        ];
    }

    /**
     * The five newest mutations and submitted penerimaan in scope, merged.
     *
     * @param  list<int>  $scopeIds
     * @return list<array<string, string>>
     */
    private function transaksi(array $scopeIds): array
    {
        $mutations = AssetMutation::with(['originUnit', 'destinationUnit'])
            ->where(fn (Builder $q) => $q->whereIn('origin_unit_id', $scopeIds)->orWhereIn('destination_unit_id', $scopeIds))
            ->latest()->latest('id')->limit(5)->get()
            ->map(fn (AssetMutation $m) => [
                'at' => $m->created_at,
                'jenis' => 'mutasi',
                'nomor' => $m->nomor_mutasi,
                'ringkasan' => $m->originUnit?->name.' → '.$m->destinationUnit?->name,
                'tanggal' => $m->tanggal_mutasi?->format('Y-m-d'),
                'status' => $this->statusLabel($m->status->value),
                'url' => route('asset-mutations.show', $m),
            ]);

        $penerimaan = BeritaAcaraPenerimaan::with(['unit', 'approvalRequest'])
            ->where('status', BeritaAcaraStatus::Submitted)
            ->whereIn('unit_id', $scopeIds)
            ->whereHas('approvalRequest')
            ->latest()->latest('id')->limit(5)->get()
            ->map(fn (BeritaAcaraPenerimaan $b) => [
                'at' => $b->created_at,
                'jenis' => 'penerimaan',
                'nomor' => $b->no_berita_acara,
                'ringkasan' => $b->unit?->name,
                'tanggal' => $b->tanggal_penerimaan?->format('Y-m-d'),
                'status' => $this->statusLabel($b->approvalRequest->status->value),
                'url' => route('penerimaan-aset.show', $b),
            ]);

        return $mutations->concat($penerimaan)
            ->sortByDesc('at')
            ->take(5)
            ->map(fn (array $row) => collect($row)->except('at')->all())
            ->values()
            ->all();
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'approved' => 'selesai',
            'rejected' => 'ditolak',
            'cancelled' => 'dibatalkan',
            default => 'berjalan',
        };
    }
}
