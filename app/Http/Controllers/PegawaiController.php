<?php

namespace App\Http\Controllers;

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
            'can' => ['create' => $request->user()->can('create', Pegawai::class)],
        ]);
    }

    public function store(PegawaiRequest $request): RedirectResponse
    {
        $this->service->create($request->validated(), $request->file('foto_profile'), $request->user());

        return back()->with('success', 'Pegawai berhasil ditambahkan.');
    }

    public function update(PegawaiRequest $request, Pegawai $pegawai): RedirectResponse
    {
        $this->service->update($pegawai, $request->validated(), $request->file('foto_profile'));

        return back()->with('success', 'Data pegawai berhasil diperbarui.');
    }

    public function destroy(Pegawai $pegawai): RedirectResponse
    {
        Gate::authorize('delete', $pegawai);

        $this->service->delete($pegawai);

        return back()->with('success', 'Pegawai berhasil dihapus.');
    }
}
