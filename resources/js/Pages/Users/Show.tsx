import PageHeader from '@/Components/PageHeader';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { filterPermissionGroups, formatPermissionLabel } from '@/lib/permissions';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Check, Edit01, SearchLg, Shield01, Users01 } from '@untitledui/icons';
import { ReactNode, useMemo, useState } from 'react';

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
        no_hp: string | null;
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

const SCOPE_INFO: Record<string, { label: string; color: 'blue' | 'purple' | 'success' }> = {
    all: { label: 'Semua Unit Kerja (Kecamatan & Seluruh Kelurahan)', color: 'blue' },
    binaan: { label: 'Kecamatan & Kelurahan Binaan', color: 'purple' },
    own: { label: 'Unit Kerja Sendiri Saja', color: 'success' },
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-800">{children}</span>
        </div>
    );
}

export default function Show({ auth, user, effectivePermissions, can }: ShowProps) {
    const [permSearch, setPermSearch] = useState('');

    const directPermsSet = useMemo(() => {
        return new Set(user.direct_permissions || []);
    }, [user.direct_permissions]);

    const primaryRole = user.roles[0];

    const effectiveScope = user.unit_scope_override || primaryRole?.unit_scope || 'own';
    const scopeInfo = SCOPE_INFO[effectiveScope] ?? SCOPE_INFO.own;

    const totalEffectivePerms = Object.values(effectivePermissions).reduce((acc, perms) => acc + perms.length, 0);

    const filteredModules = filterPermissionGroups(effectivePermissions, permSearch);

    return (
        <AuthenticatedLayout>
            <Head title={`Detail Pengguna - ${user.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Manajemen Pengguna', href: route('users.index') }, { label: user.name }]}
                    title={user.name}
                    badges={
                        <>
                            <BadgeWithDot type="color" size="sm" color={user.is_active ? 'success' : 'error'} className="rounded-sm">
                                {user.is_active ? 'Akun Aktif' : 'Akun Dinonaktifkan'}
                            </BadgeWithDot>
                            {user.id === auth.user?.id && (
                                <Badge type="color" size="sm" color="brand" className="rounded-sm">
                                    Akun Anda
                                </Badge>
                            )}
                        </>
                    }
                    actions={
                        <>
                            <Button color="secondary" size="md" iconLeading={ArrowLeft} href={route('users.index')}>
                                Kembali
                            </Button>
                            {can.manageAccess && (
                                <Button color="primary-green" size="md" iconLeading={Edit01} href={route('users.edit', user.id)}>
                                    Edit Hak Akses
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Top Info Cards Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Card 1: Identitas Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-4">
                            {user.foto_profile_url ? (
                                <img
                                    src={user.foto_profile_url}
                                    alt={user.name}
                                    className="size-16 shrink-0 rounded-full border-2 border-slate-200 object-cover"
                                />
                            ) : (
                                <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-100 text-lg font-bold text-blue-700">
                                    {getInitials(user.name)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="truncate text-base font-bold text-slate-900">{user.name}</h3>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                                <Badge type="color" size="sm" color="gray" className="mt-2 rounded-sm">
                                    {user.unit?.name ?? 'Unit tidak ditetapkan'}
                                </Badge>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                            <InfoLine label="ID Pengguna">
                                <span className="font-semibold tabular-nums">#{user.id}</span>
                            </InfoLine>
                            <InfoLine label="Terdaftar Pada">{user.created_at}</InfoLine>
                            <InfoLine label="Foto Profil">{user.foto_profile_url ? 'Dari Data Pegawai' : 'Inisial Standar'}</InfoLine>
                        </div>
                    </div>

                    {/* Card 2: Kaitan Data Pegawai */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                                    <Users01 className="size-4" aria-hidden="true" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Data Pegawai Terkait</h3>
                            </div>
                            {user.pegawai && (
                                <Link href={route('pegawais.show', user.pegawai.id)} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                                    Lihat Pegawai &rarr;
                                </Link>
                            )}
                        </div>

                        {user.pegawai ? (
                            <div className="mt-4 space-y-2.5 text-xs">
                                <div>
                                    <span className="block text-[11px] text-slate-400">Nama Lengkap Pegawai</span>
                                    <span className="text-sm font-semibold text-slate-800">{user.pegawai.nama}</span>
                                </div>
                                <InfoLine label="NIP">
                                    <span className="tabular-nums">{user.pegawai.nip || '-'}</span>
                                </InfoLine>
                                <InfoLine label="Jabatan">{user.pegawai.jabatan}</InfoLine>
                                <InfoLine label="Unit Kerja">{user.pegawai.unit_nama || '-'}</InfoLine>
                                <InfoLine label="No. Telepon / HP">{user.pegawai.no_hp || '-'}</InfoLine>
                            </div>
                        ) : (
                            <div className="mt-6 py-4 text-center text-xs text-slate-400">
                                Tidak ada data pegawai yang terhubung langsung dengan akun ini.
                            </div>
                        )}
                    </div>

                    {/* Card 3: Peran & Cakupan Wilayah */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                <Shield01 className="size-4" aria-hidden="true" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">Peran & Cakupan Wilayah</h3>
                        </div>

                        <div className="mt-4 space-y-3.5 text-xs">
                            <div>
                                <span className="mb-1 block text-[11px] text-slate-400">Peran Utama (Role)</span>
                                {primaryRole ? (
                                    <div>
                                        <Badge type="color" size="md" color="blue" className="rounded-sm font-bold">
                                            {primaryRole.display_name}
                                        </Badge>
                                        {primaryRole.description && (
                                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{primaryRole.description}</p>
                                        )}
                                    </div>
                                ) : (
                                    <span className="italic text-slate-400">Belum ada peran yang ditetapkan</span>
                                )}
                            </div>

                            <div>
                                <span className="mb-1 block text-[11px] text-slate-400">Cakupan Wilayah Data (Unit Scope)</span>
                                <Badge type="color" size="md" color={scopeInfo.color} className="h-auto rounded-sm whitespace-normal text-left">
                                    {scopeInfo.label}
                                </Badge>
                                {user.unit_scope_override && (
                                    <p className="mt-1 text-[11px] text-purple-700">* Diatur khusus (override) berbeda dari default peran.</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                <span className="text-slate-500">Total Izin Efektif</span>
                                <span className="text-sm font-bold tabular-nums text-slate-800">{totalEffectivePerms} Izin</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Matriks Hak Akses Efektif */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Matriks Hak Akses Efektif (Effective Permissions)</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Daftar seluruh izin yang dimiliki pengguna, baik yang diwarisi dari Role maupun diberikan sebagai Izin Khusus.
                            </p>
                        </div>

                        <div className="w-full sm:w-64">
                            <Input
                                aria-label="Cari izin atau modul"
                                size="sm"
                                icon={SearchLg}
                                placeholder="Cari izin atau modul..."
                                value={permSearch}
                                onChange={setPermSearch}
                            />
                        </div>
                    </div>

                    <div className="p-5">
                        {Object.keys(filteredModules).length === 0 ? (
                            <div className="py-10 text-center text-slate-400">
                                <p className="text-sm font-medium">Tidak ada izin yang sesuai dengan pencarian.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(filteredModules).map(([moduleName, perms]) => (
                                    <div key={moduleName} className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
                                        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{moduleName}</h4>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {perms.length}
                                            </Badge>
                                        </div>

                                        <ul className="space-y-2">
                                            {perms.map((perm) => (
                                                <li
                                                    key={perm}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white p-2 text-xs shadow-xs"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                                            <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block text-xs font-semibold text-slate-800">{formatPermissionLabel(perm)}</span>
                                                            <span className="block truncate font-mono text-[10px] text-slate-400" title={perm}>
                                                                {perm}
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        type="color"
                                                        size="sm"
                                                        color={directPermsSet.has(perm) ? 'success' : 'blue'}
                                                        className="shrink-0 rounded-sm"
                                                    >
                                                        {directPermsSet.has(perm) ? 'Izin Khusus' : 'Dari Role'}
                                                    </Badge>
                                                </li>
                                            ))}
                                        </ul>
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
