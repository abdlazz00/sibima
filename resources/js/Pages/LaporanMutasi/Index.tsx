import DonutChart from '@/Components/Charts/DonutChart';
import TrenMutasiChart from '@/Components/Charts/TrenMutasiChart';
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { JENIS_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { LaporanMutasiData, PageProps } from '@/types';
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

const AKSI_LABEL: Record<string, string> = {
    approve: 'Disetujui',
    reject: 'Ditolak',
    cancel: 'Dibatalkan',
    reassign: 'Approver dialihkan',
};

const COLUMNS: { key: string; label: string; sort?: string; align?: 'right' }[] = [
    { key: 'nomor', label: 'Nomor', sort: 'nomor_mutasi' },
    { key: 'tanggal', label: 'Tanggal', sort: 'tanggal_mutasi' },
    { key: 'jenis', label: 'Jenis' },
    { key: 'asal', label: 'Asal' },
    { key: 'tujuan', label: 'Tujuan' },
    { key: 'jumlah', label: 'Jumlah Aset', sort: 'jumlah_aset', align: 'right' },
    { key: 'nilai', label: 'Nilai', sort: 'nilai', align: 'right' },
    { key: 'status', label: 'Status', sort: 'status' },
    { key: 'pengaju', label: 'Pengaju' },
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

function Legend({ items }: { items: { label: string; jumlah: number; persen: number; color: string }[] }) {
    return (
        <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-800">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
                        {i.label}
                    </span>
                    <span className="tabular-nums text-slate-600">{i.jumlah.toLocaleString('id-ID')} mutasi · {i.persen.toLocaleString('id-ID')}%</span>
                </li>
            ))}
        </ul>
    );
}

export default function Index(props: PageProps & LaporanMutasiData) {
    const { filters, sort, ringkasan, status, jenis, tren, arus, masih_berjalan: masihBerjalan, jumlah_masih_berjalan: jumlahBerjalan, mutasis, unitOptions, jenisOptions, statusOptions } = props;
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    const [form, setForm] = useState<Filters>(filters);
    const [open, setOpen] = useState<number | null>(null);
    const dirty = signature(form) !== signature(filters);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));

    const visit = (extra: Filters, base: Filters = filters) =>
        router.get(route('laporan-mutasi.index'), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });

    const downloadUrl = `${route('laporan-mutasi.download')}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const pages = pageNumbersWithGaps(mutasis.current_page, mutasis.last_page);

    const select = (key: string, label: string, options: { value: string | number; label: string }[], placeholder: string) => (
        <div>
            <label htmlFor={`filter-${key}`} className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <select id={`filter-${key}`} value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD}>
                <option value="">{placeholder}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );

    const date = (key: string, label: string) => (
        <div>
            <label htmlFor={`filter-${key}`} className="mb-1.5 block text-sm font-medium text-slate-900">{label}</label>
            <input id={`filter-${key}`} type="date" value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className={FIELD} />
        </div>
    );

    const unitOpts = unitOptions.map((u) => ({ value: u.id, label: u.name }));

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Mutasi" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Mutasi</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Mutasi</h1>
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
                        {date('dari', 'Dari tanggal')}
                        {date('sampai', 'Sampai tanggal')}
                        {select('jenis_mutasi', 'Jenis', jenisOptions, 'Semua jenis')}
                        {select('status', 'Status', statusOptions, 'Semua status')}
                        {select('asal_id', 'Unit Asal', unitOpts, 'Semua unit asal')}
                        {select('tujuan_id', 'Unit Tujuan', unitOpts, 'Semua unit tujuan')}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900 tabular-nums">{mutasis.total}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {mutasis.total > 0 && !dirty ? (
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
                    <Stat label="Jumlah Mutasi" value={ringkasan.jumlah_mutasi.toLocaleString('id-ID')} note="Semua status" />
                    <Stat label="Mutasi Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <Stat label="Aset Berpindah" value={ringkasan.aset_berpindah.toLocaleString('id-ID')} note="Hanya mutasi Disetujui" />
                    <Stat label="Nilai Perolehan Aset Berpindah" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya mutasi Disetujui" />
                    <Stat label="Rata-rata Lama Proses" value={ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Status</p>
                        <DonutChart
                            unit="mutasi"
                            ariaLabel="Grafik komposisi mutasi menurut status"
                            data={status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }))}
                        />
                        <Legend items={status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }))} />
                    </div>
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Komposisi per Jenis Mutasi</p>
                        <DonutChart
                            unit="mutasi"
                            ariaLabel="Grafik komposisi mutasi menurut jenis"
                            data={jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }))}
                        />
                        <Legend items={jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }))} />
                    </div>
                </div>

                <div className={CARD}>
                    <p className="mb-1 text-lg font-semibold text-slate-900">Tren Mutasi per Bulan</p>
                    <p className="mb-4 text-xs text-slate-500">Hanya mutasi Disetujui, menurut tanggal mutasi.</p>
                    <TrenMutasiChart data={tren} />
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Arus Antar Unit</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Unit Asal</th>
                                    <th className={TH}>Unit Tujuan</th>
                                    <th className={`${TH} text-right`}>Mutasi</th>
                                    <th className={`${TH} text-right`}>Aset</th>
                                    <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {arus.baris.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada mutasi yang disetujui.</td></tr>
                                )}
                                {arus.baris.map((r) => (
                                    <tr key={`${r.asal_id}-${r.tujuan_id}`}>
                                        <td className="px-4 py-3 font-medium">{r.asal}</td>
                                        <td className="px-4 py-3">{r.tujuan}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.jumlah_mutasi.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.aset.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.nilai)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                    <td className="px-4 py-3" colSpan={2}>Total</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{arus.total.jumlah_mutasi.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{arus.total.aset.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{rupiah(arus.total.nilai)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

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
                                    <th className={TH}>Nomor</th>
                                    <th className={TH}>Jenis</th>
                                    <th className={TH}>Asal → Tujuan</th>
                                    <th className={TH}>Langkah</th>
                                    <th className={TH}>Menunggu</th>
                                    <th className={`${TH} text-right`}>Umur</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {masihBerjalan.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Tidak ada mutasi yang masih berjalan.</td></tr>
                                )}
                                {masihBerjalan.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-3 font-medium tabular-nums">
                                            <Link href={m.url} className="text-blue-700 hover:underline">{m.nomor}</Link>
                                        </td>
                                        <td className="px-4 py-3">{m.jenis}</td>
                                        <td className="px-4 py-3">{m.asal} → {m.tujuan}</td>
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
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} mutasi yang masih berjalan.
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
                                                <button type="button" onClick={() => sortBy(c.sort as string)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-blue-700">
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
                                {mutasis.data.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Tidak ada mutasi yang cocok.</td></tr>
                                )}
                                {mutasis.data.map((m, i) => (
                                    <Fragment key={m.id}>
                                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === m.id ? null : m.id)}>
                                            <td className="px-4 py-3 tabular-nums">
                                                <button type="button" aria-expanded={open === m.id} aria-label={`Detail ${m.nomor_mutasi}`} className="mr-2 text-slate-400 hover:text-blue-700">
                                                    {open === m.id ? '▾' : '▸'}
                                                </button>
                                                {(mutasis.from ?? 1) + i}
                                            </td>
                                            <td className="px-4 py-3 font-medium tabular-nums">{m.nomor_mutasi}</td>
                                            <td className="px-4 py-3 tabular-nums">{tanggal(m.tanggal_mutasi)}</td>
                                            <td className="px-4 py-3">{m.jenis_label}</td>
                                            <td className="px-4 py-3">{m.asal}</td>
                                            <td className="px-4 py-3">{m.tujuan}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{m.jumlah_aset}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(m.nilai)}</td>
                                            <td className="px-4 py-3"><Badge label={statusLabel[m.status] ?? m.status} style={STATUS_BADGE[m.status]} /></td>
                                            <td className="px-4 py-3">{m.pengaju ?? '—'}</td>
                                        </tr>
                                        {open === m.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={10} className="space-y-4 px-4 py-4">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase text-slate-500">Keterangan</p>
                                                        <p className="whitespace-pre-line text-sm text-slate-900">{m.detail.keterangan ?? '—'}</p>
                                                    </div>

                                                    <div>
                                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Aset yang dimutasi</p>
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                            <table className="w-full border-collapse text-left text-xs">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                                        <th className="px-3 py-2">Kode Barang</th>
                                                                        <th className="px-3 py-2">Nama Aset</th>
                                                                        <th className="px-3 py-2">Kategori</th>
                                                                        <th className="px-3 py-2">Kondisi</th>
                                                                        <th className="px-3 py-2 text-right">Nilai</th>
                                                                        <th className="px-3 py-2">Pemegang Tujuan</th>
                                                                        <th className="px-3 py-2">Catatan</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                                                    {m.detail.aset.map((a, idx) => (
                                                                        <tr key={`${a.kode_barang}-${idx}`}>
                                                                            <td className="px-3 py-2 tabular-nums">{a.kode_barang ?? '—'}</td>
                                                                            <td className="px-3 py-2 font-medium">{a.nama_aset ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.kategori ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.kondisi ? (KONDISI_LABEL[a.kondisi] ?? a.kondisi) : '—'}</td>
                                                                            <td className="px-3 py-2 text-right tabular-nums">{rupiah(a.nilai_perolehan)}</td>
                                                                            <td className="px-3 py-2">{a.pemegang_tujuan ?? '—'}</td>
                                                                            <td className="px-3 py-2">{a.catatan ?? '—'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Riwayat persetujuan</p>
                                                        {m.detail.persetujuan.length === 0 ? (
                                                            <p className="text-sm text-slate-500">Belum ada aksi persetujuan.</p>
                                                        ) : (
                                                            <ol className="space-y-2 border-l border-slate-200 pl-4 text-sm">
                                                                {m.detail.persetujuan.map((p, idx) => (
                                                                    <li key={idx}>
                                                                        <p className="font-medium text-slate-900">
                                                                            {AKSI_LABEL[p.aksi] ?? p.aksi}{p.langkah ? ` — ${p.langkah}` : ''}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {p.oleh ?? '—'}
                                                                            {p.waktu && ` · ${new Date(p.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`}
                                                                        </p>
                                                                        {p.catatan && <p className="text-xs text-slate-600">{p.catatan}</p>}
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
                            Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{mutasis.from ?? 0}-{mutasis.to ?? 0}</span> dari{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">{mutasis.total}</span> mutasi
                        </p>
                        {mutasis.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => visit({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === mutasis.current_page ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
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
