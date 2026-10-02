<?php

namespace App\Services;

use App\Enums\ApprovalActionType;
use App\Enums\ApproverType;
use App\Enums\AssetReportStatus;
use App\Enums\Kondisi;
use App\Models\ApprovalRequestStep;
use App\Models\AssetReport;
use App\Models\Unit;
use App\Models\User;
use App\Support\Days;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AssetReportRecapService
{
    private const MAX_FILLED_SPAN_MONTHS = 60;

    private const PENDING_LIMIT = 20;

    private const AFFECTED = 'COUNT(asset_reports.id) as laporan, COALESCE(SUM(a.nilai_perolehan), 0) as nilai_perolehan, COALESCE(SUM(a.nilai_buku), 0) as nilai_buku';

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function for(User $user, array $filters): array
    {
        $query = new ReportQuery($user);
        $base = fn (): QueryBuilder => $query->build('rusak-hilang', $filters)->reorder()->toBase();
        $approved = fn (): QueryBuilder => $base()->where('asset_reports.status', AssetReportStatus::Approved->value);
        $affected = fn (): QueryBuilder => $approved()
            ->join('assets as a', 'a.id', '=', 'asset_reports.asset_id');

        $jumlah = $base()->count();
        $totals = $affected()->selectRaw(self::AFFECTED)->first();
        $durations = $this->durations($approved);

        $pending = fn () => $query->build('rusak-hilang', $filters)->where('asset_reports.status', AssetReportStatus::Pending->value);

        return [
            'ringkasan' => [
                'jumlah_laporan' => $jumlah,
                'disetujui' => $approved()->count(),
                'nilai_perolehan' => (float) ($totals->nilai_perolehan ?? 0.0),
                'nilai_buku' => (float) ($totals->nilai_buku ?? 0.0),
                'rata_lama_proses' => $durations === [] ? null : round(array_sum($durations) / count($durations), 1),
                'terlama_proses' => $durations === [] ? null : max($durations),
            ],
            'status' => $this->komposisi(
                AssetReportStatus::cases(), 'status',
                $base()->selectRaw('asset_reports.status as k, COUNT(*) as n')->groupBy('asset_reports.status')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'kondisi' => $this->komposisi(
                [Kondisi::RusakRingan, Kondisi::RusakBerat, Kondisi::Hilang], 'kondisi',
                $base()->selectRaw('asset_reports.kondisi_baru as k, COUNT(*) as n')->groupBy('asset_reports.kondisi_baru')->pluck('n', 'k')->all(),
                $jumlah,
            ),
            'tren' => $this->tren($affected()->selectRaw('asset_reports.tanggal_kejadian as tanggal, '.self::AFFECTED)->groupBy('asset_reports.tanggal_kejadian')->get()),
            'sebaran_unit' => $this->sebaranUnit($user, $affected()),
            'masih_berjalan' => $this->masihBerjalan($pending),
            'jumlah_masih_berjalan' => $pending()->count(),
        ];
    }

    /**
     * @param  list<AssetReportStatus|Kondisi>  $cases
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
            ->where('r.approvable_type', (new AssetReport)->getMorphClass())
            ->whereIn('r.approvable_id', $approved()->select('asset_reports.id'))
            ->where('a.action', ApprovalActionType::Approve->value)
            ->groupBy('r.id', 'r.created_at')
            ->selectRaw('r.created_at as diajukan, MAX(a.created_at) as selesai')
            ->get()
            ->map(fn ($row) => Days::between(Carbon::parse($row->diajukan), Carbon::parse($row->selesai)))
            ->all();
    }

    /** @return list<array{bulan: string, jumlah: int, nilai_perolehan: float}> */
    private function tren($rows): array
    {
        $months = [];
        foreach ($rows as $row) {
            $key = substr((string) $row->tanggal, 0, 7);
            $months[$key] ??= ['jumlah' => 0, 'nilai_perolehan' => 0.0];
            $months[$key]['jumlah'] += (int) $row->laporan;
            $months[$key]['nilai_perolehan'] += (float) $row->nilai_perolehan;
        }

        if ($months === []) {
            return [];
        }

        ksort($months);
        $index = fn (string $ym) => ((int) substr($ym, 0, 4)) * 12 + (int) substr($ym, 5, 2);
        $first = $index(array_key_first($months));
        $last = $index(array_key_last($months));

        if ($last - $first > self::MAX_FILLED_SPAN_MONTHS) {
            return array_map(fn (string $ym) => ['bulan' => $ym] + $months[$ym], array_keys($months));
        }

        $result = [];
        for ($i = $first; $i <= $last; $i++) {
            $ym = sprintf('%04d-%02d', intdiv($i - 1, 12), ($i - 1) % 12 + 1);
            $result[] = ['bulan' => $ym] + ($months[$ym] ?? ['jumlah' => 0, 'nilai_perolehan' => 0.0]);
        }

        return $result;
    }

    /** @return array{baris: list<array<string, mixed>>, total: array<string, int|float>}|null */
    private function sebaranUnit(User $user, QueryBuilder $affected): ?array
    {
        $accessible = $user->accessibleUnitIds();

        // null if user is constrained to a single unit
        if ($accessible !== null && count($accessible) <= 1) {
            return null;
        }

        $units = Unit::query()
            ->when($accessible !== null, fn ($q) => $q->whereIn('id', $accessible))
            ->orderBy('type')->orderBy('name')
            ->get(['id', 'name']);

        $rows = (clone $affected)
            ->selectRaw('asset_reports.unit_id as unit_id, asset_reports.kondisi_baru, COUNT(asset_reports.id) as n, COALESCE(SUM(a.nilai_buku), 0) as nb')
            ->groupBy('asset_reports.unit_id', 'asset_reports.kondisi_baru')
            ->get();

        $byUnit = [];
        foreach ($rows as $row) {
            $uid = (int) $row->unit_id;
            $byUnit[$uid] ??= ['rusak' => 0, 'hilang' => 0, 'nilai_buku' => 0.0];
            if ($row->kondisi_baru === Kondisi::Hilang->value) {
                $byUnit[$uid]['hilang'] += (int) $row->n;
            } else {
                $byUnit[$uid]['rusak'] += (int) $row->n;
            }
            $byUnit[$uid]['nilai_buku'] += (float) $row->nb;
        }

        $total = ['jumlah_rusak' => 0, 'jumlah_hilang' => 0, 'total' => 0, 'nilai_buku' => 0.0];
        $baris = [];

        foreach ($units as $u) {
            $data = $byUnit[$u->id] ?? ['rusak' => 0, 'hilang' => 0, 'nilai_buku' => 0.0];
            $t = $data['rusak'] + $data['hilang'];
            $total['jumlah_rusak'] += $data['rusak'];
            $total['jumlah_hilang'] += $data['hilang'];
            $total['total'] += $t;
            $total['nilai_buku'] += $data['nilai_buku'];

            $baris[] = [
                'id' => $u->id,
                'name' => $u->name,
                'jumlah_rusak' => $data['rusak'],
                'jumlah_hilang' => $data['hilang'],
                'total' => $t,
                'nilai_buku' => $data['nilai_buku'],
            ];
        }

        return ['baris' => $baris, 'total' => $total];
    }

    /** @return list<array<string, mixed>> */
    private function masihBerjalan(callable $pending): array
    {
        return $pending()
            ->setEagerLoads([])
            ->with(['asset', 'unit', 'pegawai', 'approvalRequest.steps.approverUser'])
            ->reorder('asset_reports.created_at')
            ->orderBy('asset_reports.id')
            ->limit(self::PENDING_LIMIT)
            ->get()
            ->map(function (AssetReport $r) {
                $request = $r->approvalRequest;
                $step = $request?->steps->firstWhere('step_order', $request->current_step);

                return [
                    'id' => $r->id,
                    'nomor' => $r->nomor_laporan,
                    'kondisi_label' => $r->kondisi_baru?->label() ?? $r->jenis->label(),
                    'nama_aset' => $r->asset?->nama_aset,
                    'unit' => $r->unit?->name,
                    'pemegang' => $r->pegawai?->nama,
                    'langkah' => $step?->label,
                    'menunggu' => $step ? $this->menunggu($step) : null,
                    'umur_hari' => max(0, (int) floor((now()->getTimestamp() - $r->created_at->getTimestamp()) / 86400)),
                    'url' => route('asset-reports.show', $r),
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
