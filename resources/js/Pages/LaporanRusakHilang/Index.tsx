import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenInsidenChart from '@/Components/Charts/TrenInsidenChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportDate, ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR } from '@/lib/assetReport';
import { KONDISI_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah, tanggalSingkat } from '@/lib/format';
import { MUTATION_STATUS_COLOR } from '@/lib/mutasi';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanRusakHilangData, LaporanRusakHilangRow, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type MasihBerjalan = LaporanRusakHilangData['masih_berjalan'][number];
type SebaranRow = { id: string | number; name: string; jumlah_rusak: number; jumlah_hilang: number; total: number; nilai_buku: number };

const sebaranColumns: SummaryColumn<SebaranRow>[] = [
    { key: 'name', label: 'Unit Kerja', isRowHeader: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'jumlah_rusak', label: 'Rusak', align: 'right', render: (r) => r.jumlah_rusak.toLocaleString('id-ID') },
    { key: 'jumlah_hilang', label: 'Hilang', align: 'right', render: (r) => r.jumlah_hilang.toLocaleString('id-ID') },
    { key: 'total', label: 'Total Insiden', align: 'right', render: (r) => <span className="font-semibold">{r.total.toLocaleString('id-ID')}</span> },
    { key: 'nilai_buku', label: 'Nilai Buku Terdampak', align: 'right', render: (r) => rupiah(r.nilai_buku) },
];

const berjalanColumns: SummaryColumn<MasihBerjalan>[] = [
    {
        key: 'nomor',
        label: 'Nomor Laporan',
        isRowHeader: true,
        render: (m) => (
            <Link href={m.url} className="font-medium tabular-nums text-blue-700 hover:underline">
                {m.nomor}
            </Link>
        ),
    },
    { key: 'kondisi', label: 'Kondisi', render: (m) => m.kondisi_label },
    { key: 'aset', label: 'Aset', render: (m) => m.nama_aset ?? '—' },
    { key: 'unit', label: 'Unit', render: (m) => m.unit ?? '—' },
    { key: 'pemegang', label: 'Pemegang', render: (m) => m.pemegang ?? '—' },
    { key: 'langkah', label: 'Langkah', render: (m) => m.langkah ?? '—' },
    { key: 'menunggu', label: 'Menunggu', render: (m) => m.menunggu ?? '—' },
    { key: 'umur', label: 'Umur', align: 'right', render: (m) => `${m.umur_hari} hari` },
];

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
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-rusak-hilang.index', 'laporan-rusak-hilang.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
    const kondisiLabel = Object.fromEntries(kondisiOptions.map((k) => [k.value, k.label]));
    const statusItems = status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] || '#94A3B8' }));
    const kondisiItems = kondisi.map((k) => ({ label: k.label, jumlah: k.jumlah, persen: k.persen, color: KONDISI_COLOR[k.kondisi] || '#94A3B8' }));
    const rataProses = ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`;
    const terlamaProses = ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`;

    const columns: DetailColumn<LaporanRusakHilangRow>[] = [
        { key: 'nomor', label: 'No. Laporan', sort: 'nomor_laporan', render: (r) => <span className="font-medium tabular-nums">{r.nomor_laporan}</span> },
        { key: 'tanggal', label: 'Tgl Kejadian', sort: 'tanggal_kejadian', render: (r) => <span className="tabular-nums">{tanggalSingkat(r.tanggal_kejadian)}</span> },
        { key: 'nama_aset', label: 'Aset', sort: 'nama_aset', render: (r) => <span className="font-medium text-slate-900">{r.nama_aset ?? '—'}</span> },
        { key: 'kategori', label: 'Kategori', render: (r) => r.kategori ?? '—' },
        { key: 'unit', label: 'Unit', render: (r) => r.unit ?? '—' },
        { key: 'pemegang', label: 'Pemegang', render: (r) => r.pemegang ?? '—' },
        {
            key: 'kondisi',
            label: 'Kondisi',
            sort: 'kondisi_baru',
            render: (r) =>
                r.kondisi_baru ? (
                    <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[r.kondisi_baru] ?? 'gray'} className="rounded-sm">
                        {kondisiLabel[r.kondisi_baru] ?? r.kondisi_label ?? r.kondisi_baru}
                    </Badge>
                ) : (
                    '—'
                ),
        },
        { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right', render: (r) => rupiah(r.nilai_perolehan) },
        { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right', render: (r) => rupiah(r.nilai_buku) },
        {
            key: 'status',
            label: 'Status',
            sort: 'status',
            render: (r) =>
                r.status ? (
                    <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[r.status]} className="rounded-sm">
                        {statusLabel[r.status] ?? r.status_label ?? r.status}
                    </Badge>
                ) : (
                    '—'
                ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Rusak & Hilang" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Rusak & Hilang' }]} title="Laporan Rusak & Hilang" />

                <ReportFilterBar dirty={dirty} total={reports.total} downloadUrl={downloadUrl} onApply={apply}>
                    <ReportDate label="Dari Tanggal" value={form.dari} onChange={(v) => set('dari', v)} />
                    <ReportDate label="Sampai Tanggal" value={form.sampai} onChange={(v) => set('sampai', v)} />
                    <ReportSelect label="Kondisi" allLabel="Semua kondisi" value={form.kondisi} onChange={(v) => set('kondisi', v)} options={kondisiOptions} />
                    <ReportSelect label="Status" allLabel="Semua status" value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
                    {unitOptions.length > 1 && (
                        <ReportSelect
                            label="Unit Kerja"
                            allLabel="Semua unit kerja"
                            value={form.unit_id}
                            onChange={(v) => set('unit_id', v)}
                            options={unitOptions.map((u) => ({ value: u.id, label: u.name }))}
                        />
                    )}
                    <ReportSelect
                        label="Kategori Aset"
                        allLabel="Semua kategori aset"
                        value={form.category_id}
                        onChange={(v) => set('category_id', v)}
                        options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
                    />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Jumlah Laporan" value={ringkasan.jumlah_laporan.toLocaleString('id-ID')} note="Semua status" />
                    <StatCard label="Laporan Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <StatCard label="Nilai Perolehan Terdampak" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya laporan Disetujui" />
                    <StatCard label="Nilai Buku Terdampak" value={rupiah(ringkasan.nilai_buku)} note="Hanya laporan Disetujui" />
                    <StatCard
                        label="Rata-rata Lama Proses"
                        value={rataProses}
                        note={ringkasan.terlama_proses !== null ? `Terlama: ${ringkasan.terlama_proses.toLocaleString('id-ID')} hari` : undefined}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Komposisi per Status">
                        <DonutChart unit="laporan" ariaLabel="Grafik komposisi laporan menurut status persetujuan" data={statusItems} />
                        <ChartLegend unit="laporan" items={statusItems} />
                    </ReportCard>
                    <ReportCard title="Komposisi per Kondisi Insiden">
                        <DonutChart unit="laporan" ariaLabel="Grafik komposisi laporan menurut kondisi insiden" data={kondisiItems} />
                        <ChartLegend unit="laporan" items={kondisiItems} />
                    </ReportCard>
                </div>

                <ReportCard title="Tren Insiden per Bulan" description="Hanya laporan Disetujui, menurut tanggal kejadian.">
                    <TrenInsidenChart data={tren} />
                </ReportCard>

                {sebaranUnit && (
                    <ReportCard title="Sebaran Insiden per Unit Kerja" flush>
                        <SummaryTable
                            ariaLabel="Sebaran insiden per unit kerja"
                            columns={sebaranColumns}
                            rows={sebaranUnit.baris.map((r) => ({ id: r.id, name: r.name, jumlah_rusak: r.jumlah_rusak, jumlah_hilang: r.jumlah_hilang, total: r.total, nilai_buku: r.nilai_buku }))}
                            total={{ id: '__total', name: 'Total', ...sebaranUnit.total }}
                            emptyText="Belum ada laporan yang disetujui."
                        />
                    </ReportCard>
                )}

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
                    <SummaryTable ariaLabel="Laporan yang masih berjalan" columns={berjalanColumns} rows={masihBerjalan} emptyText="Tidak ada laporan yang masih berjalan." />
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} laporan yang masih berjalan.
                        </p>
                    )}
                </ReportCard>

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci laporan rusak dan hilang"
                        columns={columns}
                        rows={reports.data}
                        paginator={reports}
                        unit="laporan"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(r) => r.nomor_laporan}
                        emptyText="Tidak ada laporan yang cocok."
                        renderDetail={(r) => (
                            <div className="space-y-4">
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
                                                    aria-label="Buka foto bukti insiden di tab baru"
                                                    className="group block overflow-hidden rounded-lg border border-slate-200 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                                >
                                                    <img src={p.url} alt="" className="size-24 object-cover transition-transform group-hover:scale-105" />
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
                                                        {p.action_label ?? p.action}
                                                        {p.langkah ? ` — ${p.langkah}` : ''}
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
                            </div>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
