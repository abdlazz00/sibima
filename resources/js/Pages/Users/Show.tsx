import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import React, { useMemo, useState } from 'react';

interface UserDetail {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    unit_id: number | null;
    unit: {
        id: number;
        name: string;
    } | null;
    pegawai: {
        id: number;
        nama: string;
        nip: string | null;
        jabatan: string;
        telepon: string | null;
        unit_nama?: string;
    } | null;
    roles: {
        id: number;
        name: string;
        display_name: string;
        unit_scope: string;
        description: string | null;
    }[];
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
    created_at: string;
}

interface ShowProps extends PageProps {
    user: UserDetail;
    effectivePermissions: Record<string, string[]>;
    can: {
        manageAccess: boolean;
        toggleStatus: boolean;
        delete: boolean;
    };
}

export default function Show({ auth, user, effectivePermissions, can }: ShowProps) {
    const [permSearch, setPermSearch] = useState('');

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const directPermsSet = useMemo(() => {
        return new Set(user.direct_permissions || []);
    }, [user.direct_permissions]);

    const primaryRole = user.roles[0];

    const getScopeLabel = (scope: string) => {
        switch (scope) {
            case 'all':
                return {
                    label: 'Semua Unit Kerja (Kecamatan & Seluruh Kelurahan)',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                };
            case 'binaan':
                return {
                    label: 'Kecamatan & Kelurahan Binaan',
                    color: 'bg-purple-50 text-purple-700 border-purple-200',
                };
            case 'own':
            default:
                return {
                    label: 'Unit Kerja Sendiri Saja',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                };
        }
    };

    const effectiveScope = user.unit_scope_override || primaryRole?.unit_scope || 'own';
    const scopeInfo = getScopeLabel(effectiveScope);

    // Total count of permissions
    const totalEffectivePerms = useMemo(() => {
        return Object.values(effectivePermissions).reduce((acc, perms) => acc + perms.length, 0);
    }, [effectivePermissions]);

    // Filter permissions by search
    const filteredModules = useMemo(() => {
        if (!permSearch) return effectivePermissions;

        const query = permSearch.toLowerCase();
        const result: Record<string, string[]> = {};

        Object.entries(effectivePermissions).forEach(([moduleName, perms]) => {
            const matchesModule = moduleName.toLowerCase().includes(query);
            const matchingPerms = perms.filter((p) => p.toLowerCase().includes(query));

            if (matchesModule) {
                result[moduleName] = perms;
            } else if (matchingPerms.length > 0) {
                result[moduleName] = matchingPerms;
            }
        });

        return result;
    }, [effectivePermissions, permSearch]);

    return (
        <AuthenticatedLayout>
            <Head title={`Detail Pengguna - ${user.name}`} />

            <div className="space-y-6">
                {/* Header & Breadcrumb */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Beranda
                            </Link>
                            <span>/</span>
                            <Link href={route('users.index')} className="hover:text-blue-700">
                                Manajemen Pengguna
                            </Link>
                            <span>/</span>
                            <span className="font-medium text-slate-700">{user.name}</span>
                        </nav>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                {user.name}
                            </h1>
                            {user.is_active ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Akun Aktif
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    Akun Dinonaktifkan
                                </span>
                            )}
                            {user.id === auth.user?.id && (
                                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                                    Akun Anda
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link
                            href={route('users.index')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none"
                        >
                            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                            Kembali
                        </Link>

                        {can.manageAccess && (
                            <Link
                                href={route('users.edit', user.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                </svg>
                                Edit Hak Akses
                            </Link>
                        )}
                    </div>
                </div>

                {/* Top Info Cards Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Card 1: Identitas Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-4">
                            {user.foto_profile_url ? (
                                <img
                                    src={user.foto_profile_url}
                                    alt={user.name}
                                    className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-slate-200 shadow-xs"
                                />
                            ) : (
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 border-2 border-blue-200">
                                    {getInitials(user.name)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 truncate text-base">{user.name}</h3>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200 mt-2">
                                    {user.unit?.name ?? 'Unit tidak ditetapkan'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">ID Pengguna</span>
                                <span className="font-semibold text-slate-700">#{user.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Terdaftar Pada</span>
                                <span className="font-medium text-slate-700">{user.created_at}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Foto Profil</span>
                                <span className="font-medium text-slate-700">
                                    {user.foto_profile_url ? 'Dari Data Pegawai' : 'Inisial Standar'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Kaitan Data Pegawai */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm">Data Pegawai Terkait</h3>
                            </div>
                            {user.pegawai && (
                                <Link
                                    href={route('pegawais.index')}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                    Lihat Pegawai &rarr;
                                </Link>
                            )}
                        </div>

                        {user.pegawai ? (
                            <div className="mt-4 space-y-2.5 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Nama Lengkap Pegawai</span>
                                    <span className="font-semibold text-slate-800 text-sm">{user.pegawai.nama}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-slate-500">NIP</span>
                                    <span className="font-semibold text-slate-800">{user.pegawai.nip || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Jabatan</span>
                                    <span className="font-medium text-slate-800">{user.pegawai.jabatan}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Unit Kerja</span>
                                    <span className="font-medium text-slate-800">{user.pegawai.unit_nama || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">No. Telepon / HP</span>
                                    <span className="font-medium text-slate-800">{user.pegawai.telepon || '-'}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 text-center text-slate-400 text-xs py-4">
                                Tidak ada data pegawai yang terhubung langsung dengan akun ini.
                            </div>
                        )}
                    </div>

                    {/* Card 3: Peran & Cakupan Wilayah */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm">Peran & Cakupan Wilayah</h3>
                        </div>

                        <div className="mt-4 space-y-3.5 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[11px] mb-1">Peran Utama (Role)</span>
                                {primaryRole ? (
                                    <div>
                                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                                            {primaryRole.display_name}
                                        </span>
                                        {primaryRole.description && (
                                            <p className="mt-1 text-slate-500 text-[11px] leading-relaxed">
                                                {primaryRole.description}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">Belum ada peran yang ditetapkan</span>
                                )}
                            </div>

                            <div>
                                <span className="text-slate-400 block text-[11px] mb-1">Cakupan Wilayah Data (Unit Scope)</span>
                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold border ${scopeInfo.color}`}>
                                    {scopeInfo.label}
                                </span>
                                {user.unit_scope_override && (
                                    <p className="mt-1 text-purple-700 text-[11px]">
                                        * Diatur khusus (override) berbeda dari default peran.
                                    </p>
                                )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-slate-500">Total Izin Efektif</span>
                                <span className="font-bold text-slate-800 text-sm">{totalEffectivePerms} Izin</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Matriks Hak Akses Efektif */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">
                                Matriks Hak Akses Efektif (Effective Permissions)
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Daftar seluruh izin yang dimiliki pengguna, baik yang diwarisi dari Role maupun diberikan sebagai Izin Khusus.
                            </p>
                        </div>

                        {/* Search in permissions */}
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                value={permSearch}
                                onChange={(e) => setPermSearch(e.target.value)}
                                placeholder="Cari izin atau modul..."
                                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                            <svg
                                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
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

                    <div className="p-5">
                        {Object.keys(filteredModules).length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <p className="text-sm font-medium">Tidak ada izin yang sesuai dengan pencarian.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(filteredModules).map(([moduleName, perms]) => (
                                    <div
                                        key={moduleName}
                                        className="rounded-lg border border-slate-200 bg-slate-50/30 p-4 transition hover:border-slate-300"
                                    >
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                                {moduleName}
                                            </h4>
                                            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                                {perms.length}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {perms.map((perm) => {
                                                const isDirect = directPermsSet.has(perm);
                                                return (
                                                    <div
                                                        key={perm}
                                                        className="flex items-center justify-between rounded-md bg-white p-2 text-xs border border-slate-100 shadow-2xs"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                                                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            </div>
                                                            <span className="font-mono text-[11px] text-slate-700 truncate" title={perm}>
                                                                {perm}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            {isDirect ? (
                                                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                                                                    Izin Khusus
                                                                </span>
                                                            ) : (
                                                                <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 border border-blue-200">
                                                                    Dari Role
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
