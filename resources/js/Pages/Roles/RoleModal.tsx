import { RoleItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

interface RoleModalProps {
    isOpen: boolean;
    role: RoleItem | null;
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

export default function RoleModal({
    isOpen,
    role,
    permissionGroups,
    onClose,
}: RoleModalProps) {
    const pageErrors = usePage().props.errors as Record<string, string>;

    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [unitScope, setUnitScope] = useState<'all' | 'binaan' | 'own'>('own');
    const [unitHeadOf, setUnitHeadOf] = useState<'' | 'kecamatan' | 'kelurahan'>('');
    const [description, setDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isEdit = Boolean(role);
    const isSystemRole = Boolean(role?.is_system);

    const allPermissions = Object.values(permissionGroups).flat();

    useEffect(() => {
        if (!isOpen) return;

        if (role) {
            setName(role.name);
            setDisplayName(role.display_name);
            setUnitScope(role.unit_scope);
            setUnitHeadOf(role.unit_head_of ?? '');
            setDescription(role.description ?? '');
            setSelectedPermissions(role.permissions ?? []);
        } else {
            setName('');
            setDisplayName('');
            setUnitScope('own');
            setUnitHeadOf('');
            setDescription('');
            setSelectedPermissions([]);
        }
        setErrors({});
    }, [isOpen, role]);

    if (!isOpen) return null;

    const togglePermission = (perm: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
        );
    };

    const toggleGroup = (perms: string[]) => {
        const allSelected = perms.every((p) => selectedPermissions.includes(p));
        if (allSelected) {
            setSelectedPermissions((prev) =>
                prev.filter((p) => !perms.includes(p)),
            );
        } else {
            setSelectedPermissions((prev) => [
                ...prev,
                ...perms.filter((p) => !prev.includes(p)),
            ]);
        }
    };

    const selectAll = () => {
        setSelectedPermissions([...allPermissions]);
    };

    const deselectAll = () => {
        setSelectedPermissions([]);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setErrors({});

        const payload = {
            name,
            display_name: displayName,
            unit_scope: unitScope,
            unit_head_of: unitHeadOf || null,
            description: description.trim() || null,
            permissions: selectedPermissions,
        };

        if (isEdit && role) {
            router.put(route('roles.update', role.id), payload, {
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
            });
        } else {
            router.post(route('roles.store'), payload, {
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
            });
        }
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
                            {isEdit ? `Edit Role: ${role?.display_name}` : 'Tambah Role Baru'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {isEdit
                                ? 'Sesuaikan nama, cakupan data unit, dan izin akses untuk role ini.'
                                : 'Definisikan role baru beserta hak akses granular modul aplikasi.'}
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

                {/* Body Form */}
                <form id="role-form" onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
                    {/* General Errors */}
                    {(errors.name || errors.display_name || errors.unit_scope || pageErrors.error) && (
                        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                            {pageErrors.error || errors.name || errors.display_name || errors.unit_scope}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Section 1: Role Identity */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Display Name (Nama Tampilan) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Contoh: Auditor Aset Wilayah"
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                />
                                {errors.display_name && (
                                    <p className="mt-1 text-xs text-red-600">{errors.display_name}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Technical Name (Identifier Sistem) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                                    placeholder="contoh: auditor_aset"
                                    required
                                    disabled={isSystemRole}
                                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                />
                                {isSystemRole ? (
                                    <p className="mt-1 text-[11px] text-amber-600 font-medium">
                                        Nama teknis role sistem terproteksi dan tidak dapat diubah.
                                    </p>
                                ) : (
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        Huruf kecil, angka, garis bawah (underscore).
                                    </p>
                                )}
                                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                            </div>
                        </div>

                        {/* Section 2: Unit Scope */}
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                Cakupan Data Unit (Unit Scope) <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <label
                                    className={`relative flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
                                        unitScope === 'all'
                                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="unit_scope"
                                            value="all"
                                            checked={unitScope === 'all'}
                                            onChange={() => setUnitScope('all')}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-slate-900">Semua Unit (All)</span>
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-slate-500">
                                        Dapat mengakses seluruh data aset di semua unit kecamatan dan seluruh kelurahan.
                                    </p>
                                </label>

                                <label
                                    className={`relative flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
                                        unitScope === 'binaan'
                                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="unit_scope"
                                            value="binaan"
                                            checked={unitScope === 'binaan'}
                                            onChange={() => setUnitScope('binaan')}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-slate-900">Unit & Binaan</span>
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-slate-500">
                                        Dapat mengakses unit induk sendiri dan seluruh kelurahan binaannya (contoh: Camat).
                                    </p>
                                </label>

                                <label
                                    className={`relative flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
                                        unitScope === 'own'
                                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="unit_scope"
                                            value="own"
                                            checked={unitScope === 'own'}
                                            onChange={() => setUnitScope('own')}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-slate-900">Unit Sendiri Saja</span>
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-slate-500">
                                        Terisolasi hanya pada data aset milik unit tempat pengguna bertugas.
                                    </p>
                                </label>
                            </div>
                        </div>

                        {/* Pimpinan Unit */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Pimpinan Unit (untuk langkah &quot;Atasan Unit&quot;)
                            </label>
                            <select
                                value={unitHeadOf}
                                onChange={(e) => setUnitHeadOf(e.target.value as '' | 'kecamatan' | 'kelurahan')}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                                <option value="">Bukan pimpinan unit</option>
                                <option value="kecamatan">Pimpinan Kecamatan</option>
                                <option value="kelurahan">Pimpinan Kelurahan</option>
                            </select>
                            {errors.unit_head_of && <p className="mt-1 text-xs text-red-600">{errors.unit_head_of}</p>}
                            <p className="mt-1 text-[11px] text-slate-500">
                                Role ini menjadi atasan otomatis bagi pengajuan dari unit sejenis.
                            </p>
                        </div>

                        {/* Section 3: Description */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-700">
                                Deskripsi / Catatan Tambahan
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="Jelaskan tujuan atau fungsi peran ini dalam tata kelola aset..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                        </div>

                        {/* Section 4: Permission Matrix */}
                        <div className="border-t border-slate-200 pt-5">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Matriks Hak Akses & Izin (Permissions)
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {selectedPermissions.length} dari {allPermissions.length} izin dipilih.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Pilih Semua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAll}
                                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Batal Semua
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {Object.entries(permissionGroups).map(([groupTitle, perms]) => {
                                    const groupSelectedCount = perms.filter((p) =>
                                        selectedPermissions.includes(p),
                                    ).length;
                                    const isGroupAllSelected = groupSelectedCount === perms.length;

                                    return (
                                        <div
                                            key={groupTitle}
                                            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                                        >
                                            <div className="mb-2.5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-900">
                                                        {groupTitle}
                                                    </span>
                                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                                        {groupSelectedCount} / {perms.length}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(perms)}
                                                    className="text-xs font-medium text-blue-700 hover:underline"
                                                >
                                                    {isGroupAllSelected ? 'Batal Grup' : 'Pilih Grup'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                {perms.map((perm) => {
                                                    const isChecked = selectedPermissions.includes(perm);
                                                    return (
                                                        <label
                                                            key={perm}
                                                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition ${
                                                                isChecked
                                                                    ? 'border-blue-200 bg-blue-50/40'
                                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => togglePermission(perm)}
                                                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-slate-800">
                                                                    {formatPermissionLabel(perm)}
                                                                </p>
                                                                <p className="font-mono text-[10px] text-slate-400">
                                                                    {perm}
                                                                </p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
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
                        form="role-form"
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
                            <span>{isEdit ? 'Perbarui Role' : 'Simpan Role'}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
