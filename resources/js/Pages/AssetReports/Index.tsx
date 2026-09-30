import { ChevronRightIcon as ChevronRight, EyeIcon as Eye, PlusIcon as Plus, SearchIcon as Search } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { AssetReport, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetReport>;
    filters: { search?: string; status?: string; jenis?: string };
    can: { create: boolean };
}

const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Index({ items, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const pages = pageNumbersWithGaps(items.current_page, items.last_page);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-reports.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Lapor Rusak/Hilang" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Lapor Rusak/Hilang</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Lapor Rusak/Hilang</h1>
                    </div>
                    {can.create && (
                        <Link href={route('asset-reports.create')} className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                            <Plus className="h-4 w-4" /> Buat Laporan
                        </Link>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    <form onSubmit={submitSearch} className="relative w-full max-w-sm">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nomor laporan atau nama aset..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </form>
                    <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua status</option>
                        {Object.entries(REPORT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={filters.jenis ?? ''} onChange={(e) => go({ jenis: e.target.value || undefined, page: undefined })} className={SELECT}>
                        <option value="">Semua jenis</option>
                        {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">No. Laporan</th>
                                <th className="px-4 py-3">Aset</th>
                                <th className="px-4 py-3">Jenis</th>
                                <th className="px-4 py-3">Kondisi Baru</th>
                                <th className="px-4 py-3">Unit</th>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                            {items.data.length === 0 ? (
                                <tr><td colSpan={8} className="py-14 text-center text-sm text-slate-400">Belum ada laporan.</td></tr>
                            ) : (
                                items.data.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-medium">{r.nomor_laporan}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">{r.asset?.nama_aset}</td>
                                        <td className="px-4 py-3">{REPORT_TYPE_LABEL[r.jenis]}</td>
                                        <td className="px-4 py-3">{KONDISI_LABEL[r.kondisi_baru]}</td>
                                        <td className="px-4 py-3">{r.unit?.name}</td>
                                        <td className="px-4 py-3">{new Date(r.tanggal_kejadian).toLocaleDateString('id-ID')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REPORT_STATUS_STYLE[r.status]}`}>{REPORT_STATUS_LABEL[r.status]}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link href={route('asset-reports.show', r.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800">{items.from ?? 0}-{items.to ?? 0}</span> dari <span className="font-semibold text-slate-800">{items.total}</span> laporan
                        </p>
                        {items.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => go({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === items.current_page ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {page}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
