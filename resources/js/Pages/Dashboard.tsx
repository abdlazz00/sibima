import DonutChart, { DonutSlice } from '@/Components/Charts/DonutChart';
import KategoriAsetChart from '@/Components/Charts/KategoriAsetChart';
import SebaranUnitChart from '@/Components/Charts/SebaranUnitChart';
import TrenAktivitasChart from '@/Components/Charts/TrenAktivitasChart';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

type Transaksi = DashboardData['transaksi'][number];
type TabKey = 'semua' | 'penerimaan' | 'mutasi' | 'rusak_hilang' | 'permohonan';

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<Transaksi['status'], { label: string; style: string }> = {
    berjalan: { label: 'Berjalan', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    selesai: { label: 'Selesai', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ditolak: { label: 'Ditolak', style: 'bg-red-50 text-red-700 border-red-200' },
    dibatalkan: { label: 'Dibatalkan', style: 'bg-gray-100 text-gray-600 border-gray-300' },
};

const JENIS_LABEL: Record<Transaksi['jenis'], string> = {
    mutasi: 'Mutasi',
    penerimaan: 'Penerimaan',
    rusak_hilang: 'Rusak / Hilang',
    permohonan: 'Permohonan',
};

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const SELECT = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const ACTION = 'flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-700';

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function Badge({ label, style }: { label: string; style: string }) {
    return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function Kpi({ label, value, caption, badge }: { label: string; value: string; caption?: string; badge?: { label: string; style: string } }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            <div className="mt-2 flex min-h-[22px] items-center gap-2 text-xs text-slate-500">
                {badge && <Badge {...badge} />}
                {caption && <span className="tabular-nums">{caption}</span>}
            </div>
        </div>
    );
}

function BellIcon() {
    return (
        <svg className="h-5 w-5 shrink-0 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    );
}

export default function Dashboard({ dashboard: d, auth }: DashboardProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('semua');

    const role = auth.user?.roles?.[0] ?? '';
    const permissions = auth.user?.permissions ?? [];
    const isApprover = permissions.includes('persetujuan.act');
    const total = d.totals.jumlah_aset;
    const baik = d.per_kondisi.baik;
    const bermasalah = d.per_kondisi.rusak_ringan + d.per_kondisi.rusak_berat + d.per_kondisi.hilang;
    const selectedUnit = d.units.find((u) => u.id === d.selected_unit_id);
    const scopeLabel = selectedUnit?.name ?? (d.units.length > 0 ? 'Seluruh cakupan' : (auth.user?.unit?.name ?? 'Seluruh unit'));

    const kondisiSlices: DonutSlice[] = [
        { label: 'Baik', jumlah: d.per_kondisi.baik, persen: percent(d.per_kondisi.baik, total), color: '#047857' },
        { label: 'Rusak Ringan', jumlah: d.per_kondisi.rusak_ringan, persen: percent(d.per_kondisi.rusak_ringan, total), color: '#B45309' },
        { label: 'Rusak Berat', jumlah: d.per_kondisi.rusak_berat, persen: percent(d.per_kondisi.rusak_berat, total), color: '#B91C1C' },
        { label: 'Hilang', jumlah: d.per_kondisi.hilang, persen: percent(d.per_kondisi.hilang, total), color: '#4B5563' },
    ];

    const tabCounts: Record<TabKey, number> = {
        semua: d.transaksi.length,
        penerimaan: d.transaksi.filter((t) => t.jenis === 'penerimaan').length,
        mutasi: d.transaksi.filter((t) => t.jenis === 'mutasi').length,
        rusak_hilang: d.transaksi.filter((t) => t.jenis === 'rusak_hilang').length,
        permohonan: d.transaksi.filter((t) => t.jenis === 'permohonan').length,
    };

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'semua', label: 'Semua' },
        { key: 'penerimaan', label: 'Penerimaan' },
        { key: 'mutasi', label: 'Mutasi' },
        { key: 'rusak_hilang', label: 'Rusak & Hilang' },
        { key: 'permohonan', label: 'Permohonan' },
    ];

    const filteredTransaksi = activeTab === 'semua' ? d.transaksi : d.transaksi.filter((t) => t.jenis === activeTab);

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const candidateActions: { label: string; href: string; permission: string }[] = isApprover
        ? [
              { label: 'Kotak Persetujuan', href: route('persetujuan.index'), permission: 'persetujuan.view' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset' },
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create' },
          ]
        : [
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view' },
              { label: 'Buat Permohonan', href: route('asset-requests.create'), permission: 'permohonan.create' },
              { label: 'Lapor Rusak/Hilang', href: route('asset-reports.create'), permission: 'laporan-insiden.create' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset' },
          ];

    const actions = candidateActions
        .filter((a) => permissions.length === 0 || permissions.includes(a.permission))
        .slice(0, 4);

    const queueCandidates: { label: string; value: number; href: string; permission: string }[] = [
        { label: 'Persetujuan menunggu saya', value: d.antrean.persetujuan_menunggu, href: route('persetujuan.index'), permission: 'persetujuan.view' },
        { label: 'Permohonan menunggu pemenuhan', value: d.antrean.permohonan_menunggu_pemenuhan, href: '/asset-requests?menunggu_pemenuhan=1', permission: 'permohonan.view' },
        { label: 'Laporan rusak/hilang pending', value: d.antrean.laporan_pending, href: '/asset-reports?status=pending', permission: 'laporan-insiden.view' },
        { label: 'Mutasi pending', value: d.antrean.mutasi_pending, href: '/asset-mutations', permission: 'mutasi.view' },
    ];

    const queue = queueCandidates.filter(
        (q) => permissions.length === 0 || permissions.includes(q.permission),
    );

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-[32px] font-bold leading-10 tracking-tight text-slate-900">Dashboard</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span>Selamat datang, {auth.user?.name}. Anda login sebagai <strong>{role}</strong> di</span>
                            <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}
                            </span>
                        </p>
                    </div>
                    {d.units.length > 0 && (
                        <select value={d.selected_unit_id ?? ''} onChange={(e) => filterUnit(e.target.value)} className={SELECT} aria-label="Filter unit">
                            <option value="">Semua unit</option>
                            {d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                </div>

                {isApprover && d.antrean.persetujuan_menunggu > 0 && (
                    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-3">
                            <BellIcon />
                            <p className="text-sm font-medium text-amber-900">
                                <span className="tabular-nums">{d.antrean.persetujuan_menunggu}</span> persetujuan menunggu Anda.
                            </p>
                        </div>
                        <Link href={route('persetujuan.index')} className="rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                            Buka Kotak Persetujuan
                        </Link>
                    </div>
                )}

                {actions.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {actions.map((a) => (
                            <Link key={a.label} href={a.href} className={ACTION}>{a.label}</Link>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi label="Total Aset" value={total.toLocaleString('id-ID')} caption={scopeLabel} />
                    <Kpi label="Total Nilai Aset" value={rupiah(d.totals.nilai_perolehan)} caption={`Nilai buku ${rupiah(d.totals.nilai_buku)}`} />
                    <Kpi
                        label="Aset Kondisi Baik"
                        value={baik.toLocaleString('id-ID')}
                        badge={{ label: `${percent(baik, total)}% dari total`, style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }}
                    />
                    <Kpi
                        label="Aset Rusak / Hilang"
                        value={bermasalah.toLocaleString('id-ID')}
                        badge={{ label: `${percent(bermasalah, total)}% dari total`, style: 'bg-red-50 text-red-700 border-red-200' }}
                    />
                </div>

                {queue.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {queue.map((q) => (
                            <Link key={q.label} href={q.href} className={`${CARD} block hover:border-blue-300`}>
                                <p className="text-3xl font-bold text-slate-900 tabular-nums">{q.value}</p>
                                <p className="mt-1 text-sm text-slate-600">{q.label}</p>
                            </Link>
                        ))}
                    </div>
                )}

                {/* 2x2 Interactive Charts Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* 1. Proporsi Kondisi Aset */}
                    <div className={CARD}>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">Proporsi Kondisi Aset</h2>
                            <span className="text-xs text-slate-500 tabular-nums">{total} total aset</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <DonutChart data={kondisiSlices} ariaLabel="Grafik proporsi kondisi fisik aset" unit="aset" />
                            <div className="mt-4 grid w-full grid-cols-2 gap-2 text-xs">
                                {kondisiSlices.map((s) => (
                                    <div key={s.label} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                                            <span className="truncate font-medium text-slate-600">{s.label}</span>
                                        </div>
                                        <span className="ml-1 shrink-0 font-semibold tabular-nums text-slate-900">{s.jumlah} ({s.persen}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. Top Kategori Aset */}
                    <div className={CARD}>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">Aset per Kategori</h2>
                            <Link href={route('assets.index')} className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                                Lihat Semua &rarr;
                            </Link>
                        </div>
                        <KategoriAsetChart data={d.per_kategori} />
                    </div>

                    {/* 3. Sebaran Aset per Unit */}
                    <div className={CARD}>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">Sebaran Aset per Unit</h2>
                            <span className="text-xs text-slate-500">Kondisi fisik</span>
                        </div>
                        <SebaranUnitChart data={d.per_unit} />
                    </div>

                    {/* 4. Tren Transaksi 6 Bulan */}
                    <div className={CARD}>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">Tren Aktivitas (6 Bulan Terakhir)</h2>
                            <span className="text-xs text-slate-500">Volume transaksi</span>
                        </div>
                        <TrenAktivitasChart data={d.tren_aktivitas} />
                    </div>
                </div>

                {/* Tabbed Activity Feed */}
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 pt-4">
                        <h2 className="text-lg font-semibold text-slate-900">Aktivitas Transaksi Terbaru</h2>
                        <div className="mt-3 -mb-px flex flex-wrap gap-2 sm:gap-6">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.key;
                                const count = tabCounts[tab.key];
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 border-b-2 py-2.5 text-sm transition-colors ${
                                            isActive
                                                ? 'border-blue-600 font-semibold text-blue-600'
                                                : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                                                isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {filteredTransaksi.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-slate-400">
                            {activeTab === 'semua'
                                ? 'Belum ada transaksi.'
                                : `Belum ada transaksi ${tabs.find((t) => t.key === activeTab)?.label ?? ''} terbaru.`}
                        </p>
                    ) : (
                        <>
                            <table className="hidden w-full border-collapse text-left text-sm md:table">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-3">Jenis</th>
                                        <th className="px-4 py-3">Nomor</th>
                                        <th className="px-4 py-3">Ringkasan</th>
                                        <th className="px-4 py-3">Tanggal</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {filteredTransaksi.map((t) => (
                                        <tr key={`${t.jenis}-${t.nomor}`} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                    {JENIS_LABEL[t.jenis]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium tabular-nums">
                                                <Link href={t.url} className="text-blue-700 hover:underline">
                                                    {t.nomor}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{t.ringkasan ?? '—'}</td>
                                            <td className="px-4 py-3 tabular-nums text-slate-500">
                                                {t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge {...STATUS_BADGE[t.status]} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={t.url}
                                                    className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                                                >
                                                    Detail &rarr;
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <ul className="divide-y divide-slate-100 md:hidden">
                                {filteredTransaksi.map((t) => (
                                    <li key={`${t.jenis}-${t.nomor}`} className="space-y-1.5 px-5 py-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                {JENIS_LABEL[t.jenis]}
                                            </span>
                                            <Badge {...STATUS_BADGE[t.status]} />
                                        </div>
                                        <Link href={t.url} className="block font-semibold tabular-nums text-blue-700">
                                            {t.nomor}
                                        </Link>
                                        <p className="text-slate-600">{t.ringkasan ?? '—'}</p>
                                        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                                            <span className="tabular-nums">
                                                {t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '—'}
                                            </span>
                                            <Link href={t.url} className="font-semibold text-blue-700 hover:underline">
                                                Lihat Detail &rarr;
                                            </Link>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
