import { bulanLabel } from '@/lib/format';
import { DashboardData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type TrenAktivitas = DashboardData['tren_aktivitas'];

export default function TrenAktivitasChart({ data }: { data: TrenAktivitas }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada transaksi dalam 6 bulan terakhir.</p>;
    }

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    boxHeight: 12,
                    padding: 12,
                    color: '#334155',
                    font: { size: 11, weight: 500 },
                },
            },
            tooltip: {
                callbacks: {
                    title: (items) => items[0]?.label ?? '',
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} transaksi`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#475569', font: { size: 11 } },
            },
            y: {
                beginAtZero: true,
                ticks: { precision: 0, color: '#64748B', font: { size: 11 } },
                grid: { color: '#F1F5F9' },
            },
        },
    };

    return (
        <div>
            <div className="h-64 w-full">
                <Bar
                    data={{
                        labels: data.map((d) => bulanLabel(d.bulan)),
                        datasets: [
                            {
                                label: 'Penerimaan',
                                data: data.map((d) => d.penerimaan),
                                backgroundColor: '#2563EB',
                                borderRadius: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.8,
                            },
                            {
                                label: 'Mutasi',
                                data: data.map((d) => d.mutasi),
                                backgroundColor: '#4F46E5',
                                borderRadius: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.8,
                            },
                            {
                                label: 'Rusak/Hilang',
                                data: data.map((d) => d.rusak_hilang),
                                backgroundColor: '#DC2626',
                                borderRadius: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.8,
                            },
                            {
                                label: 'Permohonan',
                                data: data.map((d) => d.permohonan),
                                backgroundColor: '#D97706',
                                borderRadius: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.8,
                            },
                        ],
                    }}
                    options={options}
                    aria-label="Grafik volume transaksi per bulan selama 6 bulan terakhir"
                    role="img"
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
