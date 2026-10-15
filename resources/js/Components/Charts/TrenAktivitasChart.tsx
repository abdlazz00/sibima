import { chartOptions } from '@/lib/apex';
import { bulanLabel } from '@/lib/format';
import { DashboardData } from '@/types';
import ApexChart from './ApexChart';

type TrenAktivitas = DashboardData['tren_aktivitas'];

export default function TrenAktivitasChart({ data }: { data: TrenAktivitas }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada transaksi dalam 6 bulan terakhir.</p>;
    }

    const options = chartOptions({
        colors: ['#2563EB', '#4F46E5', '#DC2626', '#D97706'],
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.02, stops: [0, 95, 100] } },
        markers: { size: 4, strokeWidth: 2, strokeColors: '#FFFFFF' },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' },
        xaxis: { categories: data.map((d) => bulanLabel(d.bulan)) },
        yaxis: { min: 0, forceNiceScale: true },
        tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => `${v} transaksi` } },
    });

    return (
        <div>
            <div role="img" aria-label="Grafik volume transaksi per bulan selama 6 bulan terakhir">
                <ApexChart
                    type="area"
                    series={[
                        { name: 'Penerimaan', data: data.map((d) => d.penerimaan) },
                        { name: 'Mutasi', data: data.map((d) => d.mutasi) },
                        { name: 'Rusak/Hilang', data: data.map((d) => d.rusak_hilang) },
                        { name: 'Permohonan', data: data.map((d) => d.permohonan) },
                    ]}
                    options={options}
                    height={300}
                />
            </div>
            <table className="sr-only">
                <caption>Tren Aktivitas Transaksi 6 Bulan Terakhir</caption>
                <thead>
                    <tr>
                        <th>Bulan</th>
                        <th>Penerimaan</th>
                        <th>Mutasi</th>
                        <th>Rusak & Hilang</th>
                        <th>Permohonan</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.bulan}>
                            <td>{bulanLabel(d.bulan)}</td>
                            <td>{d.penerimaan} transaksi</td>
                            <td>{d.mutasi} transaksi</td>
                            <td>{d.rusak_hilang} laporan</td>
                            <td>{d.permohonan} permohonan</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
