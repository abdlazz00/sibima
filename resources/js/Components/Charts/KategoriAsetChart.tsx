import { chartOptions, tooltipHtml } from '@/lib/apex';
import { KATEGORI_PALETTE } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { DashboardData } from '@/types';
import ApexChart from './ApexChart';

type PerKategori = DashboardData['per_kategori'];

export default function KategoriAsetChart({ data }: { data: PerKategori }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada aset.</p>;
    }

    // Maksimal 7 kategori teratas agar proporsional
    const displayData = data.slice(0, 7);

    const options = chartOptions({
        colors: KATEGORI_PALETTE,
        plotOptions: { bar: { horizontal: true, distributed: true, barHeight: '68%', borderRadius: 6, borderRadiusApplication: 'end' } },
        legend: { show: false },
        dataLabels: { enabled: true, style: { fontSize: '13px', fontWeight: 700, colors: ['#FFFFFF'] }, formatter: (v: number) => `${v}` },
        grid: { padding: { left: 4, right: 8 } },
        xaxis: { categories: displayData.map((k) => k.nama), labels: { formatter: (v: string) => String(Math.round(Number(v))) } },
        yaxis: { labels: { style: { fontSize: '13px', colors: '#334155', fontWeight: 500 }, maxWidth: 160, formatter: (v: string | number) => { const s = String(v); return s.length > 20 ? `${s.slice(0, 18)}…` : s; } } },
        tooltip: { custom: ({ dataPointIndex }) => { const k = displayData[dataPointIndex]; return tooltipHtml(k.nama, [`Jumlah: ${k.jumlah} aset`, `Nilai buku: ${rupiah(k.nilai_buku)}`]); } },
    });

    return (
        <div>
            <div role="img" aria-label="Grafik jumlah aset berdasarkan kategori">
                <ApexChart type="bar" series={[{ name: 'Aset', data: displayData.map((k) => k.jumlah) }]} options={options} height={displayData.length * 46 + 40} />
            </div>
            <table className="sr-only">
                <caption>Aset per Kategori</caption>
                <thead>
                    <tr>
                        <th>Kategori</th>
                        <th>Jumlah</th>
                        <th>Nilai Buku</th>
                    </tr>
                </thead>
                <tbody>
                    {displayData.map((k) => (
                        <tr key={k.id}>
                            <td>{k.nama}</td>
                            <td>{k.jumlah} aset</td>
                            <td>{rupiah(k.nilai_buku)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
