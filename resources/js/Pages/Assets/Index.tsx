import {
    ChevronDownIcon as ChevronDown,
    ChevronLeftIcon as ChevronLeft,
    ChevronRightIcon as ChevronRight,
    EyeIcon as Eye,
    PencilIcon as Pencil,
    PlusIcon as Plus,
    PrinterIcon as Printer,
    SearchIcon as Search,
    XIcon as X,
} from '@/Components/Icons';
import PrintLabelModal from '@/Components/PrintLabelModal';
import ImportExportButtons from '@/Components/ImportExportButtons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { Asset, AssetCategory, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface Option {
    value: string;
    label: string;
}

interface Filters {
    search?: string;
    category_id?: string;
    unit_id?: string;
    kondisi?: string;
    urut?: string;
}

interface IndexProps extends PageProps {
    assets: Paginated<Asset>;
    filters: Filters;
    categories: AssetCategory[];
    units: UnitOption[];
    kondisiOptions: Option[];
    sortOptions: Option[];
    can: { create: boolean };
}

const KONDISI_STYLE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200',
    hilang: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function registerLabel(nomor: number): string {
    return String(nomor).padStart(4, '0');
}

export default function Index({ assets, filters, categories, units, kondisiOptions, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [printIds, setPrintIds] = useState<number[] | null>(null);

    const toggleRow = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const pageIds = assets.data.map((a) => a.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

    const toggleAllOnPage = () => {
        setSelectedIds((prev) =>
            allOnPageSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
        );
    };

    const applyFilters = (next: Partial<Filters>) => {
        router.get(
            route('assets.index'),
            { ...filters, ...next },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        const handle = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilters({ search: search || undefined });
            }
        }, 400);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        applyFilters({ search: search || undefined });
    };

    const subkategoris = categories.flatMap((c) => c.children ?? []);
    const pages = pageNumbersWithGaps(assets.current_page, assets.last_page);

    return (
        <AuthenticatedLayout>
            <Head title="Data Aset" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Data Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Daftar Barang Milik Daerah
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setPrintIds(selectedIds)}
                                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm transition ${
                                    selectedIds.length > 99
                                        ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <Printer className="h-4 w-4" />
                                <span>
                                    Cetak Label ({selectedIds.length})
                                    {selectedIds.length > 99 && ' · Maks 99'}
                                </span>
                            </button>
                        )}
                        <ImportExportButtons modul="aset" query={filters} />
                        {can.create && (
                            <Link
                                href={route('assets.create')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Tambah Aset Baru</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="relative">
                            <select
                                value={filters.category_id ?? ''}
                                onChange={(e) => applyFilters({ category_id: e.target.value || undefined })}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Semua Kategori</option>
                                {categories.map((kategori) => (
                                    <optgroup key={kategori.id} label={kategori.name}>
                                        {(kategori.children ?? []).map((sub) => (
                                            <option key={sub.id} value={sub.id}>
                                                {sub.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        <div className="relative">
                            <select
                                value={filters.unit_id ?? ''}
                                onChange={(e) => applyFilters({ unit_id: e.target.value || undefined })}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Semua Unit</option>
                                {units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>
                                        {unit.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        <div className="relative">
                            <select
                                value={filters.kondisi ?? ''}
                                onChange={(e) => applyFilters({ kondisi: e.target.value || undefined })}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Semua Kondisi</option>
                                {kondisiOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        <div className="relative">
                            <select
                                aria-label="Urutkan"
                                value={filters.urut ?? 'nama_asc'}
                                onChange={(e) => applyFilters({ urut: e.target.value === 'nama_asc' ? undefined : e.target.value })}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                {sortOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        Urutkan: {o.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="shadow-xs overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 p-4">
                        <form onSubmit={submitSearch} className="relative max-w-sm">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                aria-label="Cari aset"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama barang, kode BMD, atau dokumen..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        applyFilters({ search: undefined });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </form>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="w-10 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allOnPageSelected}
                                            onChange={toggleAllOnPage}
                                            aria-label="Pilih semua aset di halaman ini"
                                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                        />
                                    </th>
                                    <th className="w-16 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Foto
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Identitas Barang
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Kode Register BMD
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Unit Pemilik
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Pemegang
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Kondisi
                                    </th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Nilai Perolehan
                                    </th>
                                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {assets.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-14 text-center text-sm text-slate-400">
                                            Tidak ada aset yang cocok dengan pencarian/filter ini.
                                        </td>
                                    </tr>
                                ) : (
                                    assets.data.map((asset) => (
                                        <tr key={asset.id} className="transition hover:bg-slate-50/60">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(asset.id)}
                                                    onChange={() => toggleRow(asset.id)}
                                                    aria-label={`Pilih ${asset.nama_aset}`}
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="h-12 w-12 overflow-hidden rounded bg-slate-100">
                                                    {asset.photos?.[0] && (
                                                        <img
                                                            src={asset.photos[0].url}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={route('assets.show', asset.id)}
                                                    className="block max-w-[260px] truncate text-sm font-semibold text-slate-900 hover:text-blue-700"
                                                >
                                                    {asset.nama_aset}
                                                </Link>
                                                <p className="max-w-[260px] truncate text-xs text-slate-500">
                                                    {asset.merk_type ?? '—'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="whitespace-nowrap font-mono text-[13px] text-slate-800">
                                                    {asset.kode_barang}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    Reg. {registerLabel(asset.nomor_register)}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{asset.unit?.name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">
                                                {asset.current_holder?.nama ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${KONDISI_STYLE[asset.kondisi]}`}
                                                >
                                                    {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ??
                                                        asset.kondisi}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                                {formatRupiah(asset.nilai_perolehan)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Link
                                                        href={route('assets.show', asset.id)}
                                                        title="Lihat detail"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                    <Link
                                                        href={route('assets.edit', asset.id)}
                                                        title="Ubah aset"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPrintIds([asset.id])}
                                                        title="Cetak label QR"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold text-slate-800">
                                {assets.from ?? 0}-{assets.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold text-slate-800">{assets.total}</span> aset
                        </p>

                        {assets.last_page > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={assets.current_page <= 1}
                                    onClick={() =>
                                        router.get(
                                            route('assets.index'),
                                            { ...filters, page: assets.current_page - 1 },
                                            { preserveState: true, preserveScroll: true },
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span>Sebelumnya</span>
                                </button>

                                <div className="flex items-center gap-1">
                                    {pages.map((page, idx) =>
                                        page === '...' ? (
                                            <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">
                                                ...
                                            </span>
                                        ) : (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() =>
                                                    router.get(
                                                        route('assets.index'),
                                                        { ...filters, page },
                                                        { preserveState: true, preserveScroll: true },
                                                    )
                                                }
                                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                                                    page === assets.current_page
                                                        ? 'bg-[#1E40AF] text-white shadow-sm'
                                                        : 'text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ),
                                    )}
                                </div>

                                <button
                                    type="button"
                                    disabled={assets.current_page >= assets.last_page}
                                    onClick={() =>
                                        router.get(
                                            route('assets.index'),
                                            { ...filters, page: assets.current_page + 1 },
                                            { preserveState: true, preserveScroll: true },
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <span>Berikutnya</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {printIds && <PrintLabelModal assetIds={printIds} onClose={() => setPrintIds(null)} />}
        </AuthenticatedLayout>
    );
}
