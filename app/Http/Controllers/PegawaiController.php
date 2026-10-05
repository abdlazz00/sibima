<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreatePegawaiUserRequest;
use App\Http\Requests\PegawaiRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use App\Services\PegawaiService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PegawaiController extends Controller
{
    public function __construct(
        private readonly PegawaiService $service,
        private readonly PegawaiRepositoryInterface $pegawais,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Pegawai::class);

        return Inertia::render('Pegawai/Index', [
            'pegawais' => $this->pegawais->listVisibleTo($request->user()),
            'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),
            'can' => [
                'create' => $request->user()->can('create', Pegawai::class),
                'createUser' => $request->user()->hasRole('kasubag') || $request->user()->can('pegawai.create-user'),
                'manageAccess' => $request->user()->can('user.manage-access'),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', Pegawai::class);

        return Inertia::render('Pegawai/Create', [
            'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),
        ]);
    }

    public function store(PegawaiRequest $request): RedirectResponse
    {
        $this->service->create($request->validated(), $request->file('foto_profile'), $request->user());

        return redirect()->route('pegawais.index')->with('success', 'Pegawai berhasil ditambahkan.');
    }

    public function show(Pegawai $pegawai, Request $request): Response
    {
        Gate::authorize('view', $pegawai);

        $pegawai->load([
            'unit',
            'user.roles',
            'assets' => fn ($query) => $query->with('category')->latest(),
        ]);

        return Inertia::render('Pegawai/Show', [
            'pegawai' => $pegawai,
            'can' => [
                'update' => $request->user()->can('update', $pegawai),
                'delete' => $request->user()->can('delete', $pegawai),
                'createUser' => $request->user()->can('createUser', $pegawai),
            ],
        ]);
    }

    public function edit(Pegawai $pegawai, Request $request): Response
    {
        Gate::authorize('update', $pegawai);

        $pegawai->load(['unit']);

        return Inertia::render('Pegawai/Edit', [
            'pegawai' => $pegawai,
            'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),
        ]);
    }

    public function update(PegawaiRequest $request, Pegawai $pegawai): RedirectResponse
    {
        $this->service->update($pegawai, $request->validated(), $request->file('foto_profile'));

        return redirect()->route('pegawais.show', $pegawai->id)->with('success', 'Data pegawai berhasil diperbarui.');
    }

    public function destroy(Pegawai $pegawai): RedirectResponse
    {
        Gate::authorize('delete', $pegawai);

        $this->service->delete($pegawai);

        return back()->with('success', 'Pegawai berhasil dihapus.');
    }

    public function createUser(CreatePegawaiUserRequest $request, Pegawai $pegawai): RedirectResponse
    {
        $this->service->createLoginForPegawai(
            $pegawai,
            $request->validated('email'),
            $request->validated('password'),
            $request->validated('role'),
        );

        return back()->with('success', 'Akun login berhasil dibuat untuk pegawai ini.');
    }
}
