<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityLogPresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function __construct(private readonly ActivityLogPresenter $presenter) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super-admin'), 403);

        $query = Activity::with(['causer.roles', 'subject'])->latest('id');

        if ($request->filled('q')) {
            $search = '%'.trim((string) $request->input('q')).'%';
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', $search)
                    ->orWhereHasMorph('causer', [User::class], fn ($uq) => $uq->where('name', 'like', $search)->orWhere('email', 'like', $search));
            });
        }

        if ($request->filled('modul')) {
            $query->where('log_name', $request->input('modul'));
        }

        if ($request->filled('event')) {
            $query->where('event', $request->input('event'));
        }

        if ($request->filled('user_id')) {
            $query->where('causer_type', User::class)->where('causer_id', $request->input('user_id'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->input('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->input('end_date'));
        }

        $logs = $query->paginate(15)
            ->withQueryString()
            ->through(fn (Activity $log) => $this->presenter->format($log));

        $modules = [
            ['value' => 'asset', 'label' => 'Data Aset'],
            ['value' => 'pegawai', 'label' => 'Pegawai'],
            ['value' => 'user', 'label' => 'Pengguna (User)'],
            ['value' => 'kategori', 'label' => 'Kategori BMD'],
            ['value' => 'berita-acara', 'label' => 'Berita Acara'],
            ['value' => 'mutasi', 'label' => 'Mutasi Aset'],
            ['value' => 'laporan', 'label' => 'Laporan Kerusakan'],
            ['value' => 'alur', 'label' => 'Alur Persetujuan'],
            ['value' => 'role', 'label' => 'Peran (Role)'],
        ];

        $events = [
            ['value' => 'created', 'label' => 'Dibuat (Created)'],
            ['value' => 'updated', 'label' => 'Diubah (Updated)'],
            ['value' => 'deleted', 'label' => 'Dihapus (Deleted)'],
        ];

        return Inertia::render('ActivityLogs/Index', [
            'logs' => $logs,
            'filters' => $request->only(['q', 'modul', 'event', 'user_id', 'start_date', 'end_date']),
            'modules' => $modules,
            'events' => $events,
            'users' => User::select('id', 'name')->orderBy('name')->get(),
        ]);
    }
}
