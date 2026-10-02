import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, RoleItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import RoleModal from './RoleModal';

interface IndexProps extends PageProps {
    roles: RoleItem[];
    permissionGroups: Record<string, string[]>;
}

export default function Index({ roles, permissionGroups }: IndexProps) {
    const { flash } = usePage<PageProps>().props;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
    const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCreate = () => {
        setEditingRole(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: RoleItem) => {
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const confirmDelete = (role: RoleItem) => {
        if (role.is_system || role.users_count > 0) return;
        setDeletingRole(role);
    };

    const executeDelete = () => {
        if (!deletingRole || isDeleting) return;

        setIsDeleting(true);
        router.delete(route('roles.destroy', deletingRole.id), {
            preserveScroll: true,
            onSuccess: () => {
                setDeletingRole(null);
            },
            onFinish: () => {
                setIsDeleting(false);
            },
        });
    };

    const getScopeBadge = (scope: string) => {
        switch (scope) {
            case 'all':
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        Semua Unit
                    </span>
                );
            case 'binaan':
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-700/10">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Unit & Binaan
                    </span>
                );
            case 'own':
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M9 3v18" />
                        </svg>
                        Unit Sendiri
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Role & Hak Akses" />

            <div className="space-y-6">
                {/* Header & Breadcrumb */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Home
                            </Link>
                            <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                            <span className="text-slate-500">Pengaturan</span>
                            <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                            <span className="font-medium text-slate-800">Pengaturan Role</span>
                        </nav>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Manajemen Role & Hak Akses
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Kelola peran pengguna, cakupan data unit, dan matriks izin akses aplikasi.
                        </p>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Tambah Role Baru</span>
                        </button>
                    </div>
                </div>

                {/* Flash Notifications */}
                {flash?.success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-xs">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-xs">
                        {flash.error}
                    </div>
                )}

                {/* Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/75">
                                    <th className="py-3.5 pl-6 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Peran / Role
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Cakupan Data
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Tipe Role
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Pengguna
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Hak Akses
                                    </th>
                                    <th className="py-3.5 pl-4 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {roles.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            Belum ada role terdaftar.
                                        </td>
                                    </tr>
                                ) : (
                                    roles.map((r) => {
                                        const isSystem = r.is_system;
                                        const hasActiveUsers = r.users_count > 0;
                                        const deleteDisabled = isSystem || hasActiveUsers;
                                        const deleteTooltip = isSystem
                                            ? 'Role sistem terproteksi tidak boleh dihapus.'
                                            : hasActiveUsers
                                            ? `Role ini masih digunakan oleh ${r.users_count} pengguna aktif.`
                                            : 'Hapus role ini';

                                        return (
                                            <tr key={r.id} className="transition hover:bg-slate-50/60">
                                                <td className="py-4 pl-6 pr-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900">
                                                            {r.display_name}
                                                        </span>
                                                        <span className="font-mono text-xs text-slate-400">
                                                            {r.name}
                                                        </span>
                                                        {r.description && (
                                                            <span className="mt-1 line-clamp-1 text-xs text-slate-500">
                                                                {r.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {getScopeBadge(r.unit_scope)}
                                                </td>

                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {isSystem ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                                            <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                            </svg>
                                                            Sistem
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-700/10">
                                                            <svg className="h-3 w-3 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                            </svg>
                                                            Kustom
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                                                        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                            <circle cx="9" cy="7" r="4" />
                                                        </svg>
                                                        {r.users_count} Pengguna
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                                                        {r.permissions_count} Izin
                                                    </span>
                                                </td>

                                                <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(r)}
                                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => confirmDelete(r)}
                                                            disabled={deleteDisabled}
                                                            title={deleteTooltip}
                                                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                                                deleteDisabled
                                                                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                                                                    : 'border-red-200 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1'
                                                            }`}
                                                        >
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Tambah / Edit Role */}
            <RoleModal
                isOpen={isModalOpen}
                role={editingRole}
                permissionGroups={permissionGroups}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingRole(null);
                }}
            />

            {/* Modal Konfirmasi Hapus */}
            {deletingRole && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
                    onClick={() => !isDeleting && setDeletingRole(null)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 text-red-600">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Role</h3>
                                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
                            </div>
                        </div>

                        <p className="mt-4 text-sm text-slate-600">
                            Apakah Anda yakin ingin menghapus role{' '}
                            <span className="font-bold text-slate-900">{deletingRole.display_name}</span>?
                        </p>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingRole(null)}
                                disabled={isDeleting}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={executeDelete}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {isDeleting ? 'Menghapus...' : 'Hapus Sekarang'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
