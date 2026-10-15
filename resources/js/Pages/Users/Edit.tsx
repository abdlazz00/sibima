import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { Toggle } from '@/Components/ui/base/toggle/toggle';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { filterPermissionGroups, formatPermissionLabel } from '@/lib/permissions';
import { UNIT_SCOPE_LABEL } from '@/lib/unitScope';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { SearchLg, Trash01 } from '@untitledui/icons';
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

const DEFAULT_SCOPE = 'default';

const SCOPE_CHOICES: { value: string; label: string; hint: string }[] = [
    { value: 'all', label: 'Semua Unit (Kecamatan & Seluruh Kelurahan)', hint: 'Akses lintas seluruh unit kerja di wilayah Sagulung.' },
    { value: 'binaan', label: 'Kecamatan & Kelurahan Binaan', hint: 'Khusus pimpinan kecamatan untuk memantau kelurahan bawahannya.' },
    { value: 'own', label: 'Unit Sendiri Saja', hint: 'Terbatas pada data unit kerja pegawai yang bersangkutan.' },
];

function SectionTitle({ number, children }: { number: number; children: string }) {
    return (
        <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            {number}. {children}
        </h3>
    );
}

export default function Edit({ auth, user, roles, permissionGroups, canResetPassword }: EditProps) {
    const [permSearch, setPermSearch] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    const roleLocked = isSelf && user.role === 'kasubag';
    const errorCount = Object.keys(errors).length;

    // Active role object
    const selectedRole = useMemo(() => {
        return roles.find((r) => r.name === data.role) || roles[0];
    }, [roles, data.role]);

    const defaultScopeLabel = UNIT_SCOPE_LABEL[selectedRole?.unit_scope ?? ''] ?? selectedRole?.unit_scope;

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
        setIsDeleting(true);
        router.delete(route('users.destroy', user.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setConfirmingDelete(false);
            },
        });
    };

    const filteredGroups = filterPermissionGroups(permissionGroups, permSearch);

    return (
        <AuthenticatedLayout>
            <Head title={`Edit Pengguna - ${user.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[
                        { label: 'Manajemen Pengguna', href: route('users.index') },
                        { label: user.name, href: route('users.show', user.id) },
                        { label: 'Edit Akses' },
                    ]}
                    title="Edit Pengguna & Hak Akses"
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Atur peran (role), status akun, kata sandi, cakupan wilayah, dan hak akses khusus untuk{' '}
                    <span className="font-semibold text-slate-800">{user.name}</span>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Profil Pegawai (Read-only) & Pengaturan Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <SectionTitle number={1}>Identitas Akun & Status Login</SectionTitle>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex items-center gap-3">
                                    {user.foto_profile_url ? (
                                        <img src={user.foto_profile_url} alt={user.name} className="size-12 rounded-full border border-slate-200 object-cover" />
                                    ) : (
                                        <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                            {user.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">{user.name}</h4>
                                        <p className="text-xs tabular-nums text-slate-500">
                                            {user.pegawai?.nip ? `NIP: ${user.pegawai.nip}` : 'Pegawai SIBIMA'}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {user.pegawai?.jabatan || 'Jabatan belum diisi'} • {user.unit?.name ?? 'Kecamatan Sagulung'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] text-slate-400">
                                    * Nama dan jabatan pegawai terikat ke modul Data Pegawai untuk menjaga akuntabilitas dokumen.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <Input
                                    label="Email Login"
                                    type="email"
                                    isRequired
                                    value={data.email}
                                    onChange={(v) => setData('email', v)}
                                    isInvalid={Boolean(errors.email)}
                                    hint={errors.email}
                                />

                                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                                    <Toggle
                                        label="Status Aktif Akun"
                                        className="w-full"
                                        isSelected={data.is_active}
                                        isDisabled={isSelf}
                                        onChange={(v) => setData('is_active', v)}
                                        hint={
                                            <span className="text-xs leading-relaxed text-slate-500">
                                                Jika dinonaktifkan, pengguna tidak dapat masuk ke sistem. Sesi yang sedang berjalan akan langsung diputus.
                                                {isSelf && (
                                                    <span className="mt-1 block text-[11px] font-semibold text-amber-600">
                                                        (Anda tidak dapat menonaktifkan akun sendiri)
                                                    </span>
                                                )}
                                            </span>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Reset Kata Sandi (Opsional) */}
                    {canResetPassword && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                            <SectionTitle number={2}>Atur Ulang Kata Sandi (Opsional)</SectionTitle>
                            <p className="-mt-2 mb-4 text-xs text-slate-500">
                                Biarkan kolom kata sandi kosong jika tidak ingin mengubah kata sandi pengguna ini.
                            </p>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="Kata Sandi Baru"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Minimal 8 karakter..."
                                    value={data.password}
                                    onChange={(v) => setData('password', v)}
                                    isInvalid={Boolean(errors.password)}
                                    hint={errors.password}
                                />
                                <Input
                                    label="Konfirmasi Kata Sandi Baru"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Ulangi kata sandi baru..."
                                    value={data.password_confirmation}
                                    onChange={(v) => setData('password_confirmation', v)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Section 3: Penetapan Role & Scope */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <SectionTitle number={3}>Peran Sistem (Role) & Cakupan Wilayah Data</SectionTitle>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-3.5">
                                <Select
                                    label="Pilih Peran (Role)"
                                    isRequired
                                    isDisabled={roleLocked}
                                    items={roles.map((r) => ({ id: r.name, label: `${r.display_name} (${r.name})` }))}
                                    selectedKey={data.role}
                                    onSelectionChange={(key) => setData('role', String(key))}
                                    isInvalid={Boolean(errors.role)}
                                    hint={errors.role ?? (roleLocked ? '* Anda tidak dapat mencabut peran Kasubag dari akun Anda sendiri.' : undefined)}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>

                                {selectedRole && (
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
                                        <span className="block font-semibold text-blue-900">Hak Bawaan Peran: {selectedRole.display_name}</span>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                                            Default Cakupan Wilayah: <span className="font-semibold">{defaultScopeLabel}</span>. Membawa{' '}
                                            <span className="font-semibold tabular-nums">{selectedRole.permissions.length} izin standar</span> yang otomatis aktif di
                                            bawah.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <RadioGroup
                                className="gap-2"
                                value={data.unit_scope_override || DEFAULT_SCOPE}
                                onChange={(v) => setData('unit_scope_override', v === DEFAULT_SCOPE ? '' : (v as 'all' | 'binaan' | 'own'))}
                            >
                                <Label>Cakupan Wilayah Data (Unit Scope Override)</Label>
                                <div className="space-y-2">
                                    {[
                                        {
                                            value: DEFAULT_SCOPE,
                                            label: `Ikuti Default Peran (${defaultScopeLabel})`,
                                            hint: 'Menggunakan cakupan bawaan dari peran yang dipilih.',
                                        },
                                        ...SCOPE_CHOICES,
                                    ].map((choice) => (
                                        <RadioButton
                                            key={choice.value}
                                            value={choice.value}
                                            label={choice.label}
                                            hint={choice.hint}
                                            className="rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 data-selected:border-blue-600 data-selected:bg-blue-50/40"
                                        />
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    {/* Section 4: Matriks Hak Akses Khusus */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">4. Matriks Izin Khusus (Direct Permission Overrides)</h3>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Izin yang telah dimiliki dari peran{' '}
                                    <span className="font-semibold text-blue-700">({selectedRole?.display_name})</span> ditandai aktif otomatis. Anda dapat
                                    mencentang izin tambahan untuk memberikan hak akses istimewa.
                                </p>
                            </div>

                            <div className="w-full sm:w-64">
                                <Input
                                    aria-label="Filter izin atau modul"
                                    size="sm"
                                    icon={SearchLg}
                                    placeholder="Filter izin atau modul..."
                                    value={permSearch}
                                    onChange={setPermSearch}
                                />
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(filteredGroups).map(([groupName, perms]) => (
                                    <div key={groupName} className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
                                        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{groupName}</h4>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {perms.length}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            {perms.map((perm) => {
                                                const fromRole = rolePermissionsSet.has(perm);
                                                const isDirect = data.direct_permissions.includes(perm);

                                                return (
                                                    <Checkbox
                                                        key={perm}
                                                        isSelected={fromRole || isDirect}
                                                        isDisabled={fromRole}
                                                        onChange={() => handlePermissionToggle(perm)}
                                                        className={`w-full rounded-md border p-2 text-xs transition ${
                                                            fromRole
                                                                ? 'border-blue-100 bg-blue-50/50'
                                                                : isDirect
                                                                  ? 'border-emerald-200 bg-emerald-50/60'
                                                                  : 'border-slate-100 bg-white hover:border-slate-200'
                                                        }`}
                                                        hint={
                                                            <span className="font-mono text-[10px] text-slate-400" title={perm}>
                                                                {perm}
                                                            </span>
                                                        }
                                                        label={
                                                            <span className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold">
                                                                    {formatPermissionLabel(perm)}
                                                                </span>
                                                                {fromRole && (
                                                                    <Badge type="color" size="sm" color="blue" className="shrink-0 rounded-sm">
                                                                        Dari Role
                                                                    </Badge>
                                                                )}
                                                                {!fromRole && isDirect && (
                                                                    <Badge type="color" size="sm" color="success" className="shrink-0 rounded-sm">
                                                                        Izin Khusus
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bilah aksi lengket */}
                    <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-slate-600" aria-live="polite">
                                {errorCount > 0 ? (
                                    <span role="alert" className="font-medium text-red-600">
                                        {errorCount} isian perlu diperbaiki
                                    </span>
                                ) : (
                                    <>
                                        <span className="font-semibold tabular-nums text-slate-900">{data.direct_permissions.length}</span> izin khusus dipilih
                                    </>
                                )}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="secondary" size="md" href={route('users.show', user.id)}>
                                    Batal
                                </Button>
                                <Button color="primary" size="md" type="submit" isLoading={processing}>
                                    Simpan Perubahan
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Danger Zone: Hapus Akun Login */}
                {!isSelf && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-rose-900">
                                    <Trash01 className="size-4 text-rose-600" aria-hidden="true" />
                                    Zona Berbahaya: Hapus Kredensial Login
                                </h4>
                                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-rose-800">
                                    Menghapus akun login pengguna ini dari sistem secara permanen. Data pegawai yang terhubung tidak akan terhapus. Jika
                                    pengguna memiliki riwayat tanda tangan persetujuan audit (approval actions), penghapusan akan dicegah secara otomatis demi
                                    keamanan audit trail.
                                </p>
                            </div>

                            <Button color="primary-destructive" size="md" iconLeading={Trash01} className="shrink-0" onPress={() => setConfirmingDelete(true)}>
                                Hapus Akun Login
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {confirmingDelete && (
                <ConfirmDialog
                    title="Hapus Akun Login"
                    confirmLabel="Ya, Hapus Akun"
                    isLoading={isDeleting}
                    onConfirm={handleDeleteAccount}
                    onClose={() => setConfirmingDelete(false)}
                >
                    <p>
                        Apakah Anda yakin ingin menghapus akun login untuk{' '}
                        <strong className="text-slate-900">&quot;{user.name}&quot;</strong> ({user.email})?
                    </p>
                    <p className="mt-2">
                        Akun login akan dihapus, namun data pegawai tetap tersimpan. Jika akun ini memiliki riwayat persetujuan, penghapusan akan ditolak oleh
                        sistem untuk melindungi riwayat audit.
                    </p>
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
