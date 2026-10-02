import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Filters = Record<string, string | number | undefined>;

interface ReportProps extends PageProps {
    laporan: 'rusak-hilang';
    filters: Filters;
    rowCount: number;
    units: { id: number; name: string; type: string }[];
}

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Menunggu Persetujuan' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'rejected', label: 'Ditolak' },
    { value: 'cancelled', label: 'Dibatalkan' },
];

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

export default function Index({ laporan, filters, rowCount, units }: ReportProps) {
    const [form, setForm] = useState<Filters>(filters);
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});
    const dirty = signature(form) !== signature(filters);

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const apply = (data: Filters) =>
        router.get(route('report.index'), clean({ ...data, laporan }), { preserveScroll: true, preserveState: 'errors', replace: true });

    const downloadUrl = `${route('report.download', { laporan })}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const select = (key: string, label: string, options: { value: string | number; label: string }[], placeholder: string) => (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <select value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD}>
                <option value="">{placeholder}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );

    const date = (key: string, label: string) => (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <input type="date" value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD} />
        </div>
    );

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset Rusak & Hilang" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Rusak &amp; Hilang</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Aset Rusak &amp; Hilang</h1>
                </div>

                {errorMessages.length > 0 && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {errorMessages.map((m) => <p key={m}>{m}</p>)}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply(form);
                    }}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {date('dari', 'Dari tanggal kejadian')}
                        {date('sampai', 'Sampai tanggal kejadian')}
                        {units.length > 0 && select('unit_id', 'Unit', units.map((u) => ({ value: u.id, label: u.name })), 'Semua unit')}
                        {select('jenis', 'Jenis', [{ value: 'rusak', label: 'Rusak' }, { value: 'hilang', label: 'Hilang' }], 'Semua jenis')}
                        {select('status', 'Status', STATUS_OPTIONS, 'Semua status')}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900">{rowCount}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {rowCount > 0 && !dirty ? (
                                <a href={downloadUrl} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                                    Unduh Excel
                                </a>
                            ) : (
                                <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
                                    Unduh Excel
                                </span>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
