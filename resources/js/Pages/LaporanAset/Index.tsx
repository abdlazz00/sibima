import KondisiChart, { KONDISI_COLOR } from '@/Components/Charts/KondisiChart';
import TrenAsetChart from '@/Components/Charts/TrenAsetChart';
import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { rupiah } from '@/lib/format';
import { pageNumbersWithGaps } from '@/lib/pagination';
import { LaporanAsetData, PageProps, RekapTotals } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Fragment, useState } from 'react';

type Filters = Record<string, string | number | undefined>;

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

const KONDISI_BADGE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200',
    hilang: 'bg-gray-100 text-gray-600 border-gray-300',
};

const SORTABLE_COLUMNS: { key: string; label: string; sort?: string; align?: 'right' }[] = [
    { key: 'kode_barang', label: 'Kode Barang', sort: 'kode_barang' },
    { key: 'nomor_register', label: 'No. Register', sort: 'nomor_register' },
    { key: 'nama_aset', label: 'Nama / Merk', sort: 'nama_aset' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'unit', label: 'Unit' },
    { key: 'tahun', label: 'Tahun', sort: 'tanggal_perolehan' },
    { key: 'kondisi', label: 'Kondisi', sort: 'kondisi' },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right' },
    { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right' },
];

const clean = (data: Filters) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: Filters) =>
    JSON.stringify(Object.entries(clean(data)).map(([k, v]) => [k, String(v)]).sort());

function Badge({ label, style }: { label: string; style: string }) {
    return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        </div>
    );
}

function TotalsCells({ row, bold }: { row: RekapTotals; bold?: boolean }) {
    const cls = `px-4 py-3 text-right tabular-nums ${bold ? 'font-semibold' : ''}`;
    return (
        <>
            <td className={cls}>{row.jumlah.toLocaleString('id-ID')}</td>
            <td className={cls}>{rupiah(row.nilai_perolehan)}</td>
            <td className={cls}>{rupiah(row.nilai_buku)}</td>
        </>
    );
}

export default function Index(props: PageProps & LaporanAsetData) {
    const { filters, sort, ringkasan, kondisi, tren, rekap_kategori: rekapKategori, rekap_unit: rekapUnit, asets, units, categories, kondisiOptions } = props;
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    const [form, setForm] = useState<Filters>(filters);
    const [open, setOpen] = useState<number | null>(null);
    const dirty = signature(form) !== signature(filters);

    const visit = (extra: Filters, base: Filters = filters) =>
        router.get(route('laporan-aset.index'), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });

    const downloadUrl = `${route('laporan-aset.download')}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    const pages = pageNumbersWithGaps(asets.current_page, asets.last_page);

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span>Laporan</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Laporan Aset</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Aset</h1>
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
                        {units.length > 0 && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Unit</label>
                                <select value={form.unit_id ?? ''} onChange={(e) => set('unit_id', e.target.value)} className={FIELD}>
                                    <option value="">Semua unit</option>
                                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Kategori</label>
                            <select value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value)} className={FIELD}>
                                <option value="">Semua kategori</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Kondisi</label>
                            <select value={form.kondisi ?? ''} onChange={(e) => set('kondisi', e.target.value)} className={FIELD}>
                                <option value="">Semua kondisi</option>
                                {kondisiOptions.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="submit" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Terapkan filter
                        </button>
                        <div className="flex items-center gap-4">
                            <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                                <span className="font-semibold text-slate-900 tabular-nums">{asets.total}</span> baris akan diunduh
                                {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                            </p>
                            {asets.total > 0 && !dirty ? (
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Stat label="Jumlah Aset" value={ringkasan.jumlah.toLocaleString('id-ID')} />
                    <Stat label="Total Nilai Perolehan" value={rupiah(ringkasan.nilai_perolehan)} />
                    <Stat label="Total Nilai Buku" value={rupiah(ringkasan.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Persentase per Kondisi</p>
                        <KondisiChart data={kondisi} />
                        <ul className="mt-4 space-y-2 text-sm">
                            {kondisi.map((k) => (
                                <li key={k.kondisi} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-slate-800">
                                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: KONDISI_COLOR[k.kondisi] }} aria-hidden="true" />
                                        {KONDISI_LABEL[k.kondisi] ?? k.label}
                                    </span>
                                    <span className="tabular-nums text-slate-600">{k.jumlah.toLocaleString('id-ID')} aset · {k.persen.toLocaleString('id-ID')}%</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`${CARD} lg:col-span-2`}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Tren per Tahun Perolehan</p>
                        <TrenAsetChart data={tren} />
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Rekap per Kategori</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>Kategori</th>
                                    <th className={`${TH} text-right`}>Jumlah</th>
                                    <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                    <th className={`${TH} text-right`}>Nilai Buku</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {rekapKategori.grup.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Belum ada data.</td></tr>
                                )}
                                {rekapKategori.grup.map((g) => (
                                    <Fragment key={g.id}>
                                        <tr className="bg-slate-50/60">
                                            <td className="px-4 py-3 font-semibold">{g.nama}</td>
                                            <TotalsCells row={g} bold />
                                        </tr>
                                        {g.anak.map((a) => (
                                            <tr key={a.id}>
                                                <td className="py-3 pl-10 pr-4 text-slate-600">{a.nama}</td>
                                                <TotalsCells row={a} />
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                    <td className="px-4 py-3">Total</td>
                                    <TotalsCells row={rekapKategori.total} bold />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {rekapUnit && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Rekap per Unit</p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className={TH}>Unit</th>
                                        <th className={`${TH} text-right`}>Jumlah</th>
                                        <th className={`${TH} text-right`}>Nilai Perolehan</th>
                                        <th className={`${TH} text-right`}>Nilai Buku</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {rekapUnit.baris.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3 font-medium">{u.nama}</td>
                                            <TotalsCells row={u} />
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                                        <td className="px-4 py-3">Total</td>
                                        <TotalsCells row={rekapUnit.total} bold />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Daftar Rinci</p>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className={TH}>No</th>
                                    {SORTABLE_COLUMNS.map((c) => (
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
                                {asets.data.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Tidak ada aset yang cocok.</td></tr>
                                )}
                                {asets.data.map((a, i) => (
                                    <Fragment key={a.id}>
                                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                                            <td className="px-4 py-3 tabular-nums">
                                                <button type="button" aria-expanded={open === a.id} aria-label={`Detail ${a.nama_aset}`} className="mr-2 text-slate-400 hover:text-blue-700">
                                                    {open === a.id ? '▾' : '▸'}
                                                </button>
                                                {(asets.from ?? 1) + i}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums">{a.kode_barang}</td>
                                            <td className="px-4 py-3 tabular-nums">{a.nomor_register}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900">{a.nama_aset}</p>
                                                {a.merk_type && <p className="text-xs text-slate-500">{a.merk_type}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {a.kategori}
                                                {a.subkategori && <p className="text-xs text-slate-500">{a.subkategori}</p>}
                                            </td>
                                            <td className="px-4 py-3">{a.unit}</td>
                                            <td className="px-4 py-3 tabular-nums">{a.tahun_perolehan}</td>
                                            <td className="px-4 py-3"><Badge label={KONDISI_LABEL[a.kondisi] ?? a.kondisi} style={KONDISI_BADGE[a.kondisi]} /></td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(a.nilai_perolehan)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{rupiah(a.nilai_buku)}</td>
                                        </tr>
                                        {open === a.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={10} className="px-4 py-4">
                                                    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Pemegang</dt><dd className="text-slate-900">{a.detail.pemegang ?? '—'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Status</dt><dd className="text-slate-900">{a.detail.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">Sumber Perolehan</dt><dd className="text-slate-900">{a.detail.sumber_perolehan ?? '—'}</dd></div>
                                                        <div><dt className="text-xs font-semibold uppercase text-slate-500">No. Dokumen</dt><dd className="text-slate-900">{a.detail.no_dokumen ?? '—'}</dd></div>
                                                        <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-semibold uppercase text-slate-500">Keterangan</dt><dd className="whitespace-pre-line text-slate-900">{a.detail.keterangan ?? '—'}</dd></div>
                                                    </dl>
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
                            Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{asets.from ?? 0}-{asets.to ?? 0}</span> dari{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">{asets.total}</span> aset
                        </p>
                        {asets.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                {pages.map((page, idx) =>
                                    page === '...' ? (
                                        <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => visit({ page })}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${page === asets.current_page ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
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
