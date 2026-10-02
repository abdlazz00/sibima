import { bulanLabel, rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanRusakHilangData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Tren = LaporanRusakHilangData['tren'];

export default function TrenInsidenChart({ data }: { data: Tren }) {
    if (data.length === 0 || data.every((d) => d.jumlah === 0)) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada insiden yang disetujui.</p>;
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
                        return [`${row.jumlah} insiden disetujui`, `Nilai perolehan: ${rupiah(row.nilai_perolehan)}`];
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
                    if (row.jumlah === 0) return '';
                    return row.nilai_perolehan > 0
                        ? [`${row.jumlah} lap`, rupiahRingkas(row.nilai_perolehan)]
                        : `${row.jumlah} lap`;
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
            <div style={{ minWidth: Math.max(data.length * 80, 320), height: 340 }}>
                <Bar
                    data={{
                        labels: data.map((d) => bulanLabel(d.bulan)),
                        datasets: [
                            {
                                data: data.map((d) => d.jumlah),
                                backgroundColor: '#B91C1C',
                                borderRadius: 2,
                                barPercentage: 0.6,
                            },
                        ],
                    }}
                    options={options}
                    plugins={[ChartDataLabels]}
                    aria-label="Grafik tren insiden disetujui per bulan"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Insiden disetujui per bulan</caption>
                <thead>
                    <tr>
                        <th>Bulan</th>
                        <th>Insiden Disetujui</th>
                        <th>Nilai Perolehan</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.bulan}>
                            <td>{bulanLabel(d.bulan)}</td>
                            <td>{d.jumlah}</td>
                            <td>{rupiah(d.nilai_perolehan)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
