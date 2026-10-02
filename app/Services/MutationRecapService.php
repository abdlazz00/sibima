<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\ApproverType;
use App\Enums\MutationStatus;
use App\Enums\MutationType;
use App\Models\ApprovalRequestStep;
use App\Models\AssetMutation;
use App\Models\Unit;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MutationRecapService
{
    private const MAX_FILLED_SPAN_MONTHS = 60;

    private const PENDING_LIMIT = 20;

    private const MOVED = 'COUNT(DISTINCT asset_mutations.id) as mutasi, COUNT(mi.id) as aset, COALESCE(SUM(ma.nilai_perolehan), 0) as nilai';

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function for(User $user, array $filters): array
    {
        $query = new ReportQuery($user);
        $base = fn (): QueryBuilder => $query->build('mutasi', $filters)->reorder()->toBase();
        $approved = fn (): QueryBuilder => $base()->where('asset_mutations.status', MutationStatus::Approved->value);
        $moved = fn (): QueryBuilder => $approved()
            ->join('asset_mutation_items as mi', 'mi.asset_mutation_id', '=', 'asset_mutations.id')
            ->join('assets as ma', 'ma.id', '=', 'mi.asset_id');

        $jumlah = $base()->count();
        $totals = $moved()->selectRaw(self::MOVED)->first();
        $durations = $this->durations($approved);

        $pending = fn () => $query->build('mutasi', $filters)->where('asset_mutations.status', MutationStatus::Pending->value);

        return [
            'ringkasan' => [
                'jumlah_mutasi' => $jumlah,
                'disetujui' => $approved()->count(),
                'aset_berpindah' => (int) $totals->aset,
                'nilai_perolehan' => (float) $totals->nilai,
                'rata_lama_proses' => $durations === [] ? null : round(array_sum($durations) / count($durations), 1),
                'terlama_proses' => $durations === [] ? null : max($durations),
            ],
            'status' => $this->komposisi(
                MutationStatus::cases(), 'status',
                $base()->selectRaw('asset_mutations.status as k, COUNT(*) as n')->groupBy('asset_mutations.status')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'jenis' => $this->komposisi(
                MutationType::cases(), 'jenis',
                $base()->selectRaw('asset_mutations.jenis_mutasi as k, COUNT(*) as n')->groupBy('asset_mutations.jenis_mutasi')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'tren' => $this->tren($moved()->selectRaw('asset_mutations.tanggal_mutasi as tanggal, '.self::MOVED)->groupBy('asset_mutations.tanggal_mutasi')->get()),
            'arus' => $this->arus($moved()
                ->selectRaw('asset_mutations.origin_unit_id as asal_id, asset_mutations.destination_unit_id as tujuan_id, '.self::MOVED)
                ->groupBy('asset_mutations.origin_unit_id', 'asset_mutations.destination_unit_id')
                ->get()),
            'masih_berjalan' => $this->masihBerjalan($pending),
            'jumlah_masih_berjalan' => $pending()->count(),
        ];
    }

    /**
     * @param  list<MutationStatus|MutationType>  $cases
     * @param  array<string, int>  $counts
     * @return list<array<string, mixed>>
     */
    private function komposisi(array $cases, string $key, array $counts, int $total): array
    {
        return array_map(function ($case) use ($key, $counts, $total) {
            $n = (int) ($counts[$case->value] ?? 0);

            return [
                $key => $case->value,
                'label' => $case->label(),
                'jumlah' => $n,
                'persen' => $total > 0 ? round($n / $total * 100, 1) : 0.0,
            ];
        }, $cases);
    }

    /** @return list<float> */
    private function durations(callable $approved): array
    {
        return DB::table('approval_requests as r')
            ->join('approval_actions as a', 'a.approval_request_id', '=', 'r.id')
            ->where('r.approvable_type', (new AssetMutation)->getMorphClass())
            ->whereIn('r.approvable_id', $approved()->select('asset_mutations.id'))
            ->where('a.action', ApprovalActionType::Approve->value)
            ->groupBy('r.id', 'r.created_at')
            ->selectRaw('r.created_at as diajukan, MAX(a.created_at) as selesai')
            ->get()
            ->map(fn ($row) => Days::between(Carbon::parse($row->diajukan), Carbon::parse($row->selesai)))
            ->all();
    }

    /** @return list<array{bulan: string, jumlah_mutasi: int, aset_berpindah: int}> */
    private function tren($rows): array
    {
        $months = [];
        foreach ($rows as $row) {
            $key = substr((string) $row->tanggal, 0, 7);
            $months[$key] ??= ['jumlah_mutasi' => 0, 'aset_berpindah' => 0];
            $months[$key]['jumlah_mutasi'] += (int) $row->mutasi;
            $months[$key]['aset_berpindah'] += (int) $row->aset;
        }

        if ($months === []) {
            return [];
        }

        ksort($months);
        $index = fn (string $ym) => ((int) substr($ym, 0, 4)) * 12 + (int) substr($ym, 5, 2);
        $first = $index(array_key_first($months));
        $last = $index(array_key_last($months));

        // ponytail: a mistyped date (e.g. 0202) would zero-fill thousands of months, so gaps are only filled for a plausible span.
        if ($last - $first > self::MAX_FILLED_SPAN_MONTHS) {
            return array_map(fn (string $ym) => ['bulan' => $ym] + $months[$ym], array_keys($months));
        }

        $result = [];
        for ($i = $first; $i <= $last; $i++) {
            $ym = sprintf('%04d-%02d', intdiv($i - 1, 12), ($i - 1) % 12 + 1);
            $result[] = ['bulan' => $ym] + ($months[$ym] ?? ['jumlah_mutasi' => 0, 'aset_berpindah' => 0]);
        }

        return $result;
    }

    /** @return array{baris: list<array<string, mixed>>, total: array<string, int|float>} */
    private function arus($rows): array
    {
        $names = Unit::whereIn('id', $rows->pluck('asal_id')->merge($rows->pluck('tujuan_id'))->unique())->pluck('name', 'id');
        $total = ['jumlah_mutasi' => 0, 'aset' => 0, 'nilai' => 0.0];

        $baris = $rows->map(function ($row) use ($names, &$total) {
            $total['jumlah_mutasi'] += (int) $row->mutasi;
            $total['aset'] += (int) $row->aset;
            $total['nilai'] += (float) $row->nilai;

            return [
                'asal_id' => (int) $row->asal_id, 'asal' => $names[$row->asal_id] ?? '-',
                'tujuan_id' => (int) $row->tujuan_id, 'tujuan' => $names[$row->tujuan_id] ?? '-',
                'jumlah_mutasi' => (int) $row->mutasi, 'aset' => (int) $row->aset, 'nilai' => (float) $row->nilai,
            ];
        })->sort(fn ($a, $b) => [$b['aset'], $a['asal'], $a['tujuan']] <=> [$a['aset'], $b['asal'], $b['tujuan']])->values()->all();

        return ['baris' => $baris, 'total' => $total];
    }

    /** @return list<array<string, mixed>> */
    private function masihBerjalan(callable $pending): array
    {
        return $pending()
            ->setEagerLoads([])
            ->with(['originUnit', 'destinationUnit', 'approvalRequest.steps.approverUser'])
            ->reorder('asset_mutations.created_at')
            ->orderBy('asset_mutations.id')
            ->limit(self::PENDING_LIMIT)
            ->get()
            ->map(function (AssetMutation $m) {
                $request = $m->approvalRequest;
                $step = $request?->steps->firstWhere('step_order', $request->current_step);

                return [
                    'id' => $m->id,
                    'nomor' => $m->nomor_mutasi,
                    'jenis' => $m->jenis_mutasi->label(),
                    'asal' => $m->originUnit?->name,
                    'tujuan' => $m->destinationUnit?->name,
                    'langkah' => $step?->label,
                    'menunggu' => $step ? $this->menunggu($step) : null,
                    'umur_hari' => max(0, (int) floor((now()->getTimestamp() - $m->created_at->getTimestamp()) / 86400)),
                    'url' => route('asset-mutations.show', $m),
                ];
            })
            ->all();
    }

    private function menunggu(ApprovalRequestStep $step): ?string
    {
        return match ($step->approver_type) {
            ApproverType::User => $step->approverUser?->name,
            ApproverType::AtasanUnit => 'Atasan Unit',
            ApproverType::Role => ucwords(str_replace('_', ' ', (string) $step->approver_role)),
        };
    }
}
