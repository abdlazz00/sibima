import { bulanLabel } from '@/lib/format';
import { LaporanMutasiData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Tren = LaporanMutasiData['tren'];

export default function TrenMutasiChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada mutasi yang disetujui.</p>;
    }

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 40 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => items[0].label,
                    label: (ctx) => {
                        const row = data[ctx.dataIndex];
                        return [`${row.jumlah_mutasi} mutasi disetujui`, `${row.aset_berpindah} aset berpindah`];
                    },
                },
            },
            datalabels: {
                anchor: 'end',
                align: 'end',
                color: '#0F172A',
                font: { size: 11, weight: 600 },
                formatter: (_value, ctx) => {
                    const row = data[ctx.dataIndex];
                    return [`${row.jumlah_mutasi} mutasi`, `${row.aset_berpindah} aset`];
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#475569' } },
            y: { beginAtZero: true, ticks: { precision: 0, color: '#475569' }, grid: { color: '#E2E8F0' } },
        },
    };

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(data.length * 96, 320), height: 340 }}>
                <Bar
                    data={{
                        labels: data.map((d) => bulanLabel(d.bulan)),
                        datasets: [{ data: data.map((d) => d.jumlah_mutasi), backgroundColor: '#1E40AF', borderRadius: 2, barPercentage: 0.6 }],
                    }}
                    options={options}
                    plugins={[ChartDataLabels]}
                    aria-label="Grafik jumlah mutasi disetujui per bulan"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Mutasi disetujui per bulan</caption>
                <thead><tr><th>Bulan</th><th>Mutasi</th><th>Aset berpindah</th></tr></thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.bulan}><td>{bulanLabel(d.bulan)}</td><td>{d.jumlah_mutasi}</td><td>{d.aset_berpindah}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
