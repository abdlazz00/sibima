import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { UNIT_SCOPE_LABEL } from '@/lib/unitScope';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Eye, InfoCircle, SearchLg, Users01, XClose } from '@untitledui/icons';
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
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
}

interface PaginatedUsers {
    data: UserListItem[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
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

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua Status' },
    { id: 'active', label: 'Aktif' },
    { id: 'inactive', label: 'Nonaktif' },
];

const ROLE_BADGE_COLOR: Record<string, 'warning' | 'blue' | 'indigo' | 'purple' | 'sky'> = {
    kasubag: 'warning',
    camat: 'blue',
    admin_kecamatan: 'indigo',
    admin_kelurahan: 'purple',
    lurah: 'sky',
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function Index({ auth, users, roles, units, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || '');
    const [unitId, setUnitId] = useState(filters.unit_id || '');
    const [status, setStatus] = useState(filters.status || '');
    const [updating, setUpdating] = useState(false);
    const [statusTarget, setStatusTarget] = useState<UserListItem | null>(null);

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

    const goToPage = (page: number) => {
        router.get(route('users.index'), { ...filters, page }, { preserveState: true, preserveScroll: true });
    };

    const changePageSize = (per_page: number) => {
        router.get(route('users.index'), { ...filters, per_page, page: undefined }, { preserveState: true, preserveScroll: true });
    };

    const confirmToggleStatus = () => {
        if (!statusTarget) return;

        setUpdating(true);
        router.patch(
            route('users.toggle-status', statusTarget.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setUpdating(false);
                    setStatusTarget(null);
                },
            },
        );
    };

    const hasActiveFilter = Boolean(search || role || unitId || status);

    const roleItems = [{ id: ALL, label: 'Semua Peran' }, ...roles.map((r) => ({ id: r.name, label: r.display_name }))];
    const unitItems = [{ id: ALL, label: 'Semua Unit' }, ...units.map((u) => ({ id: String(u.id), label: u.name }))];

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Pengguna - SIBIMA" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Manajemen Pengguna' }]}
                    title="Manajemen Pengguna & Hak Akses"
                    actions={
                        <Button color="primary-sky" size="md" iconLeading={Users01} href={route('pegawais.index')}>
                            Buka Data Pegawai
                        </Button>
                    }
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Kelola akun pengguna, penetapan peran (role), cakupan unit kerja, dan hak akses sistem.
                </p>

                {/* Info Card: Account Creation Policy */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-800 text-white shadow-xs">
                            <InfoCircle className="size-5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 text-sm">
                            <h4 className="font-semibold text-blue-900">Integritas Akun & Data Pegawai</h4>
                            <p className="mt-0.5 leading-relaxed text-blue-800">
                                Setiap akun login di SIBIMA terhubung 1-to-1 dengan data pegawai untuk menjamin akuntabilitas tanda tangan berita acara dan
                                riwayat audit. Pembuatan akun baru dilakukan langsung dari menu{' '}
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
                        <div className="flex items-end gap-2 lg:col-span-2">
                            <div className="flex-1">
                                <Input
                                    label="Cari Pengguna"
                                    size="md"
                                    icon={SearchLg}
                                    placeholder="Cari nama, email, NIP..."
                                    value={search}
                                    onChange={setSearch}
                                />
                            </div>
                            <Button type="submit" color="primary-sky" size="md">
                                Cari
                            </Button>
                        </div>

                        <Select
                            label="Unit Kerja"
                            size="md"
                            items={unitItems}
                            selectedKey={unitId || ALL}
                            onSelectionChange={(key) => {
                                const value = key === ALL ? '' : String(key);
                                setUnitId(value);
                                applyFilter({ unit_id: value });
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>

                        <Select
                            label="Peran (Role)"
                            size="md"
                            items={roleItems}
                            selectedKey={role || ALL}
                            onSelectionChange={(key) => {
                                const value = key === ALL ? '' : String(key);
                                setRole(value);
                                applyFilter({ role: value });
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>

                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Select
                                    label="Status"
                                    size="md"
                                    items={STATUS_ITEMS}
                                    selectedKey={status || ALL}
                                    onSelectionChange={(key) => {
                                        const value = key === ALL ? '' : String(key);
                                        setStatus(value);
                                        applyFilter({ status: value });
                                    }}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>
                            </div>
                            {hasActiveFilter && (
                                <Button
                                    color="secondary"
                                    size="md"
                                    iconLeading={XClose}
                                    aria-label="Hapus semua filter"
                                    onPress={handleResetFilters}
                                />
                            )}
                        </div>
                    </form>
                </div>

                {/* Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Daftar Pengguna (<span className="tabular-nums">{users.total}</span>)
                    </div>

                    <Table aria-label="Daftar pengguna" size="sm">
                        <Table.Header>
                            <Table.Head id="pengguna" label="Pengguna" isRowHeader />
                            <Table.Head id="unit" label="Unit Kerja" />
                            <Table.Head id="peran" label="Peran, Cakupan & Izin" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={users.data}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-2 py-12 text-center">
                                    <p className="font-medium text-slate-600">Tidak ada pengguna ditemukan</p>
                                    <p className="text-xs text-slate-400">Coba sesuaikan kata kunci pencarian atau filter yang dipilih.</p>
                                    {hasActiveFilter && (
                                        <Button color="secondary" size="sm" className="mt-2" onPress={handleResetFilters}>
                                            Hapus semua filter
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(user) => (
                                <Table.Row id={user.id}>
                                    <Table.Cell>
                                        <div className="flex items-center gap-3">
                                            {user.foto_profile_url ? (
                                                <img
                                                    src={user.foto_profile_url}
                                                    alt=""
                                                    className="size-10 shrink-0 rounded-full border border-slate-200 object-cover"
                                                />
                                            ) : (
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-bold text-blue-700">
                                                    {getInitials(user.name)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={route('users.show', user.id)}
                                                        className="truncate font-semibold text-slate-900 hover:text-blue-700"
                                                    >
                                                        {user.name}
                                                    </Link>
                                                    {user.id === auth.user?.id && (
                                                        <Badge type="color" size="sm" color="brand" className="rounded-sm">
                                                            Anda
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="truncate text-xs text-slate-500">{user.email}</p>
                                                {user.pegawai && (
                                                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-400">
                                                        {user.pegawai.nip ? `NIP: ${user.pegawai.nip}` : user.pegawai.jabatan}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-slate-700">
                                        {user.unit?.name ?? 'Tidak Terikat Unit'}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {user.roles.length > 0 ? (
                                                user.roles.map((r) => (
                                                    <Badge key={r.id} type="color" size="sm" color={ROLE_BADGE_COLOR[r.name] ?? 'gray'} className="rounded-sm">
                                                        {r.display_name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-xs italic text-slate-400">Belum ada role</span>
                                            )}
                                            {user.direct_permissions_count > 0 && (
                                                <Badge type="color" size="sm" color="success" className="rounded-sm tabular-nums">
                                                    +{user.direct_permissions_count} Khusus
                                                </Badge>
                                            )}
                                            {user.unit_scope_override && (
                                                <Badge type="color" size="sm" color="purple" className="rounded-sm">
                                                    Cakupan: {UNIT_SCOPE_LABEL[user.unit_scope_override] ?? user.unit_scope_override}
                                                </Badge>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <BadgeWithDot type="color" size="sm" color={user.is_active ? 'success' : 'error'} className="rounded-sm">
                                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                                        </BadgeWithDot>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-1.5">
                                            <Tooltip title="Lihat Detail Profil & Hak Akses">
                                                <Button
                                                    color="primary-sky"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat detail ${user.name}`}
                                                    href={route('users.show', user.id)}
                                                />
                                            </Tooltip>
                                            {can.manageAccess && (
                                                <Tooltip title="Edit Hak Akses & Peran">
                                                    <Button
                                                        color="primary-green"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label={`Edit hak akses ${user.name}`}
                                                        href={route('users.edit', user.id)}
                                                    />
                                                </Tooltip>
                                            )}
                                            {can.toggleStatus && user.id !== auth.user?.id && (
                                                <Button
                                                    color={user.is_active ? 'primary-destructive' : 'primary-green'}
                                                    size="sm"
                                                    aria-label={`${user.is_active ? 'Nonaktifkan' : 'Aktifkan'} akun ${user.name}`}
                                                    onPress={() => setStatusTarget(user)}
                                                >
                                                    {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                </Button>
                                            )}
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    {users.total > 0 && (
                        <PaginationCardMinimal
                            page={users.current_page}
                            total={users.last_page}
                            pageSize={users.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={users.total}
                            itemLabel="pengguna"
                            onPageChange={goToPage}
                            onPageSizeChange={changePageSize}
                        />
                    )}
                </div>
            </div>

            {statusTarget && (
                <ConfirmDialog
                    variant="default"
                    title={statusTarget.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                    confirmLabel={statusTarget.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
                    isLoading={updating}
                    onConfirm={confirmToggleStatus}
                    onClose={() => setStatusTarget(null)}
                >
                    Apakah Anda yakin ingin {statusTarget.is_active ? 'menonaktifkan' : 'mengaktifkan'} akun{' '}
                    <strong className="text-slate-900">&quot;{statusTarget.name}&quot;</strong> ({statusTarget.email})?
                    {statusTarget.is_active && ' Pengguna tidak dapat masuk dan sesi yang sedang berjalan akan langsung diputus.'}
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
