<?php

namespace App\Services;

use App\Models\ApprovalAction;
use App\Models\ApprovalRequest;
use App\Models\LoginLog;
use App\Models\User;
use App\Support\SessionDevice;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ActivityFeed
{
    public const PER_PAGE = 15;

    public function paginate(User $user, string $filter, int $page): LengthAwarePaginator
    {
        $page = max(1, $page);
        $limit = $page * self::PER_PAGE;
        $entries = collect();
        $total = 0;

        if ($filter !== 'login') {
            $total += ApprovalRequest::where('created_by', $user->id)->whereHasMorph('approvable', '*')->count();
            $total += ApprovalAction::where('user_id', $user->id)->whereHas('request', fn ($q) => $q->whereHasMorph('approvable', '*'))->count();
            $entries = $entries->merge($this->requestEntries($user, $limit))->merge($this->actionEntries($user, $limit));
        }

        if ($filter !== 'pekerjaan') {
            $total += LoginLog::where('user_id', $user->id)->count();
            $entries = $entries->merge($this->loginEntries($user, $limit));
        }

        $items = $entries
            ->sortByDesc(fn (array $e) => $e['waktu'])
            ->slice(($page - 1) * self::PER_PAGE, self::PER_PAGE)
            ->values()
            ->all();

        return new LengthAwarePaginator($items, $total, self::PER_PAGE, $page);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function requestEntries(User $user, int $limit): Collection
    {
        return ApprovalRequest::with('approvable')
            ->where('created_by', $user->id)
            ->whereHasMorph('approvable', '*')
            ->latest()
            ->limit($limit)
            ->get()
            ->filter(fn (ApprovalRequest $r) => $r->approvable !== null)
            ->map(fn (ApprovalRequest $r) => $this->entry(
                "pengajuan-{$r->id}",
                'pekerjaan',
                'Mengajukan '.$r->approvable->approvalTitle(),
                null,
                $r->created_at,
                $r->approvable->approvalShowUrl(),
                null,
            ));
    }

    /** @return Collection<int, array<string, mixed>> */
    private function actionEntries(User $user, int $limit): Collection
    {
        return ApprovalAction::with('request.approvable')
            ->where('user_id', $user->id)
            ->whereHas('request', fn ($q) => $q->whereHasMorph('approvable', '*'))
            ->latest()
            ->limit($limit)
            ->get()
            ->filter(fn (ApprovalAction $a) => $a->request?->approvable !== null)
            ->map(fn (ApprovalAction $a) => $this->entry(
                "aksi-{$a->id}",
                'pekerjaan',
                $a->action->label().' '.$a->request->approvable->approvalTitle(),
                $a->note,
                $a->created_at,
                $a->request->approvable->approvalShowUrl(),
                null,
            ));
    }

    /** @return Collection<int, array<string, mixed>> */
    private function loginEntries(User $user, int $limit): Collection
    {
        return LoginLog::where('user_id', $user->id)
            ->latest('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (LoginLog $l) => $this->entry(
                "login-{$l->id}",
                'login',
                match ($l->event) {
                    'login' => 'Login berhasil',
                    'gagal' => 'Login gagal',
                    default => 'Keluar dari sistem',
                },
                SessionDevice::label($l->user_agent).($l->ip_address ? " · {$l->ip_address}" : ''),
                $l->created_at,
                null,
                match ($l->event) {
                    'login' => 'berhasil',
                    'gagal' => 'gagal',
                    default => 'keluar',
                },
            ));
    }

    /** @return array<string, mixed> */
    private function entry(string $id, string $tipe, string $judul, ?string $keterangan, ?Carbon $waktu, ?string $url, ?string $hasil): array
    {
        return [
            'id' => $id,
            'tipe' => $tipe,
            'judul' => $judul,
            'keterangan' => $keterangan,
            'waktu' => $waktu?->toIso8601String() ?? '',
            'url' => $url,
            'hasil' => $hasil,
        ];
    }
}
