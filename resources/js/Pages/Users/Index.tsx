import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import React, { useState } from 'react';

interface UserListItem {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    pegawai: {
        id: number;
        nama: string;
        nip: string | null;
        jabatan: string;
    } | null;
    unit: {
        id: number;
        name: string;
    } | null;
    roles: {
        id: number;
        name: string;
        display_name: string;
    }[];
    direct_permissions_count: number;
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
    created_at: string;
}

interface PaginatedUsers {
    data: UserListItem[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
}

interface UnitOption {
    id: number;
    name: string;
    type: string;
}

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
}

interface IndexProps extends PageProps {
    users: PaginatedUsers;
    roles: RoleOption[];
    units: UnitOption[];
    filters: {
        search?: string;
        role?: string;
        unit_id?: string;
        status?: string;
    };
    can: {
        manageAccess: boolean;
        toggleStatus: boolean;
        delete: boolean;
    };
}

export default function Index({ auth, users, roles, units, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || '');
    const [unitId, setUnitId] = useState(filters.unit_id || '');
    const [status, setStatus] = useState(filters.status || '');
    const [isUpdating, setIsUpdating] = useState<number | null>(null);

    const applyFilter = (newParams: Partial<typeof filters>) => {
        const query = {
            search: search || undefined,
            role: role || undefined,
            unit_id: unitId || undefined,
            status: status || undefined,
            ...newParams,
        };

        // Remove undefined keys
        Object.keys(query).forEach((key) => {
            if ((query as Record<string, unknown>)[key] === undefined || (query as Record<string, unknown>)[key] === '') {
                delete (query as Record<string, unknown>)[key];
            }
        });

        router.get(route('users.index'), query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilter({ search });
    };

    const handleResetFilters = () => {
        setSearch('');
        setRole('');
        setUnitId('');
        setStatus('');
        router.get(route('users.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const handleToggleStatus = (user: UserListItem) => {
        if (user.id === auth.user?.id) {
            alert('Anda tidak dapat menonaktifkan akun Anda sendiri.');
            return;
        }

        const actionText = user.is_active ? 'menonaktifkan' : 'mengaktifkan';
        const confirmMsg = `Apakah Anda yakin ingin ${actionText} akun "${user.name}" (${user.email})?`;

        if (!window.confirm(confirmMsg)) return;

        setIsUpdating(user.id);
        router.patch(
            route('users.toggle-status', user.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsUpdating(null),
            },
        );
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const getRoleBadgeColor = (roleName: string) => {
        switch (roleName) {
            case 'kasubag':
                return 'bg-amber-50 text-amber-800 border-amber-200';
            case 'camat':
                return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'admin_kecamatan':
                return 'bg-indigo-50 text-indigo-800 border-indigo-200';
            case 'admin_kelurahan':
                return 'bg-purple-50 text-purple-800 border-purple-200';
            case 'lurah':
                return 'bg-teal-50 text-teal-800 border-teal-200';
            default:
                return 'bg-gray-50 text-gray-800 border-gray-200';
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Pengguna - SIBIMA" />

            <div className="space-y-6">
                {/* Breadcrumb & Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Beranda
                            </Link>
                            <span>/</span>
                            <span className="text-slate-400">Pengaturan</span>
                            <span>/</span>
                            <span className="font-medium text-slate-700">Manajemen Pengguna</span>
                        </nav>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            Manajemen Pengguna & Hak Akses
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Kelola akun pengguna, penetapan peran (role), cakupan unit kerja, dan hak akses sistem.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href={route('pegawais.index')}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Buka Data Pegawai
                        </Link>
                    </div>
                </div>

                {/* Info Card: Account Creation Policy */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/40 p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <div className="flex-1 text-sm">
                            <h4 className="font-semibold text-blue-900">Integritas Akun & Data Pegawai</h4>
                            <p className="mt-0.5 text-blue-800 leading-relaxed">
                                Setiap akun login di SIBIMA terhubung 1-to-1 dengan data pegawai untuk menjamin akuntabilitas tanda tangan berita acara dan riwayat audit. Pembuatan akun baru dilakukan langsung dari menu{' '}
                                <Link href={route('pegawais.index')} className="font-semibold underline hover:text-blue-950">
                                    Data Pegawai
                                </Link>
                                . Di halaman ini, Anda dapat mengaktifkan/menonaktifkan akun, mengatur role, serta menambahkan hak akses khusus.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
                        {/* Search Input */}
                        <div className="lg:col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-slate-700">Cari Pengguna</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama, email, NIP..."
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                />
                                <svg
                                    className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                        </div>

                        {/* Unit Filter */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">Unit Kerja</label>
                            <select
                                value={unitId}
                                onChange={(e) => {
                                    setUnitId(e.target.value);
                                    applyFilter({ unit_id: e.target.value });
                                }}
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                                <option value="">Semua Unit</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Role Filter */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">Peran (Role)</label>
                            <select
                                value={role}
                                onChange={(e) => {
                                    setRole(e.target.value);
                                    applyFilter({ role: e.target.value });
                                }}
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                                <option value="">Semua Peran</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter & Reset */}
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => {
                                        setStatus(e.target.value);
                                        applyFilter({ status: e.target.value });
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                >
                                    <option value="">Semua Status</option>
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Nonaktif</option>
                                </select>
                            </div>
                            {(search || role || unitId || status) && (
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    title="Reset Filter"
                                    className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 focus:outline-none"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between bg-slate-50/50">
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Daftar Pengguna ({users.total})
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th className="px-5 py-3.5">Pengguna</th>
                                    <th className="px-4 py-3.5">Unit Kerja</th>
                                    <th className="px-4 py-3.5">Peran & Cakupan</th>
                                    <th className="px-4 py-3.5">Izin Khusus</th>
                                    <th className="px-4 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <svg className="h-10 w-10 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <line x1="18" y1="8" x2="23" y2="13" />
                                                    <line x1="23" y1="8" x2="18" y2="13" />
                                                </svg>
                                                <p className="font-medium text-slate-600">Tidak ada pengguna ditemukan</p>
                                                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter yang dipilih.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => (
                                        <tr key={user.id} className="transition-colors hover:bg-slate-50/70">
                                            {/* Pengguna Column */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    {user.foto_profile_url ? (
                                                        <img
                                                            src={user.foto_profile_url}
                                                            alt={user.name}
                                                            className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-200"
                                                        />
                                                    ) : (
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 border border-blue-200">
                                                            {getInitials(user.name)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <Link
                                                                href={route('users.show', user.id)}
                                                                className="font-semibold text-slate-900 hover:text-blue-700 truncate"
                                                            >
                                                                {user.name}
                                                            </Link>
                                                            {user.id === auth.user?.id && (
                                                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                                                    Anda
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                                        {user.pegawai && (
                                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                                {user.pegawai.nip ? `NIP: ${user.pegawai.nip}` : user.pegawai.jabatan}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Unit Kerja Column */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                                    {user.unit?.name ?? 'Tidak Terikat Unit'}
                                                </span>
                                            </td>

                                            {/* Roles & Scope Column */}
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {user.roles.length > 0 ? (
                                                        user.roles.map((r) => (
                                                            <span
                                                                key={r.id}
                                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                                                                    r.name,
                                                                )}`}
                                                            >
                                                                {r.display_name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs italic text-slate-400">Belum ada role</span>
                                                    )}

                                                    {user.unit_scope_override && (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200">
                                                            Scope: {user.unit_scope_override}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Direct Permissions Column */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {user.direct_permissions_count > 0 ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                        +{user.direct_permissions_count} Khusus
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Dari role</span>
                                                )}
                                            </td>

                                            {/* Status Column */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {user.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions Column */}
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Detail Link */}
                                                    <Link
                                                        href={route('users.show', user.id)}
                                                        title="Lihat Detail Profil & Hak Akses"
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700 focus:outline-none"
                                                    >
                                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                        Detail
                                                    </Link>

                                                    {/* Edit Link */}
                                                    {can.manageAccess && (
                                                        <Link
                                                            href={route('users.edit', user.id)}
                                                            title="Edit Hak Akses & Peran"
                                                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 shadow-2xs hover:bg-blue-100 focus:outline-none"
                                                        >
                                                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                                                <path d="m15 5 4 4" />
                                                            </svg>
                                                            Edit
                                                        </Link>
                                                    )}

                                                    {/* Toggle Status Button */}
                                                    {can.toggleStatus && user.id !== auth.user?.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(user)}
                                                            disabled={isUpdating === user.id}
                                                            title={user.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-2xs focus:outline-none transition ${
                                                                user.is_active
                                                                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                                            }`}
                                                        >
                                                            {user.is_active ? (
                                                                <>
                                                                    <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <circle cx="12" cy="12" r="10" />
                                                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                                    </svg>
                                                                    Nonaktifkan
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                                    </svg>
                                                                    Aktifkan
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.total > users.per_page && (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-5 py-3.5 gap-3 bg-slate-50/50 text-xs text-slate-500">
                            <div>
                                Menampilkan <span className="font-semibold text-slate-700">{users.from ?? 0}</span> sampai{' '}
                                <span className="font-semibold text-slate-700">{users.to ?? 0}</span> dari{' '}
                                <span className="font-semibold text-slate-700">{users.total}</span> pengguna
                            </div>
                            <div className="flex items-center gap-1">
                                {users.links.map((link, idx) => (
                                    <Link
                                        key={idx}
                                        href={link.url || '#'}
                                        preserveScroll
                                        preserveState
                                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                            link.active
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : link.url
                                                ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                                : 'text-slate-300 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
