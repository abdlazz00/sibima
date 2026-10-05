import {
    ChevronLeftIcon as ChevronLeft,
    ChevronRightIcon as ChevronRight,
    EyeIcon as Eye,
    PlusIcon as Plus,
    SearchIcon as Search,
} from '@/Components/Icons';
import { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { AssetMutation, MutationType, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    mutations: Paginated<AssetMutation>;
    filters?: { search?: string; jenis?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200/60',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rejected: 'bg-red-50 text-red-700 border-red-200/60',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const MUTATION_TYPE_STYLE: Record<MutationType, string> = {
    kec_ke_kel: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    antar_kel: 'bg-sky-50 text-sky-700 border-sky-200/60',
    retur_kel_ke_kec: 'bg-purple-50 text-purple-700 border-purple-200/60',
    internal: 'bg-teal-50 text-teal-700 border-teal-200/60',
    pengembalian: 'bg-amber-50 text-amber-700 border-amber-200/60',
};

const MUTATION_TYPE_LABEL: Record<MutationType, string> = {
    kec_ke_kel: 'Kecamatan ke Kelurahan',
    antar_kel: 'Antar Kelurahan',
    retur_kel_ke_kec: 'Retur ke Kecamatan',
    internal: 'Mutasi Internal',
    pengembalian: 'Pengembalian ke Inventaris',
};

export default function Index({ mutations, filters = {}, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(mutations.current_page, mutations.last_page);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-mutations.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Mutasi Aset" />

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Mutasi Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Daftar Mutasi Aset
                        </h1>
                    </div>
                    {can.create && (
                        <Link
                            href={route('asset-mutations.create')}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" /> Ajukan Mutasi Aset
                        </Link>
                    )}
                </div>

                <FilterCard>
                    <FilterSelect ariaLabel="Jenis alur" value={filters.jenis ?? ''} onChange={(v) => go({ jenis: v || undefined, page: undefined })}>
                        <option value="">Semua Alur</option>
                        {(Object.keys(MUTATION_TYPE_LABEL) as MutationType[]).map((type) => (
                            <option key={type} value={type}>{MUTATION_TYPE_LABEL[type]}</option>
                        ))}
                    </FilterSelect>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => go({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                </FilterCard>

                {/* Table Section */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            go({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari no. mutasi, nama aset, atau unit..."
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        No. Mutasi & Tanggal
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Jenis Mutasi
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Alur Unit (Asal &rarr; Tujuan)
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Aset yang Dimutasi
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Status
                                    </th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mutations.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center">
                                            <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                    <Search className="h-6 w-6" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    Belum ada transaksi mutasi
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Pengajuan mutasi aset antar unit atau internal akan tampil di sini.
                                                </p>
                                                {can.create && (
                                                    <Link
                                                        href={route('asset-mutations.create')}
                                                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" /> Buat Pengajuan Pertama
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    mutations.data.map((mutation) => {
                                        const totalItems = mutation.items?.length ?? 0;
                                        const firstItem = mutation.items?.[0];
                                        const extraItems = totalItems - 1;

                                        return (
                                            <tr key={mutation.id} className="transition hover:bg-slate-50/60">
                                                <td className="px-4 py-3.5">
                                                    <span className="font-semibold text-slate-900">
                                                        {mutation.nomor_mutasi}
                                                    </span>
                                                    <span className="block text-xs text-slate-500">
                                                        {new Date(mutation.tanggal_mutasi).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
                                                            MUTATION_TYPE_STYLE[mutation.jenis_mutasi]
                                                        }`}
                                                    >
                                                        {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-800">
                                                    {mutation.jenis_mutasi === 'internal' || mutation.jenis_mutasi === 'pengembalian' ? (
                                                        <span className="font-medium text-slate-900">
                                                            {mutation.origin_unit?.name} ({mutation.jenis_mutasi === 'pengembalian' ? 'Ke Inventaris' : 'Internal'})
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <span className="font-medium text-slate-900">
                                                                {mutation.origin_unit?.name}
                                                            </span>
                                                            <span className="text-slate-400">&rarr;</span>
                                                            <span className="font-medium text-blue-700">
                                                                {mutation.destination_unit?.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-800">
                                                    {firstItem ? (
                                                        <div>
                                                            <span className="font-medium text-slate-900">
                                                                {firstItem.asset?.nama_aset ?? `Aset #${firstItem.asset_id}`}
                                                            </span>
                                                            {extraItems > 0 && (
                                                                <span className="ml-1 text-xs text-slate-500">
                                                                    +{extraItems} aset lainnya
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                                            STATUS_STYLE[mutation.status]
                                                        }`}
                                                    >
                                                        {STATUS_LABEL[mutation.status]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <Link
                                                        href={route('asset-mutations.show', mutation.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                                                        title="Lihat Detail Mutasi"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {mutations.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6">
                            <p className="text-xs text-slate-600">
                                Menampilkan{' '}
                                <span className="font-semibold text-slate-900">{mutations.from ?? 0}</span> sampai{' '}
                                <span className="font-semibold text-slate-900">{mutations.to ?? 0}</span> dari{' '}
                                <span className="font-semibold text-slate-900">{mutations.total}</span> data
                            </p>
                            <nav className="flex items-center gap-1">
                                {mutations.current_page > 1 && (
                                    <Link
                                        href={route('asset-mutations.index', {
                                            page: mutations.current_page - 1,
                                            search: filters.search,
                                            jenis: filters.jenis,
                                            urut: filters.urut,
                                        })}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Link>
                                )}
                                {pages.map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`gap-${idx}`} className="px-2 text-xs text-slate-400">
                                            ...
                                        </span>
                                    ) : (
                                        <Link
                                            key={`page-${p}`}
                                            href={route('asset-mutations.index', {
                                                page: p,
                                                search: filters.search,
                                                jenis: filters.jenis,
                                                urut: filters.urut,
                                            })}
                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                                                p === mutations.current_page
                                                    ? 'bg-[#1E40AF] text-white shadow-xs'
                                                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {p}
                                        </Link>
                                    )
                                )}
                                {mutations.current_page < mutations.last_page && (
                                    <Link
                                        href={route('asset-mutations.index', {
                                            page: mutations.current_page + 1,
                                            search: filters.search,
                                            jenis: filters.jenis,
                                            urut: filters.urut,
                                        })}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                )}
                            </nav>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
