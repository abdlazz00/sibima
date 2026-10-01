import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const KONDISI_BAR: Record<string, string> = {
    baik: 'bg-emerald-500',
    rusak_ringan: 'bg-amber-500',
    rusak_berat: 'bg-red-500',
    hilang: 'bg-slate-500',
};

const EVENT_LABEL: Record<string, string> = {
    dibuat: 'Aset dicatat',
    diterima: 'Aset diterima',
    mutasi: 'Mutasi aset',
    laporan_rusak: 'Laporan rusak',
    laporan_hilang: 'Laporan hilang',
    serah_terima: 'Serah terima ke pegawai',
};

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className={CARD}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
    );
}

function Bar({ label, value, max, text, color = 'bg-blue-600' }: { label: string; value: number; max: number; text: string; color?: string }) {
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-800">{label}</span>
                <span className="shrink-0 text-xs text-slate-500">{text}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
            </div>
        </div>
    );
}

export default function Dashboard({ dashboard: d, auth }: DashboardProps) {
    const kondisiMax = Math.max(1, ...Object.values(d.per_kondisi));
    const kategoriMax = Math.max(1, ...d.per_kategori.map((k) => k.jumlah));

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

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
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Selamat datang, {auth.user?.name}. Anda login sebagai <strong>{auth.user?.roles?.[0]}</strong> di {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}.
                        </p>
                    </div>
                    {d.units.length > 0 && (
                        <select value={d.selected_unit_id ?? ''} onChange={(e) => filterUnit(e.target.value)} className={SELECT} aria-label="Filter unit">
                            <option value="">Semua unit</option>
                            {d.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Stat label="Total Aset" value={d.totals.jumlah_aset.toLocaleString('id-ID')} />
                    <Stat label="Nilai Perolehan" value={rupiah(d.totals.nilai_perolehan)} />
                    <Stat label="Nilai Buku" value={rupiah(d.totals.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {queue.map((q) => (
                        <Link key={q.label} href={q.href} className={`${CARD} block hover:border-blue-300`}>
                            <p className="text-3xl font-bold text-slate-900">{q.value}</p>
                            <p className="mt-1 text-sm text-slate-600">{q.label}</p>
                        </Link>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className={CARD}>
                        <p className="mb-4 text-base font-semibold text-slate-900">Aset per Kondisi</p>
                        <div className="space-y-3">
                            {Object.entries(d.per_kondisi).map(([k, n]) => (
                                <Bar key={k} label={KONDISI_LABEL[k] ?? k} value={n} max={kondisiMax} text={`${n} aset`} color={KONDISI_BAR[k]} />
                            ))}
                        </div>
                    </div>

                    <div className={CARD}>
                        <p className="mb-4 text-base font-semibold text-slate-900">Aset per Kategori</p>
                        {d.per_kategori.length === 0 ? (
                            <p className="text-sm text-slate-400">Belum ada aset.</p>
                        ) : (
                            <div className="space-y-3">
                                {d.per_kategori.map((k) => (
                                    <Bar key={k.id} label={k.nama} value={k.jumlah} max={kategoriMax} text={`${k.jumlah} aset · ${rupiah(k.nilai_buku)}`} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {d.per_unit && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <p className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Rekap per Unit</p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-3">Unit</th>
                                        <th className="px-4 py-3 text-right">Aset</th>
                                        {Object.keys(d.per_kondisi).map((k) => <th key={k} className="px-4 py-3 text-right">{KONDISI_LABEL[k] ?? k}</th>)}
                                        <th className="px-4 py-3 text-right">Nilai Buku</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {d.per_unit.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3 font-medium">{u.name}</td>
                                            <td className="px-4 py-3 text-right">{u.jumlah}</td>
                                            {Object.keys(d.per_kondisi).map((k) => <td key={k} className="px-4 py-3 text-right">{u.kondisi[k] ?? 0}</td>)}
                                            <td className="px-4 py-3 text-right">{rupiah(u.nilai_buku)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className={CARD}>
                    <p className="mb-4 text-base font-semibold text-slate-900">Aktivitas Terbaru</p>
                    {d.aktivitas.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada aktivitas.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {d.aktivitas.map((a) => (
                                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                                    <span>
                                        <span className="font-semibold text-slate-900">{a.aset ?? 'Aset'}</span>
                                        <span className="text-slate-600"> — {EVENT_LABEL[a.event] ?? a.event}</span>
                                        {a.pelaku && <span className="text-slate-500"> oleh {a.pelaku}</span>}
                                    </span>
                                    {a.waktu && (
                                        <span className="text-xs text-slate-500">
                                            {new Date(a.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
