import ConfirmDialog from '@/Components/ConfirmDialog';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PageHeader from '@/Components/PageHeader';
import { PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Plus, SearchLg, Shield01, Trash01, User01, XClose } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface IndexProps extends PageProps {
    pegawais: Pegawai[];
    units: UnitOption[];
    can: {
        create: boolean;
        createUser: boolean;
        manageAccess?: boolean;
        delete?: boolean;
    };
}

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];

const STATUS_ITEMS = [
    { id: 'all', label: 'Semua Status' },
    { id: 'pns', label: 'PNS' },
    { id: 'pppk', label: 'PPPK' },
];

export default function Index({ pegawais, units, can }: IndexProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pns' | 'pppk'>('all');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [itemsPerPage, setItemsPerPage] = useState<number>(12);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteModalPegawai, setDeleteModalPegawai] = useState<Pegawai | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredPegawais = useMemo(() => {
        return pegawais.filter((p) => {
            const matchesSearch =
                searchQuery === '' ||
                p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.nip && p.nip.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || p.status_kepegawaian === statusFilter;

            const matchesUnit = unitFilter === 'all' || String(p.unit_id) === unitFilter;

            return matchesSearch && matchesStatus && matchesUnit;
        });
    }, [pegawais, searchQuery, statusFilter, unitFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredPegawais.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedPegawais = useMemo(() => {
        const start = (safeCurrentPage - 1) * itemsPerPage;
        return filteredPegawais.slice(start, start + itemsPerPage);
    }, [filteredPegawais, safeCurrentPage, itemsPerPage]);

    const hasActiveFilter = searchQuery !== '' || statusFilter !== 'all' || unitFilter !== 'all';

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setUnitFilter('all');
        setCurrentPage(1);
    };

    const handleDelete = () => {
        if (!deleteModalPegawai) return;

        setIsDeleting(true);
        router.delete(route('pegawais.destroy', deleteModalPegawai.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeleteModalPegawai(null);
            },
        });
    };

    const unitItems = [{ id: 'all', label: 'Semua Unit' }, ...units.map((unit) => ({ id: String(unit.id), label: unit.name }))];

    return (
        <AuthenticatedLayout>
            <Head title="Data Pegawai" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Pegawai' }]}
                    title="Data Pegawai"
                    actions={
                        <>
                            <ImportExportButtons modul="pegawai" />
                            {can.create && (
                                <Button color="primary" size="md" iconLeading={Plus} href={route('pegawais.create')}>
                                    Tambah Pegawai Baru
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Filter Toolbar */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-2">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari pegawai"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nama atau NIP..."
                                value={searchQuery}
                                onChange={(v) => {
                                    setSearchQuery(v);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        {searchQuery && (
                            <Button
                                color="tertiary"
                                size="md"
                                iconLeading={XClose}
                                aria-label="Hapus pencarian"
                                onPress={() => {
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                }}
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            aria-label="Status"
                            size="md"
                            className="min-w-[150px]"
                            items={STATUS_ITEMS}
                            selectedKey={statusFilter}
                            onSelectionChange={(key) => {
                                setStatusFilter(String(key) as 'all' | 'pns' | 'pppk');
                                setCurrentPage(1);
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Unit"
                            size="md"
                            className="min-w-[200px]"
                            items={unitItems}
                            selectedKey={unitFilter}
                            onSelectionChange={(key) => {
                                setUnitFilter(String(key));
                                setCurrentPage(1);
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        {hasActiveFilter && (
                            <Button color="tertiary" size="md" iconLeading={XClose} onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        )}
                    </div>
                </div>

                {/* Employee Grid */}
                {paginatedPegawais.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
                        {paginatedPegawais.map((pegawai) => {
                            const isPns = pegawai.status_kepegawaian === 'pns';
                            const hasAccount = Boolean(pegawai.user_id);

                            return (
                                <div
                                    key={pegawai.id}
                                    className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md"
                                >
                                    {/* Photo Section */}
                                    <Link
                                        href={route('pegawais.show', pegawai.id)}
                                        className="flex w-28 shrink-0 items-center justify-center bg-slate-100 p-2 outline-hidden transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:w-32"
                                        aria-label={`Lihat detail ${pegawai.nama}`}
                                    >
                                        {pegawai.foto_profile ? (
                                            <img
                                                src={pegawai.foto_profile_thumbnail_url || `/storage/${pegawai.foto_profile}`}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                className="h-full max-h-36 w-full rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-20 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                                                <User01 className="size-10" aria-hidden="true" />
                                            </div>
                                        )}
                                    </Link>

                                    {/* Details Section */}
                                    <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                                        <div className="border-b border-slate-100 pb-2">
                                            <h3 className="text-base font-bold leading-snug text-slate-900">
                                                <Link href={route('pegawais.show', pegawai.id)} className="transition-colors hover:text-blue-700">
                                                    {pegawai.nama}
                                                </Link>
                                            </h3>
                                        </div>

                                        <div className="mt-2.5 flex flex-1 flex-col gap-3 text-xs sm:flex-row sm:items-start sm:justify-between">
                                            {/* Informasi Kepegawaian */}
                                            <div className="min-w-0 flex-1 space-y-1 text-slate-600">
                                                <div>
                                                    <span className="text-slate-400">NIP: </span>
                                                    <span className="font-medium tabular-nums text-slate-800">{pegawai.nip ?? '-'}</span>
                                                </div>
                                                <div className="truncate font-semibold text-slate-900">{pegawai.jabatan}</div>
                                                <div>
                                                    <span className="text-slate-400">Pangkat: </span>
                                                    <span className="font-medium text-slate-700">{pegawai.pangkat_golongan ?? '-'}</span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">Unit: </span>
                                                    <span className="font-medium text-slate-700">{pegawai.unit?.name ?? '-'}</span>
                                                </div>
                                            </div>

                                            {/* Status, Akun & Aksi */}
                                            <div className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:self-stretch">
                                                <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                                                    <Badge type="color" size="sm" color={isPns ? 'brand' : 'purple'} className="rounded-sm">
                                                        {isPns ? 'PNS' : 'PPPK'}
                                                    </Badge>
                                                    <BadgeWithDot type="color" size="sm" color={hasAccount ? 'success' : 'gray'} className="rounded-sm">
                                                        {hasAccount ? 'Punya Akun' : 'Belum Ada Akun'}
                                                    </BadgeWithDot>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {hasAccount && can.manageAccess && (
                                                        <Tooltip title="Kelola hak akses & role akun">
                                                            <Button
                                                                color="primary-sky"
                                                                size="sm"
                                                                iconLeading={Shield01}
                                                                aria-label="Kelola hak akses & role akun"
                                                                href={route('users.edit', pegawai.user_id as number)}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Lihat detail dan edit pegawai">
                                                        <Button
                                                            color="primary-green"
                                                            size="sm"
                                                            iconLeading={Edit01}
                                                            aria-label="Lihat detail dan edit pegawai"
                                                            href={route('pegawais.edit', pegawai.id)}
                                                        />
                                                    </Tooltip>
                                                    {can.delete && (
                                                        <Tooltip title="Hapus data pegawai">
                                                            <Button
                                                                color="primary-destructive"
                                                                size="sm"
                                                                iconLeading={Trash01}
                                                                aria-label="Hapus data pegawai"
                                                                onPress={() => setDeleteModalPegawai(pegawai)}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <User01 className="size-6" aria-hidden="true" />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">Tidak ada pegawai ditemukan</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {hasActiveFilter
                                ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
                                : 'Belum ada data pegawai yang terdaftar di unit ini.'}
                        </p>
                        {hasActiveFilter && (
                            <Button color="secondary" size="sm" className="mt-4" onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        )}
                    </div>
                )}

                {/* Pagination Bar */}
                {filteredPegawais.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                        <PaginationCardMinimal
                            className="border-t-0"
                            page={safeCurrentPage}
                            total={totalPages}
                            pageSize={itemsPerPage}
                            pageSizes={PAGE_SIZE_OPTIONS}
                            totalItems={filteredPegawais.length}
                            itemLabel="pegawai"
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                                setItemsPerPage(size);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                )}
            </div>

            {deleteModalPegawai && (
                <ConfirmDialog
                    title="Konfirmasi Hapus Pegawai"
                    confirmLabel="Hapus Pegawai"
                    isLoading={isDeleting}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteModalPegawai(null)}
                >
                    Apakah Anda yakin ingin menghapus data pegawai{' '}
                    <strong className="font-semibold text-slate-900">{deleteModalPegawai.nama}</strong>?
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
