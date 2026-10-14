<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\UpdateRoleRequest;
use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('pengaturan.role'), 403);

        $roles = Role::withCount('users')
            ->with('permissions')
            ->get()
            ->map(fn ($r) => $this->rolePayload($r));

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('pengaturan.role'), 403);

        return Inertia::render('Roles/Create', [
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    public function edit(Request $request, Role $role): Response
    {
        abort_unless($request->user()->can('pengaturan.role') && $request->user()->canManageRole($role), 403);

        return Inertia::render('Roles/Edit', [
            'role' => $this->rolePayload($role->loadCount('users')->load('permissions')),
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $role = Role::create([
            'name' => $request->validated('name'),
            'display_name' => $request->validated('display_name'),
            'unit_scope' => $request->validated('unit_scope'),
            'unit_head_of' => $request->validated('unit_head_of'),
            'description' => $request->validated('description'),
            'is_system' => false,
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->validated('permissions'));
        }

        return redirect()->route('roles.index')->with('success', "Role {$role->display_name} berhasil dibuat.");
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $data = [
            'display_name' => $request->validated('display_name'),
            'unit_scope' => $request->validated('unit_scope'),
            'unit_head_of' => $request->validated('unit_head_of'),
            'description' => $request->validated('description'),
        ];

        if (! $role->is_system && $request->filled('name')) {
            $data['name'] = $request->validated('name');
        }

        $role->update($data);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->validated('permissions') ?? []);
        }

        return redirect()->route('roles.index')->with('success', "Role {$role->display_name} berhasil diperbarui.");
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->can('pengaturan.role') && $request->user()->canManageRole($role), 403);

        if ($role->is_system) {
            return back()->with('error', 'Role sistem tidak boleh dihapus.');
        }

        if ($role->users()->exists()) {
            return back()->with('error', 'Role ini masih digunakan oleh pengguna aktif dan tidak dapat dihapus.');
        }

        $role->delete();

        return redirect()->route('roles.index')->with('success', 'Role berhasil dihapus.');
    }

    /**
     * @return array<string, mixed>
     */
    private function rolePayload(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'display_name' => $role->display_name ?? $role->name,
            'unit_scope' => $role->unit_scope,
            'unit_head_of' => $role->unit_head_of,
            'is_system' => (bool) $role->is_system,
            'description' => $role->description,
            'users_count' => $role->users_count,
            'permissions_count' => $role->permissions->count(),
            'permissions' => $role->permissions->pluck('name')->all(),
        ];
    }
}
