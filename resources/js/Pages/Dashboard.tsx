import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

type Transaksi = DashboardData['transaksi'][number];

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const KONDISI_BAR: Record<string, string> = {
    baik: 'bg-emerald-600',
    rusak_ringan: 'bg-amber-600',
    rusak_berat: 'bg-red-600',
    hilang: 'bg-slate-500',
};

const STATUS_BADGE: Record<Transaksi['status'], { label: string; style: string }> = {
    berjalan: { label: 'Berjalan', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    selesai: { label: 'Selesai', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ditolak: { label: 'Ditolak', style: 'bg-red-50 text-red-700 border-red-200' },
    dibatalkan: { label: 'Dibatalkan', style: 'bg-gray-100 text-gray-600 border-gray-300' },
};

const JENIS_LABEL: Record<Transaksi['jenis'], string> = { mutasi: 'Mutasi', penerimaan: 'Penerimaan' };

const APPROVER_ROLES = ['kasubag', 'camat', 'lurah'];

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

function Bar({ label, value, max, text, color = 'bg-blue-600' }: { label: string; value: number; max: number; text: string; color?: string }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-800">{label}</span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{text}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-sm bg-slate-100">
                <div className={`h-full rounded-sm ${color}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
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
    const role = auth.user?.roles?.[0] ?? '';
    const isApprover = APPROVER_ROLES.includes(role);
    const total = d.totals.jumlah_aset;
    const baik = d.per_kondisi.baik;
    const bermasalah = d.per_kondisi.rusak_ringan + d.per_kondisi.rusak_berat + d.per_kondisi.hilang;
    const selectedUnit = d.units.find((u) => u.id === d.selected_unit_id);
    const scopeLabel = selectedUnit?.name ?? (d.units.length > 0 ? 'Seluruh cakupan' : (auth.user?.unit?.name ?? 'Seluruh unit'));

    const kategoriMax = Math.max(1, ...d.per_kategori.map((k) => k.jumlah));
    const kondisiMax = Math.max(1, ...Object.values(d.per_kondisi));
    const unitMax = Math.max(1, ...(d.per_unit ?? []).map((u) => u.jumlah));

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const actions: { label: string; href: string }[] = isApprover
        ? [
              { label: 'Kotak Persetujuan', href: route('persetujuan.index') },
              { label: 'Scan QR', href: route('scan.index') },
              { label: 'Data Aset', href: route('assets.index') },
              { label: 'Laporan', href: route('laporan-aset.index') },
          ]
        : [
              { label: 'Catat Aset', href: route('assets.create') },
              { label: 'Scan QR', href: route('scan.index') },
              { label: 'Buat Permohonan', href: route('asset-requests.create') },
              { label: 'Lapor Rusak/Hilang', href: route('asset-reports.create') },
          ];

    const queue: { label: string; value: number; href: string }[] = [
        { label: 'Persetujuan menunggu saya', value: d.antrean.persetujuan_menunggu, href: route('persetujuan.index') },
        { label: 'Permohonan menunggu pemenuhan', value: d.antrean.permohonan_menunggu_pemenuhan, href: '/asset-requests?menunggu_pemenuhan=1' },
        { label: 'Laporan rusak/hilang pending', value: d.antrean.laporan_pending, href: '/asset-reports?status=pending' },
        { label: 'Mutasi pending', value: d.antrean.mutasi_pending, href: '/asset-mutations' },
    ];

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

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {actions.map((a) => (
                        <Link key={a.label} href={a.href} className={ACTION}>{a.label}</Link>
                    ))}
                </div>

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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {queue.map((q) => (
                        <Link key={q.label} href={q.href} className={`${CARD} block hover:border-blue-300`}>
                            <p className="text-3xl font-bold text-slate-900 tabular-nums">{q.value}</p>
                            <p className="mt-1 text-sm text-slate-600">{q.label}</p>
                        </Link>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-lg font-semibold text-slate-900">Aset per Kategori</p>
                        {d.per_kategori.length === 0 ? (
                            <p className="text-sm text-slate-400">Belum ada aset.</p>
                        ) : (
                            <div className="space-y-3">
                                {d.per_kategori.map((k) => (
                                    <Bar key={k.id} label={k.nama} value={k.jumlah} max={kategoriMax} text={`${k.jumlah} aset`} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={CARD}>
                        {d.per_unit ? (
                            <>
                                <p className="mb-4 text-lg font-semibold text-slate-900">Sebaran Aset per Unit</p>
                                <div className="space-y-3">
                                    {d.per_unit.map((u) => (
                                        <Bar key={u.id} label={u.name} value={u.jumlah} max={unitMax} text={`${u.jumlah} aset`} />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="mb-4 text-lg font-semibold text-slate-900">Aset per Kondisi</p>
                                <div className="space-y-3">
                                    {Object.entries(d.per_kondisi).map(([k, n]) => (
                                        <Bar key={k} label={KONDISI_LABEL[k] ?? k} value={n} max={kondisiMax} text={`${n} aset`} color={KONDISI_BAR[k]} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">Transaksi Terbaru</p>
                    {d.transaksi.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada transaksi.</p>
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {d.transaksi.map((t) => (
                                        <tr key={`${t.jenis}-${t.nomor}`}>
                                            <td className="px-4 py-3">{JENIS_LABEL[t.jenis]}</td>
                                            <td className="px-4 py-3 font-medium tabular-nums">
                                                <Link href={t.url} className="text-blue-700 hover:underline">{t.nomor}</Link>
                                            </td>
                                            <td className="px-4 py-3">{t.ringkasan ?? '—'}</td>
                                            <td className="px-4 py-3 tabular-nums">{t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '—'}</td>
                                            <td className="px-4 py-3"><Badge {...STATUS_BADGE[t.status]} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <ul className="divide-y divide-slate-100 md:hidden">
                                {d.transaksi.map((t) => (
                                    <li key={`${t.jenis}-${t.nomor}`} className="space-y-1 px-5 py-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold uppercase text-slate-500">{JENIS_LABEL[t.jenis]}</span>
                                            <Badge {...STATUS_BADGE[t.status]} />
                                        </div>
                                        <Link href={t.url} className="block font-medium tabular-nums text-blue-700">{t.nomor}</Link>
                                        <p className="text-slate-600">{t.ringkasan ?? '—'}</p>
                                        <p className="text-xs text-slate-500 tabular-nums">{t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '—'}</p>
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
