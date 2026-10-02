import { Pegawai } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

export interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    unit_scope: string;
    permissions: string[];
}

interface UserAccessModalProps {
    isOpen: boolean;
    pegawai: Pegawai | null;
    roles: RoleOption[];
    permissionGroups: Record<string, string[]>;
    onClose: () => void;
}

const PERMISSION_LABELS: Record<string, string> = {
    'dashboard.view': 'Lihat Dashboard',
    'aset.view': 'Lihat Data Aset',
    'aset.create': 'Tambah Aset Baru',
    'aset.update': 'Ubah / Edit Aset',
    'aset.delete': 'Hapus Data Aset',
    'aset.print-label': 'Cetak Label & Barcode QR',
    'import-aset': 'Import Data Aset Excel',
    'export-aset': 'Export Data Aset Excel',
    'scan.view': 'Akses Fitur Scan QR',
    'kategori.view': 'Lihat Kategori Aset',
    'kategori.create': 'Tambah Kategori',
    'kategori.update': 'Ubah Kategori',
    'kategori.delete': 'Hapus Kategori',
    'import-kategori': 'Import Kategori Excel',
    'export-kategori': 'Export Kategori Excel',
    'pegawai.view': 'Lihat Data Pegawai',
    'pegawai.create': 'Tambah Pegawai',
    'pegawai.update': 'Ubah Pegawai',
    'pegawai.delete': 'Hapus Pegawai',
    'pegawai.create-user': 'Buat Akun Pengguna',
    'import-pegawai': 'Import Pegawai Excel',
    'export-pegawai': 'Export Pegawai Excel',
    'penerimaan.view': 'Lihat Dokumen Penerimaan',
    'penerimaan.create': 'Buat Dokumen Penerimaan',
    'penerimaan.update': 'Ubah Dokumen Penerimaan',
    'penerimaan.delete': 'Hapus Dokumen Penerimaan',
    'penerimaan.submit': 'Kirim ke Verifikator / Camat',
    'mutasi.view': 'Lihat Riwayat & Daftar Mutasi',
    'mutasi.create': 'Ajukan Mutasi Aset',
    'permohonan.view': 'Lihat Permohonan Aset',
    'permohonan.create': 'Ajukan Permohonan Aset',
    'permohonan.fulfill': 'Penuhi Permohonan Aset',
    'permohonan.close': 'Tutup / Selesaikan Permohonan',
    'laporan-insiden.view': 'Lihat Laporan Kerusakan / Kehilangan',
    'laporan-insiden.create': 'Buat Laporan Kerusakan / Kehilangan',
    'persetujuan.view': 'Lihat Kotak Persetujuan',
    'persetujuan.act': 'Setujui / Tolak Dokumen Persetujuan',
    'laporan.aset': 'Laporan Rekapitulasi Aset',
    'laporan.mutasi': 'Laporan Rekapitulasi Mutasi',
    'laporan.rusak-hilang': 'Laporan Rekap Rusak & Hilang',
    'pengaturan.alur': 'Pengaturan Alur Persetujuan',
    'pengaturan.role': 'Pengaturan Role & Hak Akses',
    'pengaturan.user': 'Pengaturan Akses Pengguna',
};

function formatPermissionLabel(perm: string): string {
    return (
        PERMISSION_LABELS[perm] ??
        perm.replace(/[-.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
}

export default function UserAccessModal({
    isOpen,
    pegawai,
    roles,
    permissionGroups,
    onClose,
}: UserAccessModalProps) {
    const pageErrors = usePage().props.errors as Record<string, string>;

    const [selectedRole, setSelectedRole] = useState<string>('');
    const [directPermissions, setDirectPermissions] = useState<string[]>([]);
    const [scopeOverride, setScopeOverride] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const activeRoleObj = roles.find((r) => r.name === selectedRole);
    const inheritedPermissions = activeRoleObj?.permissions ?? [];

    useEffect(() => {
        if (!isOpen || !pegawai) return;

        const currentRole = pegawai.user?.roles?.[0]?.name ?? roles[0]?.name ?? '';
        setSelectedRole(currentRole);

        const currentDirectPerms = (pegawai.user?.permissions ?? []).map((p) => p.name);
        setDirectPermissions(currentDirectPerms);

        setScopeOverride(pegawai.user?.unit_scope_override ?? '');
        setErrors({});
    }, [isOpen, pegawai, roles]);

    if (!isOpen || !pegawai || !pegawai.user) return null;

    const toggleDirectPermission = (perm: string) => {
        // If already granted by base role, cannot toggle as direct override
        if (inheritedPermissions.includes(perm)) return;

        setDirectPermissions((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
        );
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setErrors({});

        // Filter direct permissions to only those not in base role
        const cleanDirectPerms = directPermissions.filter(
            (p) => !inheritedPermissions.includes(p),
        );

        router.post(
            route('pegawais.user-access', pegawai.id),
            {
                role: selectedRole,
                direct_permissions: cleanDirectPerms,
                unit_scope_override: scopeOverride || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                },
                onError: (errs) => {
                    setErrors(errs);
                },
                onFinish: () => {
                    setSubmitting(false);
                },
            },
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => !submitting && onClose()}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Kelola Akses Pengguna
                        </h2>
                        <p className="text-xs text-slate-500">
                            Atur peran dasar, cakupan unit, dan izin tambahan untuk {pegawai.nama}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form Body */}
                <form id="user-access-form" onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
                    {/* Pegawai Info Strip */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                                {pegawai.nama.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">{pegawai.nama}</h3>
                                <p className="text-xs text-slate-500">
                                    {pegawai.user.email} · {pegawai.jabatan}
                                </p>
                            </div>
                        </div>
                        <div className="text-right text-xs">
                            <span className="font-semibold text-slate-700">Unit Bertugas:</span>
                            <span className="ml-1 text-slate-600">{pegawai.unit?.name ?? '-'}</span>
                        </div>
                    </div>

                    {/* General Errors */}
                    {(errors.role || errors.direct_permissions || errors.unit_scope_override || pageErrors.error) && (
                        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                            {pageErrors.error || errors.role || errors.direct_permissions || errors.unit_scope_override}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Section 1: Role & Unit Scope Override */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Peran / Role Dasar <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={r.name}>
                                            {r.display_name} ({r.name})
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    Pengguna mewarisi seluruh hak akses bawaan dari role ini.
                                </p>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Override Cakupan Data Unit
                                </label>
                                <select
                                    value={scopeOverride}
                                    onChange={(e) => setScopeOverride(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                >
                                    <option value="">
                                        Sesuai Role Dasar ({activeRoleObj?.unit_scope ?? 'Default'})
                                    </option>
                                    <option value="all">Semua Unit (Akses seluruh kecamatan & kelurahan)</option>
                                    <option value="binaan">Unit & Binaan (Kecamatan + Kelurahan binaan)</option>
                                    <option value="own">Unit Sendiri Saja (Terisolasi di unit sendiri)</option>
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    Biarkan default kecuali jika pengguna memiliki dispensasi wilayah khusus.
                                </p>
                            </div>
                        </div>

                        {/* Section 2: Permissions Matrix & Override */}
                        <div className="border-t border-slate-200 pt-5">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Izin Akses & Override Pengguna Spesial
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Centang izin di bawah untuk memberikan akses ekstra kepada pengguna ini di luar peran dasarnya.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                                        Bawaan Role ({inheritedPermissions.length})
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                                        Ekstra Override ({directPermissions.filter((p) => !inheritedPermissions.includes(p)).length})
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {Object.entries(permissionGroups).map(([groupTitle, perms]) => (
                                    <div
                                        key={groupTitle}
                                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                                    >
                                        <h4 className="mb-2.5 text-xs font-bold text-slate-900">
                                            {groupTitle}
                                        </h4>

                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {perms.map((perm) => {
                                                const isInherited = inheritedPermissions.includes(perm);
                                                const isDirect = directPermissions.includes(perm);
                                                const isChecked = isInherited || isDirect;

                                                return (
                                                    <label
                                                        key={perm}
                                                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition ${
                                                            isInherited
                                                                ? 'cursor-not-allowed border-slate-200 bg-slate-100/75 opacity-80'
                                                                : isDirect
                                                                ? 'cursor-pointer border-blue-300 bg-blue-50/60 ring-1 ring-blue-500/20'
                                                                : 'cursor-pointer border-slate-200 bg-white hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            disabled={isInherited}
                                                            onChange={() => toggleDirectPermission(perm)}
                                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:text-slate-400"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-slate-800">
                                                                    {formatPermissionLabel(perm)}
                                                                </span>
                                                                {isInherited && (
                                                                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-medium text-slate-600">
                                                                        Role
                                                                    </span>
                                                                )}
                                                                {!isInherited && isDirect && (
                                                                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-semibold text-blue-800">
                                                                        Override
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="font-mono text-[10px] text-slate-400">
                                                                {perm}
                                                            </p>
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
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        form="user-access-form"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <svg
                                    className="h-4 w-4 animate-spin text-white"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"
                                    />
                                </svg>
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <span>Simpan Hak Akses</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
