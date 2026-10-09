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
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name ?? $r->name,
                'unit_scope' => $r->unit_scope,
                'unit_head_of' => $r->unit_head_of,
                'is_system' => (bool) $r->is_system,
                'description' => $r->description,
                'users_count' => $r->users_count,
                'permissions_count' => $r->permissions->count(),
                'permissions' => $r->permissions->pluck('name')->all(),
            ]);

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
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
}
