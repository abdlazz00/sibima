import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenAsetChart from '@/Components/Charts/TrenAsetChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { KONDISI_COLOR } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanAsetData, LaporanAsetRow, PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

interface RekapRow {
    id: string | number;
    nama: string;
    level: 0 | 1;
    jumlah: number;
    nilai_perolehan: number;
    nilai_buku: number;
}

const rekapColumns = (label: string): SummaryColumn<RekapRow>[] => [
    {
        key: 'nama',
        label,
        isRowHeader: true,
        render: (r) => <span className={r.level === 1 ? 'pl-5 text-slate-600' : 'font-semibold'}>{r.nama}</span>,
    },
    { key: 'jumlah', label: 'Jumlah', align: 'right', render: (r) => r.jumlah.toLocaleString('id-ID') },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', align: 'right', render: (r) => rupiah(r.nilai_perolehan) },
    { key: 'nilai_buku', label: 'Nilai Buku', align: 'right', render: (r) => rupiah(r.nilai_buku) },
];

const asetColumns: DetailColumn<LaporanAsetRow>[] = [
    { key: 'kode_barang', label: 'Kode Barang', sort: 'kode_barang', render: (a) => <span className="tabular-nums">{a.kode_barang}</span> },
    { key: 'nomor_register', label: 'No. Register', sort: 'nomor_register', render: (a) => <span className="tabular-nums">{a.nomor_register}</span> },
    {
        key: 'nama_aset',
        label: 'Nama / Merk',
        sort: 'nama_aset',
        render: (a) => (
            <>
                <span className="font-medium text-slate-900">{a.nama_aset}</span>
                {a.merk_type && <span className="block text-xs text-slate-500">{a.merk_type}</span>}
            </>
        ),
    },
    {
        key: 'kategori',
        label: 'Kategori',
        render: (a) => (
            <>
                {a.kategori}
                {a.subkategori && <span className="block text-xs text-slate-500">{a.subkategori}</span>}
            </>
        ),
    },
    { key: 'unit', label: 'Unit', render: (a) => a.unit },
    { key: 'tahun', label: 'Tahun', sort: 'tanggal_perolehan', render: (a) => <span className="tabular-nums">{a.tahun_perolehan}</span> },
    {
        key: 'kondisi',
        label: 'Kondisi',
        sort: 'kondisi',
        render: (a) => (
            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[a.kondisi] ?? 'gray'} className="rounded-sm">
                {KONDISI_LABEL[a.kondisi] ?? a.kondisi}
            </Badge>
        ),
    },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right', render: (a) => rupiah(a.nilai_perolehan) },
    { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right', render: (a) => rupiah(a.nilai_buku) },
];

function DetailItem({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={wide ? 'sm:col-span-2 lg:col-span-4' : undefined}>
            <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line text-slate-900">{children}</dd>
        </div>
    );
}

export default function Index(props: PageProps & LaporanAsetData) {
    const { filters, sort, ringkasan, kondisi, tren, rekap_kategori: rekapKategori, rekap_unit: rekapUnit, asets, units, categories, kondisiOptions } = props;
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-aset.index', 'laporan-aset.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const legendItems = kondisi.map((k) => ({ label: KONDISI_LABEL[k.kondisi] ?? k.label, jumlah: k.jumlah, persen: k.persen, color: KONDISI_COLOR[k.kondisi] }));

    const kategoriRows: RekapRow[] = rekapKategori.grup.flatMap((g) => [
        { id: `g-${g.id}`, nama: g.nama, level: 0 as const, jumlah: g.jumlah, nilai_perolehan: g.nilai_perolehan, nilai_buku: g.nilai_buku },
        ...g.anak.map((a) => ({ id: `a-${a.id}`, nama: a.nama, level: 1 as const, jumlah: a.jumlah, nilai_perolehan: a.nilai_perolehan, nilai_buku: a.nilai_buku })),
    ]);

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Aset' }]} title="Laporan Aset" />

                <ReportFilterBar dirty={dirty} total={asets.total} downloadUrl={downloadUrl} onApply={apply}>
                    {units.length > 0 && (
                        <ReportSelect
                            label="Unit"
                            allLabel="Semua unit"
                            value={form.unit_id}
                            onChange={(v) => set('unit_id', v)}
                            options={units.map((u) => ({ value: u.id, label: u.name }))}
                        />
                    )}
                    <ReportSelect
                        label="Kategori"
                        allLabel="Semua kategori"
                        value={form.category_id}
                        onChange={(v) => set('category_id', v)}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                    <ReportSelect label="Kondisi" allLabel="Semua kondisi" value={form.kondisi} onChange={(v) => set('kondisi', v)} options={kondisiOptions} />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Jumlah Aset" value={ringkasan.jumlah.toLocaleString('id-ID')} />
                    <StatCard label="Total Nilai Perolehan" value={rupiah(ringkasan.nilai_perolehan)} />
                    <StatCard label="Total Nilai Buku" value={rupiah(ringkasan.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <ReportCard title="Persentase per Kondisi">
                        <DonutChart ariaLabel="Grafik persentase aset menurut kondisi" data={legendItems} />
                        <ChartLegend unit="aset" items={legendItems} />
                    </ReportCard>
                    <ReportCard title="Tren per Tahun Perolehan" className="lg:col-span-2">
                        <TrenAsetChart data={tren} />
                    </ReportCard>
                </div>

                <ReportCard title="Rekap per Kategori" flush>
                    <SummaryTable
                        ariaLabel="Rekap aset per kategori"
                        columns={rekapColumns('Kategori')}
                        rows={kategoriRows}
                        total={{ id: 'total', nama: 'Total', level: 0, ...rekapKategori.total }}
                        emptyText="Belum ada data."
                    />
                </ReportCard>

                {rekapUnit && (
                    <ReportCard title="Rekap per Unit" flush>
                        <SummaryTable
                            ariaLabel="Rekap aset per unit"
                            columns={rekapColumns('Unit')}
                            rows={rekapUnit.baris.map((u) => ({ id: u.id, nama: u.nama, level: 0 as const, jumlah: u.jumlah, nilai_perolehan: u.nilai_perolehan, nilai_buku: u.nilai_buku }))}
                            total={{ id: 'total', nama: 'Total', level: 0, ...rekapUnit.total }}
                            emptyText="Belum ada data."
                        />
                    </ReportCard>
                )}

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci aset"
                        columns={asetColumns}
                        rows={asets.data}
                        paginator={asets}
                        unit="aset"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(a) => a.nama_aset}
                        emptyText="Tidak ada aset yang cocok."
                        renderDetail={(a) => (
                            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <DetailItem label="Pemegang">{a.detail.pemegang ?? '—'}</DetailItem>
                                <DetailItem label="Status">{a.detail.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}</DetailItem>
                                <DetailItem label="Sumber Perolehan">{a.detail.sumber_perolehan ?? '—'}</DetailItem>
                                <DetailItem label="No. Dokumen">{a.detail.no_dokumen ?? '—'}</DetailItem>
                                <DetailItem label="Keterangan" wide>
                                    {a.detail.keterangan ?? '—'}
                                </DetailItem>
                            </dl>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
