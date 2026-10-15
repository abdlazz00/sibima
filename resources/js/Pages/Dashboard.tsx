import ChartLegend from '@/Components/ChartLegend';
import DonutChart, { DonutSlice } from '@/Components/Charts/DonutChart';
import KategoriAsetChart from '@/Components/Charts/KategoriAsetChart';
import SebaranUnitChart from '@/Components/Charts/SebaranUnitChart';
import TrenAktivitasChart from '@/Components/Charts/TrenAktivitasChart';
import ReportCard from '@/Components/ReportCard';
import StatCard from '@/Components/StatCard';
import { Table } from '@/Components/ui/application/table/table';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Select } from '@/Components/ui/base/select/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_COLOR } from '@/lib/chartColors';
import { rupiah, sapaan, tanggalLengkap, tanggalSingkat } from '@/lib/format';
import { Tone, TONE } from '@/lib/tone';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    BarChart01,
    BarChartSquare02,
    Bell01,
    Building01,
    CheckCircle,
    Inbox01,
    LineChartUp01,
    Package,
    PieChart01,
    PlusCircle,
    QrCode01,
    Send01,
    SwitchHorizontal01,
    Wallet02,
} from '@untitledui/icons';
import { ComponentType, useState } from 'react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

type Transaksi = DashboardData['transaksi'][number];
type TabKey = 'semua' | 'penerimaan' | 'mutasi' | 'rusak_hilang' | 'permohonan';

const ALL = '__all';

const STATUS_BADGE: Record<Transaksi['status'], { label: string; color: 'warning' | 'success' | 'error' | 'gray' }> = {
    berjalan: { label: 'Berjalan', color: 'warning' },
    selesai: { label: 'Selesai', color: 'success' },
    ditolak: { label: 'Ditolak', color: 'error' },
    dibatalkan: { label: 'Dibatalkan', color: 'gray' },
};

const JENIS_LABEL: Record<Transaksi['jenis'], string> = {
    mutasi: 'Mutasi',
    penerimaan: 'Penerimaan',
    rusak_hilang: 'Rusak / Hilang',
    permohonan: 'Permohonan',
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function StatusBadge({ status }: { status: Transaksi['status'] }) {
    return (
        <Badge type="color" size="sm" color={STATUS_BADGE[status].color} className="rounded-sm">
            {STATUS_BADGE[status].label}
        </Badge>
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
        { label: 'Baik', jumlah: d.per_kondisi.baik, persen: percent(d.per_kondisi.baik, total), color: KONDISI_COLOR.baik },
        { label: 'Rusak Ringan', jumlah: d.per_kondisi.rusak_ringan, persen: percent(d.per_kondisi.rusak_ringan, total), color: KONDISI_COLOR.rusak_ringan },
        { label: 'Rusak Berat', jumlah: d.per_kondisi.rusak_berat, persen: percent(d.per_kondisi.rusak_berat, total), color: KONDISI_COLOR.rusak_berat },
        { label: 'Hilang', jumlah: d.per_kondisi.hilang, persen: percent(d.per_kondisi.hilang, total), color: KONDISI_COLOR.hilang },
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
    const transaksiRows = filteredTransaksi.map((t) => ({ ...t, id: `${t.jenis}-${t.nomor}` }));

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const candidateActions: { label: string; href: string; permission: string; icon: ComponentType<{ className?: string }>; tone: Tone }[] = isApprover
        ? [
              { label: 'Kotak Persetujuan', href: route('persetujuan.index'), permission: 'persetujuan.view', icon: Inbox01, tone: 'violet' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view', icon: QrCode01, tone: 'teal' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view', icon: Package, tone: 'blue' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset', icon: BarChart01, tone: 'green' },
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create', icon: PlusCircle, tone: 'blue' },
          ]
        : [
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create', icon: PlusCircle, tone: 'blue' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view', icon: QrCode01, tone: 'teal' },
              { label: 'Buat Permohonan', href: route('asset-requests.create'), permission: 'permohonan.create', icon: Send01, tone: 'violet' },
              { label: 'Lapor Rusak/Hilang', href: route('asset-reports.create'), permission: 'laporan-insiden.create', icon: AlertTriangle, tone: 'green' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view', icon: Package, tone: 'blue' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset', icon: BarChart01, tone: 'green' },
          ];

    const actions = candidateActions.filter((a) => permissions.length === 0 || permissions.includes(a.permission)).slice(0, 4);

    const queueCandidates: { label: string; value: number; href: string; permission: string; icon: ComponentType<{ className?: string }>; tone: Tone }[] = [
        { label: 'Persetujuan menunggu saya', value: d.antrean.persetujuan_menunggu, href: route('persetujuan.index'), permission: 'persetujuan.view', icon: Inbox01, tone: 'amber' },
        { label: 'Permohonan menunggu pemenuhan', value: d.antrean.permohonan_menunggu_pemenuhan, href: '/asset-requests?menunggu_pemenuhan=1', permission: 'permohonan.view', icon: Send01, tone: 'blue' },
        { label: 'Laporan rusak/hilang pending', value: d.antrean.laporan_pending, href: '/asset-reports?status=pending', permission: 'laporan-insiden.view', icon: AlertTriangle, tone: 'red' },
        { label: 'Mutasi pending', value: d.antrean.mutasi_pending, href: '/asset-mutations', permission: 'mutasi.view', icon: SwitchHorizontal01, tone: 'violet' },
    ];

    const queue = queueCandidates.filter((q) => permissions.length === 0 || permissions.includes(q.permission));

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-950 p-6 text-white shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className="text-3xl font-bold leading-9 tracking-tight">
                                {sapaan()}, {auth.user?.name}
                            </h1>
                            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-blue-100">
                                <span>
                                    Login sebagai <strong className="text-white">{role}</strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{auth.user?.unit?.name ?? 'Kecamatan Sagulung'}</span>
                                <span aria-hidden="true">·</span>
                                <span>{tanggalLengkap()}</span>
                            </p>
                        </div>
                    {d.units.length > 0 && (
                        <div className="w-full sm:w-64">
                            <Select
                                aria-label="Filter unit"
                                size="md"
                                items={[{ id: ALL, label: 'Semua unit' }, ...d.units.map((u) => ({ id: String(u.id), label: u.name }))]}
                                selectedKey={d.selected_unit_id ? String(d.selected_unit_id) : ALL}
                                onSelectionChange={(key) => filterUnit(key === ALL ? '' : String(key))}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        </div>
                    )}
                    </div>
                </div>

                {isApprover && d.antrean.persetujuan_menunggu > 0 && (
                    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-3">
                            <Bell01 className="size-5 shrink-0 text-amber-700" aria-hidden="true" />
                            <p className="text-sm font-medium text-amber-900">
                                <span className="tabular-nums">{d.antrean.persetujuan_menunggu}</span> persetujuan menunggu Anda.
                            </p>
                        </div>
                        <Button color="primary" size="md" href={route('persetujuan.index')}>
                            Buka Kotak Persetujuan
                        </Button>
                    </div>
                )}

                {actions.length > 0 && (
                    <section aria-labelledby="pintasan">
                        <h2 id="pintasan" className="mb-3 text-xl font-semibold text-slate-900">
                            Pintasan
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {actions.map((a) => (
                                <Link
                                    key={a.label}
                                    href={a.href}
                                    className={`flex items-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold text-white shadow-md outline-hidden transition focus-visible:ring-2 focus-visible:ring-offset-2 ${TONE[a.tone].solid}`}
                                >
                                    <a.icon className="size-7 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0">{a.label}</span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Aset" value={total.toLocaleString('id-ID')} note={scopeLabel} icon={Package} tone="blue" />
                    <StatCard label="Total Nilai Aset" value={rupiah(d.totals.nilai_perolehan)} note={`Nilai buku ${rupiah(d.totals.nilai_buku)}`} icon={Wallet02} tone="teal" />
                    <StatCard
                        label="Aset Kondisi Baik"
                        icon={CheckCircle}
                        tone="green"
                        value={baik.toLocaleString('id-ID')}
                        badge={
                            <Badge type="color" size="sm" color="success" className="rounded-sm">
                                {percent(baik, total)}% dari total
                            </Badge>
                        }
                    />
                    <StatCard
                        label="Aset Rusak / Hilang"
                        icon={AlertTriangle}
                        tone="red"
                        value={bermasalah.toLocaleString('id-ID')}
                        badge={
                            <Badge type="color" size="sm" color="error" className="rounded-sm">
                                {percent(bermasalah, total)}% dari total
                            </Badge>
                        }
                    />
                </div>

                {queue.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {queue.map((q) => (
                            <Link
                                key={q.label}
                                href={q.href}
                                className={`flex items-center gap-4 rounded-xl border p-5 shadow-xs outline-hidden transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${TONE[q.tone].card}`}
                            >
                                <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${TONE[q.tone].chip}`}>
                                    <q.icon className="size-6" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-3xl font-bold tabular-nums ${TONE[q.tone].value}`}>{q.value}</span>
                                    <span className="block text-sm font-medium text-slate-700">{q.label}</span>
                                </span>
                                <ArrowRight className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
                            </Link>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Proporsi Kondisi Aset" icon={PieChart01} tone="blue" aside={<span className="text-sm tabular-nums text-slate-600">{total} total aset</span>}>
                        <DonutChart data={kondisiSlices} ariaLabel="Grafik proporsi kondisi fisik aset" unit="aset" />
                        <ChartLegend unit="aset" items={kondisiSlices} />
                    </ReportCard>

                    <ReportCard
                        title="Aset per Kategori"
                        icon={BarChartSquare02}
                        tone="violet"
                        aside={
                            <Button color="link-color" size="sm" iconTrailing={ArrowRight} href={route('assets.index')}>
                                Lihat Semua
                            </Button>
                        }
                    >
                        <KategoriAsetChart data={d.per_kategori} />
                    </ReportCard>

                    <ReportCard title="Sebaran Aset per Unit" icon={Building01} tone="teal" aside={<span className="text-sm text-slate-600">Kondisi fisik</span>}>
                        <SebaranUnitChart data={d.per_unit} />
                    </ReportCard>

                    <ReportCard title="Tren Aktivitas (6 Bulan Terakhir)" icon={LineChartUp01} tone="green" aside={<span className="text-sm text-slate-600">Volume transaksi</span>}>
                        <TrenAktivitasChart data={d.tren_aktivitas} />
                    </ReportCard>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <h2 className="px-5 pt-4 text-lg font-semibold text-slate-900">Aktivitas Transaksi Terbaru</h2>

                    <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as TabKey)} keyboardActivation="automatic">
                        <Tabs.List type="underline" size="sm" className="mt-3 px-5" aria-label="Jenis transaksi">
                            {tabs.map((tab) => (
                                <Tabs.Item key={tab.key} id={tab.key} label={tab.label} badge={String(tabCounts[tab.key])} />
                            ))}
                        </Tabs.List>

                        <Tabs.Panel id={activeTab}>
                            {transaksiRows.length === 0 ? (
                                <p className="px-5 py-10 text-center text-sm text-slate-400">
                                    {activeTab === 'semua'
                                        ? 'Belum ada transaksi.'
                                        : `Belum ada transaksi ${tabs.find((t) => t.key === activeTab)?.label ?? ''} terbaru.`}
                                </p>
                            ) : (
                                <>
                                    <div className="hidden md:block">
                                        <Table aria-label="Aktivitas transaksi terbaru" size="sm">
                                            <Table.Header>
                                                <Table.Head id="jenis" label="Jenis" />
                                                <Table.Head id="nomor" label="Nomor" isRowHeader />
                                                <Table.Head id="ringkasan" label="Ringkasan" />
                                                <Table.Head id="tanggal" label="Tanggal" />
                                                <Table.Head id="status" label="Status" />
                                                <Table.Head id="aksi" label="Aksi" />
                                            </Table.Header>
                                            <Table.Body items={transaksiRows}>
                                                {(t) => (
                                                    <Table.Row id={t.id}>
                                                        <Table.Cell>
                                                            <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                                {JENIS_LABEL[t.jenis]}
                                                            </Badge>
                                                        </Table.Cell>
                                                        <Table.Cell className="whitespace-nowrap font-medium tabular-nums">
                                                            <Link href={t.url} className="text-blue-700 hover:underline">
                                                                {t.nomor}
                                                            </Link>
                                                        </Table.Cell>
                                                        <Table.Cell className="text-slate-700">{t.ringkasan ?? '—'}</Table.Cell>
                                                        <Table.Cell className="whitespace-nowrap tabular-nums text-slate-500">{tanggalSingkat(t.tanggal)}</Table.Cell>
                                                        <Table.Cell>
                                                            <StatusBadge status={t.status} />
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Button color="secondary-brand" size="sm" href={t.url}>
                                                                Detail
                                                            </Button>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table>
                                    </div>

                                    <ul className="divide-y divide-slate-100 md:hidden">
                                        {transaksiRows.map((t) => (
                                            <li key={t.id} className="space-y-1.5 px-5 py-3 text-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                        {JENIS_LABEL[t.jenis]}
                                                    </Badge>
                                                    <StatusBadge status={t.status} />
                                                </div>
                                                <Link href={t.url} className="block font-semibold tabular-nums text-blue-700">
                                                    {t.nomor}
                                                </Link>
                                                <p className="text-slate-600">{t.ringkasan ?? '—'}</p>
                                                <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                                                    <span className="tabular-nums">{tanggalSingkat(t.tanggal)}</span>
                                                    <Link href={t.url} className="font-semibold text-blue-700 hover:underline">
                                                        Lihat Detail &rarr;
                                                    </Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </Tabs.Panel>
                    </Tabs>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
