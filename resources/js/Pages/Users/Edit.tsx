import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import React, { useMemo, useState } from 'react';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    unit_scope: string;
    permissions: string[];
}

interface UserEditData {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    role: string;
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
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
}

interface EditProps extends PageProps {
    user: UserEditData;
    roles: RoleOption[];
    permissionGroups: Record<string, string[]>;
    units: { id: number; name: string; type: string }[];
    canResetPassword: boolean;
}

export default function Edit({ auth, user, roles, permissionGroups, canResetPassword }: EditProps) {
    const [permSearch, setPermSearch] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        email: user.email,
        password: '',
        password_confirmation: '',
        is_active: user.is_active,
        role: user.role || (roles[0]?.name ?? ''),
        direct_permissions: user.direct_permissions || [],
        unit_scope_override: user.unit_scope_override || '',
    });

    const isSelf = user.id === auth.user?.id;

    // Active role object
    const selectedRole = useMemo(() => {
        return roles.find((r) => r.name === data.role) || roles[0];
    }, [roles, data.role]);

    // Permissions belonging to the selected role
    const rolePermissionsSet = useMemo(() => {
        return new Set(selectedRole?.permissions || []);
    }, [selectedRole]);

    const handlePermissionToggle = (perm: string) => {
        // If this permission is already in the selected role, don't toggle
        if (rolePermissionsSet.has(perm)) return;

        const current = [...data.direct_permissions];
        const index = current.indexOf(perm);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(perm);
        }
        setData('direct_permissions', current);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id), {
            preserveScroll: true,
        });
    };

    const handleDeleteAccount = () => {
        if (isSelf) {
            alert('Anda tidak dapat menghapus akun Anda sendiri.');
            return;
        }

        const confirmMsg =
            `PERINGATAN: Apakah Anda yakin ingin menghapus akun login untuk "${user.name}" (${user.email})?\n\n` +
            `Akun login akan dihapus, namun data pegawai tetap tersimpan.\n` +
            `Jika akun ini memiliki riwayat persetujuan, penghapusan akan ditolak oleh sistem untuk melindungi riwayat audit.`;

        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        router.delete(route('users.destroy', user.id), {
            preserveScroll: true,
            onFinish: () => setIsDeleting(false),
        });
    };

    // Filtered permission groups
    const filteredGroups = useMemo(() => {
        if (!permSearch) return permissionGroups;
        const query = permSearch.toLowerCase();
        const result: Record<string, string[]> = {};

        Object.entries(permissionGroups).forEach(([groupName, perms]) => {
            const matchesGroup = groupName.toLowerCase().includes(query);
            const matchesPerms = perms.filter((p) => p.toLowerCase().includes(query));

            if (matchesGroup) {
                result[groupName] = perms;
            } else if (matchesPerms.length > 0) {
                result[groupName] = matchesPerms;
            }
        });

        return result;
    }, [permissionGroups, permSearch]);

    return (
        <AuthenticatedLayout>
            <Head title={`Edit Pengguna - ${user.name}`} />

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
                            <Link href={route('users.show', user.id)} className="hover:text-blue-700">
                                {user.name}
                            </Link>
                            <span>/</span>
                            <span className="font-medium text-slate-700">Edit Akses</span>
                        </nav>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            Edit Pengguna & Hak Akses
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Atur peran (role), status akun, kata sandi, cakupan wilayah, dan hak akses khusus untuk{' '}
                            <span className="font-semibold text-slate-800">{user.name}</span>.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link
                            href={route('users.show', user.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none"
                        >
                            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                            Kembali ke Detail
                        </Link>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Profil Pegawai (Read-only) & Pengaturan Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            1. Identitas Akun & Status Login
                        </h3>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {/* Read-only Pegawai Identity */}
                            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex items-center gap-3">
                                    {user.foto_profile_url ? (
                                        <img
                                            src={user.foto_profile_url}
                                            alt={user.name}
                                            className="h-12 w-12 rounded-full object-cover border border-slate-200"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                            {user.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">{user.name}</h4>
                                        <p className="text-xs text-slate-500">
                                            {user.pegawai?.nip ? `NIP: ${user.pegawai.nip}` : 'Pegawai SIBIMA'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {user.pegawai?.jabatan || 'Jabatan belum diisi'} • {user.unit?.name ?? 'Kecamatan Sagulung'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
                                    * Nama dan jabatan pegawai terikat ke modul Data Pegawai untuk menjaga akuntabilitas dokumen.
                                </p>
                            </div>

                            {/* Email Login & Status Switch */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Email Login <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                        required
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
                                    )}
                                </div>

                                {/* Active Toggle */}
                                <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-start justify-between gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-800 block">
                                            Status Aktif Akun
                                        </label>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            Jika dinonaktifkan, pengguna tidak dapat masuk ke sistem. Sesi yang sedang berjalan akan langsung diputus.
                                        </p>
                                        {isSelf && (
                                            <p className="text-[11px] text-amber-600 font-semibold mt-1">
                                                (Anda tidak dapat menonaktifkan akun sendiri)
                                            </p>
                                        )}
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={data.is_active}
                                            disabled={isSelf}
                                            onChange={(e) => setData('is_active', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Reset Kata Sandi (Opsional) */}
                    {canResetPassword && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            2. Atur Ulang Kata Sandi (Opsional)
                        </h3>
                        <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">
                            Biarkan kolom kata sandi kosong jika tidak ingin mengubah kata sandi pengguna ini.
                        </p>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Kata Sandi Baru
                                </label>
                                <input
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="Minimal 8 karakter..."
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                />
                                {errors.password && (
                                    <p className="mt-1 text-xs text-rose-600">{errors.password}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Konfirmasi Kata Sandi Baru
                                </label>
                                <input
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    placeholder="Ulangi kata sandi baru..."
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Section 3: Penetapan Role & Scope */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            3. Peran Sistem (Role) & Cakupan Wilayah Data
                        </h3>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Role Select */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Pilih Peran (Role) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={data.role}
                                    onChange={(e) => setData('role', e.target.value)}
                                    disabled={isSelf && user.role === 'kasubag'}
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={r.name}>
                                            {r.display_name} ({r.name})
                                        </option>
                                    ))}
                                </select>
                                {isSelf && user.role === 'kasubag' && (
                                    <p className="mt-1 text-xs text-amber-600 font-medium">
                                        * Anda tidak dapat mencabut peran Kasubag dari akun Anda sendiri.
                                    </p>
                                )}
                                {errors.role && <p className="mt-1 text-xs text-rose-600">{errors.role}</p>}

                                {/* Selected Role Summary */}
                                {selectedRole && (
                                    <div className="mt-3.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
                                        <span className="font-semibold text-blue-900 block">
                                            Hak Bawaan Peran: {selectedRole.display_name}
                                        </span>
                                        <p className="text-blue-800 text-[11px] mt-0.5 leading-relaxed">
                                            Default Cakupan Wilayah: <span className="font-semibold">{selectedRole.unit_scope}</span>. Membawa{' '}
                                            <span className="font-semibold">{selectedRole.permissions.length} izin standar</span> yang otomatis aktif di bawah.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Unit Scope Override */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Cakupan Wilayah Data (Unit Scope Override)
                                </label>
                                <div className="space-y-2 text-xs">
                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="unit_scope_override"
                                            value=""
                                            checked={data.unit_scope_override === '' || data.unit_scope_override === null}
                                            onChange={() => setData('unit_scope_override', '')}
                                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 block">
                                                Ikuti Default Peran ({selectedRole?.unit_scope})
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                Menggunakan cakupan bawaan dari peran yang dipilih.
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="unit_scope_override"
                                            value="all"
                                            checked={data.unit_scope_override === 'all'}
                                            onChange={() => setData('unit_scope_override', 'all')}
                                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 block">
                                                Semua Unit (Kecamatan & Seluruh Kelurahan)
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                Akses lintas seluruh unit kerja di wilayah Sagulung.
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="unit_scope_override"
                                            value="binaan"
                                            checked={data.unit_scope_override === 'binaan'}
                                            onChange={() => setData('unit_scope_override', 'binaan')}
                                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 block">
                                                Kecamatan & Kelurahan Binaan
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                Khusus pimpinan kecamatan untuk memantau kelurahan bawahannya.
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="unit_scope_override"
                                            value="own"
                                            checked={data.unit_scope_override === 'own'}
                                            onChange={() => setData('unit_scope_override', 'own')}
                                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 block">
                                                Unit Sendiri Saja
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                Terbatas pada data unit kerja pegawai yang bersangkutan.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Matriks Hak Akses Khusus */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 11 12 14 22 4" />
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                    </svg>
                                    4. Matriks Izin Khusus (Direct Permission Overrides)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Izin yang telah dimiliki dari peran <span className="font-semibold text-blue-700">({selectedRole?.display_name})</span> ditandai aktif otomatis. Anda dapat mencentang izin tambahan untuk memberikan hak akses istimewa.
                                </p>
                            </div>

                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    value={permSearch}
                                    onChange={(e) => setPermSearch(e.target.value)}
                                    placeholder="Filter izin atau modul..."
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(filteredGroups).map(([groupName, perms]) => (
                                    <div
                                        key={groupName}
                                        className="rounded-lg border border-slate-200 bg-slate-50/30 p-4 transition hover:border-slate-300"
                                    >
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                                {groupName}
                                            </h4>
                                            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                                {perms.length}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {perms.map((perm) => {
                                                const fromRole = rolePermissionsSet.has(perm);
                                                const isDirect = data.direct_permissions.includes(perm);

                                                return (
                                                    <label
                                                        key={perm}
                                                        className={`flex items-center justify-between rounded-md p-2 text-xs border transition ${
                                                            fromRole
                                                                ? 'bg-blue-50/50 border-blue-100 cursor-not-allowed text-blue-900'
                                                                : isDirect
                                                                ? 'bg-emerald-50/60 border-emerald-200 cursor-pointer text-emerald-900'
                                                                : 'bg-white border-slate-100 hover:border-slate-200 cursor-pointer text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={fromRole || isDirect}
                                                                disabled={fromRole}
                                                                onChange={() => handlePermissionToggle(perm)}
                                                                className={`h-4 w-4 rounded border-slate-300 ${
                                                                    fromRole
                                                                        ? 'text-blue-600 focus:ring-0 cursor-not-allowed opacity-80'
                                                                        : 'text-emerald-600 focus:ring-emerald-500'
                                                                }`}
                                                            />
                                                            <span className="font-mono text-[11px] truncate" title={perm}>
                                                                {perm}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            {fromRole ? (
                                                                <span className="shrink-0 rounded bg-blue-100/70 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 border border-blue-200">
                                                                    Dari Role
                                                                </span>
                                                            ) : isDirect ? (
                                                                <span className="shrink-0 rounded bg-emerald-100/80 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-300">
                                                                    Izin Khusus
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                        <Link
                            href={route('users.show', user.id)}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                        >
                            Batal
                        </Link>

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Menyimpan Perubahan...
                                </>
                            ) : (
                                <>
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    Simpan Perubahan
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Danger Zone: Hapus Akun Login */}
                {!isSelf && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                                    <svg className="h-4 w-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    </svg>
                                    Zona Berbahaya: Hapus Kredensial Login
                                </h4>
                                <p className="text-xs text-rose-800 mt-1 max-w-2xl leading-relaxed">
                                    Menghapus akun login pengguna ini dari sistem secara permanen. Data pegawai yang terhubung tidak akan terhapus. Jika pengguna memiliki riwayat tanda tangan persetujuan audit (approval actions), penghapusan akan dicegah secara otomatis demi keamanan audit trail.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 focus:outline-none transition shrink-0"
                            >
                                <svg className="h-3.5 w-3.5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                                Hapus Akun Login
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
