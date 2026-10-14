import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenMutasiChart from '@/Components/Charts/TrenMutasiChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportDate, ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { JENIS_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah, tanggalSingkat } from '@/lib/format';
import { MUTATION_STATUS_COLOR } from '@/lib/mutasi';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanMutasiData, LaporanMutasiRow, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type MasihBerjalan = LaporanMutasiData['masih_berjalan'][number];
type ArusRow = { id: string; asal: string; tujuan: string; jumlah_mutasi: number; aset: number; nilai: number };

const AKSI_LABEL: Record<string, string> = {
    approve: 'Disetujui',
    reject: 'Ditolak',
    cancel: 'Dibatalkan',
    reassign: 'Approver dialihkan',
};

const arusColumns: SummaryColumn<ArusRow>[] = [
    { key: 'asal', label: 'Unit Asal', isRowHeader: true, render: (r) => <span className="font-medium">{r.asal}</span> },
    { key: 'tujuan', label: 'Unit Tujuan', render: (r) => r.tujuan },
    { key: 'jumlah_mutasi', label: 'Mutasi', align: 'right', render: (r) => r.jumlah_mutasi.toLocaleString('id-ID') },
    { key: 'aset', label: 'Aset', align: 'right', render: (r) => r.aset.toLocaleString('id-ID') },
    { key: 'nilai', label: 'Nilai Perolehan', align: 'right', render: (r) => rupiah(r.nilai) },
];

const berjalanColumns: SummaryColumn<MasihBerjalan>[] = [
    {
        key: 'nomor',
        label: 'Nomor',
        isRowHeader: true,
        render: (m) => (
            <Link href={m.url} className="font-medium tabular-nums text-blue-700 hover:underline">
                {m.nomor}
            </Link>
        ),
    },
    { key: 'jenis', label: 'Jenis', render: (m) => m.jenis },
    { key: 'alur', label: 'Asal → Tujuan', render: (m) => `${m.asal} → ${m.tujuan}` },
    { key: 'langkah', label: 'Langkah', render: (m) => m.langkah ?? '—' },
    { key: 'menunggu', label: 'Menunggu', render: (m) => m.menunggu ?? '—' },
    { key: 'umur', label: 'Umur', align: 'right', render: (m) => `${m.umur_hari} hari` },
];

export default function Index(props: PageProps & LaporanMutasiData) {
    const { filters, sort, ringkasan, status, jenis, tren, arus, masih_berjalan: masihBerjalan, jumlah_masih_berjalan: jumlahBerjalan, mutasis, unitOptions, jenisOptions, statusOptions } = props;
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-mutasi.index', 'laporan-mutasi.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
    const unitOpts = unitOptions.map((u) => ({ value: u.id, label: u.name }));
    const statusItems = status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }));
    const jenisItems = jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }));
    const rataProses = ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`;
    const terlamaProses = ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`;

    const columns: DetailColumn<LaporanMutasiRow>[] = [
        { key: 'nomor', label: 'Nomor', sort: 'nomor_mutasi', render: (m) => <span className="font-medium tabular-nums">{m.nomor_mutasi}</span> },
        { key: 'tanggal', label: 'Tanggal', sort: 'tanggal_mutasi', render: (m) => <span className="tabular-nums">{tanggalSingkat(m.tanggal_mutasi)}</span> },
        { key: 'jenis', label: 'Jenis', render: (m) => m.jenis_label },
        { key: 'asal', label: 'Asal', render: (m) => m.asal },
        { key: 'tujuan', label: 'Tujuan', render: (m) => m.tujuan },
        { key: 'jumlah', label: 'Jumlah Aset', sort: 'jumlah_aset', align: 'right', render: (m) => m.jumlah_aset },
        { key: 'nilai', label: 'Nilai', sort: 'nilai', align: 'right', render: (m) => rupiah(m.nilai) },
        {
            key: 'status',
            label: 'Status',
            sort: 'status',
            render: (m) => (
                <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[m.status]} className="rounded-sm">
                    {statusLabel[m.status] ?? m.status}
                </Badge>
            ),
        },
        { key: 'pengaju', label: 'Pengaju', render: (m) => m.pengaju ?? '—' },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Mutasi" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Mutasi' }]} title="Laporan Mutasi" />

                <ReportFilterBar dirty={dirty} total={mutasis.total} downloadUrl={downloadUrl} onApply={apply}>
                    <ReportDate label="Dari tanggal" value={form.dari} onChange={(v) => set('dari', v)} />
                    <ReportDate label="Sampai tanggal" value={form.sampai} onChange={(v) => set('sampai', v)} />
                    <ReportSelect label="Jenis" allLabel="Semua jenis" value={form.jenis_mutasi} onChange={(v) => set('jenis_mutasi', v)} options={jenisOptions} />
                    <ReportSelect label="Status" allLabel="Semua status" value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
                    <ReportSelect label="Unit Asal" allLabel="Semua unit asal" value={form.asal_id} onChange={(v) => set('asal_id', v)} options={unitOpts} />
                    <ReportSelect label="Unit Tujuan" allLabel="Semua unit tujuan" value={form.tujuan_id} onChange={(v) => set('tujuan_id', v)} options={unitOpts} />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Jumlah Mutasi" value={ringkasan.jumlah_mutasi.toLocaleString('id-ID')} note="Semua status" />
                    <StatCard label="Mutasi Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <StatCard label="Aset Berpindah" value={ringkasan.aset_berpindah.toLocaleString('id-ID')} note="Hanya mutasi Disetujui" />
                    <StatCard label="Nilai Perolehan Aset Berpindah" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya mutasi Disetujui" />
                    <StatCard label="Rata-rata Lama Proses" value={rataProses} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Komposisi per Status">
                        <DonutChart unit="mutasi" ariaLabel="Grafik komposisi mutasi menurut status" data={statusItems} />
                        <ChartLegend unit="mutasi" items={statusItems} />
                    </ReportCard>
                    <ReportCard title="Komposisi per Jenis Mutasi">
                        <DonutChart unit="mutasi" ariaLabel="Grafik komposisi mutasi menurut jenis" data={jenisItems} />
                        <ChartLegend unit="mutasi" items={jenisItems} />
                    </ReportCard>
                </div>

                <ReportCard title="Tren Mutasi per Bulan" description="Hanya mutasi Disetujui, menurut tanggal mutasi.">
                    <TrenMutasiChart data={tren} />
                </ReportCard>

                <ReportCard title="Arus Antar Unit" flush>
                    <SummaryTable
                        ariaLabel="Arus mutasi antar unit"
                        columns={arusColumns}
                        rows={arus.baris.map((r) => ({ id: `${r.asal_id}-${r.tujuan_id}`, asal: r.asal, tujuan: r.tujuan, jumlah_mutasi: r.jumlah_mutasi, aset: r.aset, nilai: r.nilai }))}
                        total={{ id: '__total', asal: 'Total', tujuan: '', ...arus.total }}
                        emptyText="Belum ada mutasi yang disetujui."
                    />
                </ReportCard>

                <ReportCard
                    title="Kinerja Persetujuan"
                    flush
                    aside={
                        <p className="text-sm tabular-nums text-slate-600">
                            Rata-rata {rataProses} · Terlama {terlamaProses}
                        </p>
                    }
                >
                    <p className="px-5 pt-4 text-sm font-semibold text-slate-900">Masih Berjalan</p>
                    <SummaryTable ariaLabel="Mutasi yang masih berjalan" columns={berjalanColumns} rows={masihBerjalan} emptyText="Tidak ada mutasi yang masih berjalan." />
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} mutasi yang masih berjalan.
                        </p>
                    )}
                </ReportCard>

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci mutasi"
                        columns={columns}
                        rows={mutasis.data}
                        paginator={mutasis}
                        unit="mutasi"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(m) => m.nomor_mutasi}
                        emptyText="Tidak ada mutasi yang cocok."
                        renderDetail={(m) => (
                            <div className="space-y-4">
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
                                                        {AKSI_LABEL[p.aksi] ?? p.aksi}
                                                        {p.langkah ? ` — ${p.langkah}` : ''}
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
                            </div>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
