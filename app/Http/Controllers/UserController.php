<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateUserRequest;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use App\Services\PegawaiService;
use Database\Seeders\PermissionSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('user.view'), 403);

        $accessibleUnitIds = $request->user()->accessibleUnitIds();

        $query = User::with(['pegawai.unit', 'roles', 'permissions', 'unit'])
            ->when($accessibleUnitIds !== null, fn ($q) => $q->whereIn('unit_id', $accessibleUnitIds));

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('pegawai', fn ($pq) => $pq->where('nip', 'like', "%{$search}%")->orWhere('nama', 'like', "%{$search}%"));
            });
        }

        if ($role = $request->input('role')) {
            $query->whereHas('roles', fn ($rq) => $rq->where('name', $role));
        }

        if ($unitId = $request->input('unit_id')) {
            $query->where('unit_id', $unitId);
        }

        if ($status = $request->input('status')) {
            if ($status === 'active') {
                $query->where('is_active', true);
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            }
        }

        $users = $query->latest('id')->paginate(15)->withQueryString()->through(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'is_active' => (bool) $u->is_active,
            'foto_profile_url' => $u->foto_profile_url,
            'pegawai' => $u->pegawai ? [
                'id' => $u->pegawai->id,
                'nama' => $u->pegawai->nama,
                'nip' => $u->pegawai->nip,
                'jabatan' => $u->pegawai->jabatan,
            ] : null,
            'unit' => $u->unit ? [
                'id' => $u->unit->id,
                'name' => $u->unit->name,
            ] : null,
            'roles' => $u->roles->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name ?? $r->name,
            ]),
            'direct_permissions_count' => $u->permissions->count(),
            'direct_permissions' => $u->permissions->pluck('name')->all(),
            'unit_scope_override' => $u->unit_scope_override,
            'created_at' => $u->created_at?->format('d/m/Y H:i'),
        ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => Role::orderBy('name')->get(['id', 'name', 'display_name']),
            'units' => Unit::orderBy('name')
                ->when($accessibleUnitIds !== null, fn ($q) => $q->whereIn('id', $accessibleUnitIds))
                ->get(['id', 'name', 'type']),
            'filters' => $request->only(['search', 'role', 'unit_id', 'status']),
            'can' => [
                'manageAccess' => $request->user()->can('user.manage-access'),
                'toggleStatus' => $request->user()->can('user.toggle-status'),
                'delete' => $request->user()->can('user.delete'),
            ],
        ]);
    }

    public function show(User $user, Request $request): Response
    {
        abort_unless($request->user()->can('user.view'), 403);

        $accessibleUnitIds = $request->user()->accessibleUnitIds();
        if ($accessibleUnitIds !== null && ! in_array($user->unit_id, $accessibleUnitIds, true)) {
            abort(403);
        }

        $user->load(['pegawai.unit', 'roles', 'permissions', 'unit']);

        // Kelompokkan izin efektif per modul
        $directPermissions = $user->permissions->pluck('name')->all();
        $effectivePermissions = $user->getAllPermissions()->pluck('name')->all();

        $groupedPermissions = [];
        foreach (PermissionSeeder::PERMISSION_GROUPS as $groupName => $groupPerms) {
            $activeInGroup = array_intersect($groupPerms, $effectivePermissions);
            if (! empty($activeInGroup)) {
                $groupedPermissions[$groupName] = array_values($activeInGroup);
            }
        }

        return Inertia::render('Users/Show', [
            'user' => [
                ...$user->only(['id', 'name', 'email', 'unit_id']),
                'is_active' => (bool) $user->is_active,
                'foto_profile_url' => $user->foto_profile_url,
                'unit' => $user->unit?->only(['id', 'name']),
                'pegawai' => $user->pegawai ? [
                    ...$user->pegawai->only(['id', 'nama', 'nip', 'jabatan', 'no_hp']),
                    'unit_nama' => $user->pegawai->unit?->name,
                ] : null,
                'roles' => $user->roles->map(fn ($r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'display_name' => $r->display_name ?? $r->name,
                    'unit_scope' => $r->unit_scope,
                    'description' => $r->description,
                ]),
                'direct_permissions' => $directPermissions,
                'unit_scope_override' => $user->unit_scope_override,
                'created_at' => $user->created_at?->format('d/m/Y H:i'),
            ],
            'effectivePermissions' => $groupedPermissions,
            'can' => [
                'manageAccess' => $request->user()->can('user.manage-access'),
                'toggleStatus' => $request->user()->can('user.toggle-status'),
                'delete' => $request->user()->can('user.delete'),
            ],
        ]);
    }

    public function edit(User $user, Request $request): Response
    {
        abort_unless($request->user()->can('user.manage-access') && $request->user()->canManage($user), 403);

        $user->load(['pegawai.unit', 'permissions', 'unit']);

        $roles = Role::with('permissions')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name ?? $r->name,
                'unit_scope' => $r->unit_scope,
                'permissions' => $r->permissions->pluck('name')->all(),
            ]);

        return Inertia::render('Users/Edit', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'foto_profile_url' => $user->foto_profile_url,
                'role' => $user->roles->first()?->name ?? '',
                'direct_permissions' => $user->permissions->pluck('name')->all(),
                'unit_scope_override' => $user->unit_scope_override,
                'pegawai' => $user->pegawai ? [
                    'id' => $user->pegawai->id,
                    'nama' => $user->pegawai->nama,
                    'nip' => $user->pegawai->nip,
                    'jabatan' => $user->pegawai->jabatan,
                ] : null,
                'unit' => $user->unit ? [
                    'id' => $user->unit->id,
                    'name' => $user->unit->name,
                ] : null,
            ],
            'roles' => $roles,
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
            'units' => Unit::orderBy('name')->get(['id', 'name', 'type']),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user, PegawaiService $pegawaiService): RedirectResponse
    {
        // Proteksi self: tidak boleh menonaktifkan akun sendiri
        if ($user->id === $request->user()->id && ! $request->boolean('is_active')) {
            return back()->with('error', 'Anda tidak dapat menonaktifkan akun Anda sendiri.');
        }

        // Proteksi self kasubag: tidak boleh mencabut role kasubag dari diri sendiri
        if ($user->id === $request->user()->id && $request->role !== 'kasubag' && $user->hasRole('kasubag')) {
            return back()->with('error', 'Anda tidak dapat mencabut role Kasubag dari akun Anda sendiri.');
        }

        $updateData = [
            'email' => $request->validated('email'),
            'is_active' => $request->boolean('is_active'),
        ];

        if ($request->filled('password')) {
            $updateData['password'] = $request->validated('password');
        }

        $user->update($updateData);

        $pegawaiService->updateUserAccess(
            $user,
            $request->validated('role'),
            $request->validated('direct_permissions', []),
            $request->validated('unit_scope_override'),
        );

        return redirect()->route('users.show', $user)->with('success', "Akun {$user->name} berhasil diperbarui.");
    }

    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->can('user.toggle-status') && $request->user()->canManage($user), 403);

        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Anda tidak dapat menonaktifkan akun Anda sendiri.');
        }

        if ($user->hasRole('kasubag')) {
            return back()->with('error', 'Akun Kasubag sistem tidak boleh dinonaktifkan.');
        }

        $user->update(['is_active' => ! $user->is_active]);

        $statusText = $user->is_active ? 'diaktifkan' : 'dinonaktifkan';

        return back()->with('success', "Status akun {$user->name} berhasil {$statusText}.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->can('user.delete') && $request->user()->canManage($user), 403);

        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Anda tidak dapat menghapus akun Anda sendiri.');
        }

        if ($user->hasRole('kasubag')) {
            return back()->with('error', 'Akun Kasubag sistem tidak boleh dihapus.');
        }

        if ($user->approvalActions()->exists()) {
            return back()->with('error', 'Akun ini memiliki riwayat persetujuan dokumen transaksi dan tidak dapat dihapus demi integritas jejak audit. Silakan nonaktifkan akun ini sebagai gantinya.');
        }

        DB::transaction(function () use ($user) {
            Pegawai::where('user_id', $user->id)->update(['user_id' => null]);
            $user->syncRoles([]);
            $user->syncPermissions([]);
            $user->delete();
        });

        return redirect()->route('users.index')->with('success', 'Akun pengguna berhasil dihapus.');
    }
}
