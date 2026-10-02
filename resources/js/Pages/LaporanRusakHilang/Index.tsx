import DonutChart from '@/Components/Charts/DonutChart';
import TrenInsidenChart from '@/Components/Charts/TrenInsidenChart';
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { LaporanRusakHilangData, PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useState } from 'react';

type Filters = Record<string, string | number | undefined>;

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

const STATUS_BADGE: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-300',
};

const KONDISI_BADGE: Record<string, string> = {
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200',
    hilang: 'bg-slate-100 text-slate-700 border-slate-300',
};

const COLUMNS: { key: string; label: string; sort?: string; align?: 'right' }[] = [
    { key: 'nomor', label: 'No. Laporan', sort: 'nomor_laporan' },
    { key: 'tanggal', label: 'Tgl Kejadian', sort: 'tanggal_kejadian' },
    { key: 'nama_aset', label: 'Aset', sort: 'nama_aset' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'unit', label: 'Unit' },
    { key: 'pemegang', label: 'Pemegang' },
    { key: 'kondisi', label: 'Kondisi', sort: 'kondisi_baru' },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right' },
    { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right' },
    { key: 'status', label: 'Status', sort: 'status' },
];

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

const tanggal = (value: string | null) => (value ? new Date(value).toLocaleDateString('id-ID') : '—');

function Badge({ label, style }: { label: string; style: string }) {
    return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}

function Legend({ items, unit = 'laporan' }: { items: { label: string; jumlah: number; persen: number; color: string }[]; unit?: string }) {
    return (
        <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-800">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
                        {i.label}
                    </span>
                    <span className="tabular-nums text-slate-600">
                        {i.jumlah.toLocaleString('id-ID')} {unit} · {i.persen.toLocaleString('id-ID')}%
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default function Index(props: PageProps & LaporanRusakHilangData) {
    const {
        filters,
        sort,
        ringkasan,
        status,
        kondisi,
        tren,
        sebaran_unit: sebaranUnit,
        masih_berjalan: masihBerjalan,
        jumlah_masih_berjalan: jumlahBerjalan,
        reports,
        unitOptions,
        categoryOptions,
        kondisiOptions,
        statusOptions,
    } = props;
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    const [form, setForm] = useState<Filters>(filters);
    const [open, setOpen] = useState<number | null>(null);
    const dirty = signature(form) !== signature(filters);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
    const kondisiLabel = Object.fromEntries(kondisiOptions.map((k) => [k.value, k.label]));

    const visit = (extra: Filters, base: Filters = filters) =>
        router.get(route('laporan-rusak-hilang.index'), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) =>
        visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });

    const downloadUrl = `${route('laporan-rusak-hilang.download')}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const pages = pageNumbersWithGaps(reports.current_page, reports.last_page);
    const unitOpts = unitOptions.map((u) => ({ value: u.id, label: u.name }));
    const catOpts = categoryOptions.map((c) => ({ value: c.id, label: c.name }));

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Rusak & Hilang" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Rusak & Hilang</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Rusak & Hilang</h1>
                </div>

                {errorMessages.length > 0 && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {errorMessages.map((m) => <p key={m}>{m}</p>)}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        visit({ page: undefined }, form);
                    }}
                    className={`${CARD} space-y-4`}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label htmlFor="filter-dari" className="mb-1.5 block text-sm font-medium text-slate-900">Dari Tanggal</label>
                            <input
                                id="filter-dari"
                                type="date"
                                value={form.dari ?? ''}
                                onChange={(e) => set('dari', e.target.value)}
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label htmlFor="filter-sampai" className="mb-1.5 block text-sm font-medium text-slate-900">Sampai Tanggal</label>
                            <input
                                id="filter-sampai"
                                type="date"
                                value={form.sampai ?? ''}
                                onChange={(e) => set('sampai', e.target.value)}
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label htmlFor="filter-kondisi" className="mb-1.5 block text-sm font-medium text-slate-900">Kondisi</label>
                            <select
                                id="filter-kondisi"
                                value={form.kondisi ?? ''}
                                onChange={(e) => set('kondisi', e.target.value)}
                                className={FIELD}
                            >
                                <option value="">Semua kondisi</option>
                                {kondisiOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-status" className="mb-1.5 block text-sm font-medium text-slate-900">Status</label>
                            <select
                                id="filter-status"
                                value={form.status ?? ''}
                                onChange={(e) => set('status', e.target.value)}
                                className={FIELD}
                            >
                                <option value="">Semua status</option>
                                {statusOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        {unitOptions.length > 1 && (
                            <div>
                                <label htmlFor="filter-unit" className="mb-1.5 block text-sm font-medium text-slate-900">Unit Kerja</label>
                                <select
                                    id="filter-unit"
                                    value={form.unit_id ?? ''}
                                    onChange={(e) => set('unit_id', e.target.value)}
                                    className={FIELD}
                                >
                                    <option value="">Semua unit kerja</option>
                                    {unitOpts.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="filter-category" className="mb-1.5 block text-sm font-medium text-slate-900">Kategori Aset</label>
                            <select
                                id="filter-category"
                                value={form.category_id ?? ''}
                                onChange={(e) => set('category_id', e.target.value)}
                                className={FIELD}
                            >
                                <option value="">Semua kategori aset</option>
                                {catOpts.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900 tabular-nums">{reports.total}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {reports.total > 0 && !dirty ? (
                                <a href={downloadUrl} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Stat label="Jumlah Laporan" value={ringkasan.jumlah_laporan.toLocaleString('id-ID')} note="Semua status" />
                    <Stat label="Laporan Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <Stat label="Nilai Perolehan Terdampak" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya laporan Disetujui" />
                    <Stat label="Nilai Buku Terdampak" value={rupiah(ringkasan.nilai_buku)} note="Hanya laporan Disetujui" />
                    <Stat
                        label="Rata-rata Lama Proses"
                        value={ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`}
                        note={ringkasan.terlama_proses !== null ? `Terlama: ${ringkasan.terlama_proses.toLocaleString('id-ID')} hari` : undefined}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Status</p>
                        <DonutChart
                            unit="laporan"
                            ariaLabel="Grafik komposisi laporan menurut status persetujuan"
                            data={status.map((s) => ({
                                label: s.label,
                                jumlah: s.jumlah,
                                persen: s.persen,
                                color: STATUS_COLOR[s.status] || '#94A3B8',
                            }))}
                        />
                        <Legend
                            unit="laporan"
                            items={status.map((s) => ({
                                label: s.label,
                                jumlah: s.jumlah,
                                persen: s.persen,
                                color: STATUS_COLOR[s.status] || '#94A3B8',
                            }))}
                        />
                    </div>
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Kondisi Insiden</p>
                        <DonutChart
                            unit="laporan"
                            ariaLabel="Grafik komposisi laporan menurut kondisi insiden"
                            data={kondisi.map((k) => ({
                                label: k.label,
                                jumlah: k.jumlah,
                                persen: k.persen,
                                color: KONDISI_COLOR[k.kondisi] || '#94A3B8',
                            }))}
                        />
                        <Legend
                            unit="laporan"
                            items={kondisi.map((k) => ({
                                label: k.label,
                                jumlah: k.jumlah,
                                persen: k.persen,
                                color: KONDISI_COLOR[k.kondisi] || '#94A3B8',
                            }))}
                        />
                    </div>
                </div>

                <div className={CARD}>
                    <p className="mb-1 text-lg font-semibold text-slate-900">Tren Insiden per Bulan</p>
                    <p className="mb-4 text-xs text-slate-500">Hanya laporan Disetujui, menurut tanggal kejadian.</p>
                    <TrenInsidenChart data={tren} />
                </div>

                {sebaranUnit && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Sebaran Insiden per Unit Kerja</p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className={TH}>Unit Kerja</th>
                                        <th className={`${TH} text-right`}>Rusak</th>
                                        <th className={`${TH} text-right`}>Hilang</th>
                                        <th className={`${TH} text-right`}>Total Insiden</th>
                                        <th className={`${TH} text-right`}>Nilai Buku Terdampak</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {sebaranUnit.baris.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada laporan yang disetujui.</td></tr>
                                    )}
                                    {sebaranUnit.baris.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-4 py-3 font-medium">{r.name}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{r.jumlah_rusak.toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{r.jumlah_hilang.toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.total.toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.nilai_buku)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                        <td className="px-4 py-3">Total</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{sebaranUnit.total.jumlah_rusak.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{sebaranUnit.total.jumlah_hilang.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{sebaranUnit.total.total.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{rupiah(sebaranUnit.total.nilai_buku)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <p className="text-lg font-semibold text-slate-900">Kinerja Persetujuan</p>
                        <p className="text-sm text-slate-600 tabular-nums">
                            Rata-rata {ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`}
                            {' · '}
                            Terlama {ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`}
                        </p>
                    </div>
                    <p className="px-5 pt-4 text-sm font-semibold text-slate-900">Masih Berjalan</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Nomor Laporan</th>
                                    <th className={TH}>Kondisi</th>
                                    <th className={TH}>Aset</th>
                                    <th className={TH}>Unit</th>
                                    <th className={TH}>Pemegang</th>
                                    <th className={TH}>Langkah</th>
                                    <th className={TH}>Menunggu</th>
                                    <th className={`${TH} text-right`}>Umur</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {masihBerjalan.length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tidak ada laporan yang masih berjalan.</td></tr>
                                )}
                                {masihBerjalan.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-3 font-medium tabular-nums">
                                            <Link href={m.url} className="text-blue-700 hover:underline">{m.nomor}</Link>
                                        </td>
                                        <td className="px-4 py-3">{m.kondisi_label}</td>
                                        <td className="px-4 py-3">{m.nama_aset ?? '—'}</td>
                                        <td className="px-4 py-3">{m.unit ?? '—'}</td>
                                        <td className="px-4 py-3">{m.pemegang ?? '—'}</td>
                                        <td className="px-4 py-3">{m.langkah ?? '—'}</td>
                                        <td className="px-4 py-3">{m.menunggu ?? '—'}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{m.umur_hari} hari</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} laporan yang masih berjalan.
                        </p>
                    )}
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Daftar Rinci</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>No</th>
                                    {COLUMNS.map((c) => (
                                        <th
                                            key={c.key}
                                            className={`${TH} ${c.align === 'right' ? 'text-right' : ''}`}
                                            aria-sort={c.sort && sort.urut === c.sort ? (sort.arah === 'asc' ? 'ascending' : 'descending') : undefined}
                                        >
                                            {c.sort ? (
                                                <button
                                                    type="button"
                                                    onClick={() => sortBy(c.sort as string)}
                                                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-blue-700"
                                                >
                                                    {c.label}
                                                    {sort.urut === c.sort && <span aria-hidden="true">{sort.arah === 'asc' ? '▲' : '▼'}</span>}
                                                </button>
                                            ) : (
                                                c.label
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {reports.data.length === 0 && (
                                    <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">Tidak ada laporan yang cocok.</td></tr>
                                )}
                                {reports.data.map((r, i) => (
                                    <Fragment key={r.id}>
                                        <tr
                                            className="cursor-pointer hover:bg-slate-50"
                                            onClick={() => setOpen(open === r.id ? null : r.id)}
                                        >
                                            <td className="px-4 py-3 tabular-nums">
                                                <button
                                                    type="button"
                                                    aria-expanded={open === r.id}
                                                    aria-label={`Detail ${r.nomor_laporan}`}
                                                    className="mr-2 text-slate-400 hover:text-blue-700"
                                                >
                                                    {open === r.id ? '▾' : '▸'}
                                                </button>
                                                {(reports.from ?? 1) + i}
                                            </td>
                                            <td className="px-4 py-3 font-medium tabular-nums">{r.nomor_laporan}</td>
                                            <td className="px-4 py-3 tabular-nums">{tanggal(r.tanggal_kejadian)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{r.nama_aset ?? '—'}</td>
                                            <td className="px-4 py-3">{r.kategori ?? '—'}</td>
                                            <td className="px-4 py-3">{r.unit ?? '—'}</td>
                                            <td className="px-4 py-3">{r.pemegang ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                {r.kondisi_baru ? (
                                                    <Badge
                                                        label={kondisiLabel[r.kondisi_baru] ?? r.kondisi_label ?? r.kondisi_baru}
                                                        style={KONDISI_BADGE[r.kondisi_baru] ?? 'bg-slate-100 text-slate-700'}
                                                    />
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.nilai_perolehan)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.nilai_buku)}</td>
                                            <td className="px-4 py-3">
                                                {r.status ? (
                                                    <Badge
                                                        label={statusLabel[r.status] ?? r.status_label ?? r.status}
                                                        style={STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-700'}
                                                    />
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                        {open === r.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={11} className="space-y-4 px-4 py-4">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase text-slate-500">Kronologi Kejadian</p>
                                                        <p className="whitespace-pre-line text-sm text-slate-900">{r.detail.kronologi ?? '—'}</p>
                                                    </div>

                                                    {r.detail.photos && r.detail.photos.length > 0 && (
                                                        <div>
                                                            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Foto Bukti Insiden</p>
                                                            <div className="flex flex-wrap gap-3">
                                                                {r.detail.photos.map((p) => (
                                                                    <a
                                                                        key={p.id}
                                                                        href={p.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="group block overflow-hidden rounded-lg border border-slate-200"
                                                                    >
                                                                        <img
                                                                            src={p.url}
                                                                            alt="Bukti insiden"
                                                                            className="h-24 w-24 object-cover transition-transform group-hover:scale-105"
                                                                        />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Riwayat Persetujuan</p>
                                                        {r.detail.riwayat_persetujuan.length === 0 ? (
                                                            <p className="text-sm text-slate-500">Belum ada aksi persetujuan.</p>
                                                        ) : (
                                                            <ol className="space-y-2 border-l border-slate-200 pl-4 text-sm">
                                                                {r.detail.riwayat_persetujuan.map((p, idx) => (
                                                                    <li key={idx}>
                                                                        <p className="font-medium text-slate-900">
                                                                            {p.action_label ?? p.action}{p.langkah ? ` — ${p.langkah}` : ''}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {p.user ?? '—'}
                                                                            {p.created_at && ` · ${p.created_at}`}
                                                                        </p>
                                                                        {p.note && <p className="text-xs text-slate-600">{p.note}</p>}
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{reports.from ?? 0}-{reports.to ?? 0}</span> dari{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">{reports.total}</span> laporan
                        </p>
                        {reports.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => visit({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === reports.current_page ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
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
