import {
    ChevronDownIcon as ChevronDown,
    ChevronLeftIcon as ChevronLeft,
    ChevronRightIcon as ChevronRight,
    PencilIcon as Pencil,
    PlusIcon as Plus,
    SearchIcon as Search,
    ShieldIcon,
    TrashIcon as Trash2,
    UserIcon,
    XIcon as X,
} from '@/Components/Icons';
import ImportExportButtons from '@/Components/ImportExportButtons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
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

export default function Index({ pegawais, units, can }: IndexProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pns' | 'pppk'>(
        'all',
    );
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [itemsPerPage, setItemsPerPage] = useState<number>(12);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteModalPegawai, setDeleteModalPegawai] =
        useState<Pegawai | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredPegawais = useMemo(() => {
        return pegawais.filter((p) => {
            const matchesSearch =
                searchQuery === '' ||
                p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.nip &&
                    p.nip.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === 'all' || p.status_kepegawaian === statusFilter;

            const matchesUnit =
                unitFilter === 'all' || String(p.unit_id) === unitFilter;

            return matchesSearch && matchesStatus && matchesUnit;
        });
    }, [pegawais, searchQuery, statusFilter, unitFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredPegawais.length / itemsPerPage),
    );
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedPegawais = useMemo(() => {
        const start = (safeCurrentPage - 1) * itemsPerPage;
        return filteredPegawais.slice(start, start + itemsPerPage);
    }, [filteredPegawais, safeCurrentPage, itemsPerPage]);

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

    return (
        <AuthenticatedLayout>
            <Head title="Data Pegawai" />

            <div className="space-y-6">
                {/* Top Bar Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link
                                href={route('dashboard')}
                                className="hover:text-blue-700"
                            >
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">
                                Data Pegawai
                            </span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Data Pegawai
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ImportExportButtons modul="pegawai" />
                        {can.create && (
                            <Link
                                href={route('pegawais.create')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Tambah Pegawai Baru</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Cari nama atau NIP..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[140px]">
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(
                                        e.target.value as
                                            'all' | 'pns' | 'pppk',
                                    );
                                    setCurrentPage(1);
                                }}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="all">Semua Status</option>
                                <option value="pns">PNS</option>
                                <option value="pppk">PPPK</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        <div className="relative min-w-[170px]">
                            <select
                                value={unitFilter}
                                onChange={(e) => {
                                    setUnitFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="all">Semua Unit</option>
                                {units.map((unit) => (
                                    <option
                                        key={unit.id}
                                        value={String(unit.id)}
                                    >
                                        {unit.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
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
                                    className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                                >
                                    {/* Photo Section */}
                                    <Link
                                        href={route(
                                            'pegawais.show',
                                            pegawai.id,
                                        )}
                                        className="flex w-28 shrink-0 items-center justify-center bg-slate-100 p-2 transition hover:opacity-90 sm:w-32"
                                        title="Lihat detail pegawai"
                                    >
                                        {pegawai.foto_profile ? (
                                            <img
                                                src={`/storage/${pegawai.foto_profile}`}
                                                alt={pegawai.nama}
                                                className="h-full max-h-36 w-full rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
                                                <UserIcon className="h-10 w-10 text-slate-400" />
                                            </div>
                                        )}
                                    </Link>

                                    {/* Details Section */}
                                    <div className="flex flex-1 flex-col justify-between p-4 min-w-0">
                                        {/* Header Row: Nama Pegawai Full Width (Tidak terpotong) */}
                                        <div className="border-b border-slate-100 pb-2">
                                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                                                <Link
                                                    href={route(
                                                        'pegawais.show',
                                                        pegawai.id,
                                                    )}
                                                    className="transition-colors hover:text-blue-700"
                                                >
                                                    {pegawai.nama}
                                                </Link>
                                            </h3>
                                        </div>

                                        {/* Content Split: Sisi Kiri (Data Pegawai) & Sisi Kanan (Status & Aksi) */}
                                        <div className="mt-2.5 flex flex-1 items-start justify-between gap-3 text-xs">
                                            {/* Section Kiri: Informasi Kepegawaian */}
                                            <div className="space-y-1 text-slate-600 min-w-0 flex-1">
                                                <div>
                                                    <span className="text-slate-400">
                                                        NIP:{' '}
                                                    </span>
                                                    <span className="font-medium text-slate-800">
                                                        {pegawai.nip ?? '-'}
                                                    </span>
                                                </div>
                                                <div className="font-semibold text-slate-900 truncate">
                                                    {pegawai.jabatan}
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">
                                                        Pangkat:{' '}
                                                    </span>
                                                    <span className="font-medium text-slate-700">
                                                        {pegawai.pangkat_golongan ??
                                                            '-'}
                                                    </span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">
                                                        Unit:{' '}
                                                    </span>
                                                    <span className="font-medium text-slate-700">
                                                        {pegawai.unit?.name ??
                                                            '-'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Section Kanan: Badge Status, Akun & Tombol Aksi */}
                                            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span
                                                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                                                            isPns
                                                                ? 'border border-blue-200 bg-blue-50 text-blue-700'
                                                                : 'border border-purple-200 bg-purple-50 text-purple-700'
                                                        }`}
                                                    >
                                                        {isPns ? 'PNS' : 'PPPK'}
                                                    </span>

                                                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                                        <span
                                                            className={`h-2 w-2 rounded-full ${
                                                                hasAccount
                                                                    ? 'bg-emerald-500'
                                                                    : 'bg-slate-300'
                                                            }`}
                                                        />
                                                        <span
                                                            className={
                                                                hasAccount
                                                                    ? 'text-emerald-700'
                                                                    : 'text-slate-500'
                                                            }
                                                        >
                                                            {hasAccount
                                                                ? 'Punya Akun'
                                                                : 'Belum Ada Akun'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-1.5">
                                                    {hasAccount && can.manageAccess && (
                                                        <Link
                                                            href={route('users.edit', pegawai.user_id as number)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-blue-300 hover:bg-slate-50 hover:text-blue-700"
                                                            title="Kelola hak akses & role akun"
                                                        >
                                                            <ShieldIcon className="h-3.5 w-3.5" />
                                                        </Link>
                                                    )}

                                                    <Link
                                                        href={route(
                                                            'pegawais.edit',
                                                            pegawai.id,
                                                        )}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-blue-300 hover:bg-slate-50 hover:text-blue-700"
                                                        title="Lihat detail dan edit pegawai"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Link>

                                                    {can.delete && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setDeleteModalPegawai(
                                                                    pegawai,
                                                                )
                                                            }
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-rose-300 hover:bg-slate-50 hover:text-rose-600"
                                                            title="Hapus data pegawai"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <UserIcon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">
                            Tidak ada pegawai ditemukan
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {searchQuery ||
                            statusFilter !== 'all' ||
                            unitFilter !== 'all'
                                ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
                                : 'Belum ada data pegawai yang terdaftar di unit ini.'}
                        </p>
                    </div>
                )}

                {/* Pagination Bar */}
                {filteredPegawais.length > 0 && (
                    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm sm:flex-row">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <div>
                                Menampilkan{' '}
                                <span className="font-semibold text-slate-900">
                                    {paginatedPegawais.length}
                                </span>{' '}
                                dari{' '}
                                <span className="font-semibold text-slate-900">
                                    {filteredPegawais.length}
                                </span>{' '}
                                pegawai
                            </div>

                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                                <span className="text-slate-500">Per halaman:</span>
                                <div className="relative">
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(
                                                Number(e.target.value),
                                            );
                                            setCurrentPage(1);
                                        }}
                                        className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={safeCurrentPage <= 1}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                <span>Sebelumnya</span>
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from(
                                    { length: totalPages },
                                    (_, i) => i + 1,
                                ).map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => setCurrentPage(page)}
                                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition ${
                                            page === safeCurrentPage
                                                ? 'bg-blue-700 text-white shadow-sm'
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((p) =>
                                        Math.min(totalPages, p + 1),
                                    )
                                }
                                disabled={safeCurrentPage >= totalPages}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span>Berikutnya</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Konfirmasi Hapus */}
            {deleteModalPegawai && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-semibold text-slate-900">
                                Konfirmasi Hapus Pegawai
                            </h3>
                            <button
                                onClick={() => setDeleteModalPegawai(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="py-4">
                            <p className="text-sm text-slate-600">
                                Apakah Anda yakin ingin menghapus data pegawai{' '}
                                <strong className="font-semibold text-slate-900">
                                    {deleteModalPegawai.nama}
                                </strong>
                                ?
                            </p>
                            <p className="mt-2 text-xs text-rose-600">
                                Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModalPegawai(null)}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                                {isDeleting ? 'Menghapus...' : 'Hapus Pegawai'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
