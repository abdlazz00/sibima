import { ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight, EyeIcon as Eye, PlusIcon as Plus } from '@/Components/Icons';
import { FilterCard, FilterSelect, TableSearch } from '@/Components/ListFilters';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { PENERIMAAN_STATUS_LABEL, PENERIMAAN_STATUS_STYLE, PenerimaanStatusKey, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<BeritaAcaraPenerimaan>;
    filters: { search?: string; status?: string; dari?: string; sampai?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

const DATE_INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const DATE_LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(items.current_page, items.last_page);

    const goTo = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('penerimaan-aset.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        goTo({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Penerimaan Aset" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Penerimaan Aset</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Penerimaan Aset Baru</h1>
                    </div>
                    {can.create && (
                        <Link href={route('penerimaan-aset.create')} className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                            <Plus className="h-4 w-4" /> Ajukan Penerimaan
                        </Link>
                    )}
                </div>

                <FilterCard
                    action={
                        (filters.status || filters.dari || filters.sampai) && (
                            <button
                                type="button"
                                onClick={() => goTo({ status: undefined, dari: undefined, sampai: undefined, page: undefined })}
                                className="text-sm font-medium text-blue-700 hover:underline"
                            >
                                Reset filter
                            </button>
                        )
                    }
                >
                    <FilterSelect ariaLabel="Status" value={filters.status ?? ''} onChange={(v) => goTo({ status: v || undefined, page: undefined })}>
                        <option value="">Semua status</option>
                        {(Object.keys(PENERIMAAN_STATUS_LABEL) as PenerimaanStatusKey[]).map((key) => (
                            <option key={key} value={key}>{PENERIMAAN_STATUS_LABEL[key]}</option>
                        ))}
                    </FilterSelect>
                    <div>
                        <label htmlFor="filter-dari" className={DATE_LABEL}>Dari tanggal</label>
                        <input id="filter-dari" type="date" value={filters.dari ?? ''} onChange={(e) => goTo({ dari: e.target.value || undefined, page: undefined })} className={DATE_INPUT} />
                    </div>
                    <div>
                        <label htmlFor="filter-sampai" className={DATE_LABEL}>Sampai tanggal</label>
                        <input id="filter-sampai" type="date" value={filters.sampai ?? ''} onChange={(e) => goTo({ sampai: e.target.value || undefined, page: undefined })} className={DATE_INPUT} />
                    </div>
                    <FilterSelect ariaLabel="Urutkan" value={filters.urut ?? 'terbaru'} onChange={(v) => goTo({ urut: v === 'terbaru' ? undefined : v, page: undefined })}>
                        {sortOptions.map((o) => <option key={o.value} value={o.value}>Urutkan: {o.label}</option>)}
                    </FilterSelect>
                </FilterCard>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <TableSearch
                        value={search}
                        onChange={setSearch}
                        onSubmit={submitSearch}
                        onClear={() => {
                            setSearch('');
                            goTo({ search: undefined, page: undefined });
                        }}
                        placeholder="Cari no. berita acara atau nama aset..."
                    />
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">No. Berita Acara</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nama Aset</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kategori</th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nilai</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pengaju</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.data.length === 0 ? (
                                <tr><td colSpan={8} className="py-14 text-center text-sm text-slate-400">Belum ada pengajuan penerimaan aset.</td></tr>
                            ) : (
                                items.data.map((ba) => {
                                    const status = penerimaanStatus(ba);
                                    const extra = (ba.items?.length ?? 0) - 1;
                                    const nilai = (ba.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);
                                    return (
                                        <tr key={ba.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 text-sm text-slate-800">{ba.no_berita_acara}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                {ba.items?.[0]?.nama_aset}
                                                {extra > 0 && <span className="font-normal text-slate-400"> +{extra} lainnya</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{ba.items?.[0]?.category?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800">{formatRupiah(nilai)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{ba.creator?.name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{new Date(ba.tanggal_penerimaan).toLocaleDateString('id-ID')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${PENERIMAAN_STATUS_STYLE[status]}`}>{PENERIMAAN_STATUS_LABEL[status]}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Link href={route('penerimaan-aset.show', ba.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800">{items.from ?? 0}-{items.to ?? 0}</span> dari <span className="font-semibold text-slate-800">{items.total}</span> penerimaan
                        </p>

                        {items.last_page > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={items.current_page <= 1}
                                    onClick={() => router.get(route('penerimaan-aset.index'), { ...filters, page: items.current_page - 1 }, { preserveState: true, preserveScroll: true })}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" /> <span>Sebelumnya</span>
                                </button>
                                <div className="flex items-center gap-1">
                                    {pages.map((page, idx) =>
                                        page === '...' ? (
                                            <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                        ) : (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() => router.get(route('penerimaan-aset.index'), { ...filters, page }, { preserveState: true, preserveScroll: true })}
                                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${page === items.current_page ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                            >
                                                {page}
                                            </button>
                                        ),
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled={items.current_page >= items.last_page}
                                    onClick={() => router.get(route('penerimaan-aset.index'), { ...filters, page: items.current_page + 1 }, { preserveState: true, preserveScroll: true })}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <span>Berikutnya</span> <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
