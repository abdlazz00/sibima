import { rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanAsetData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Tren = LaporanAsetData['tren'];

export default function TrenAsetChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 40 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => `Tahun ${items[0].label}`,
                    label: (ctx) => {
                        const row = data[ctx.dataIndex];
                        return [`${row.jumlah} aset`, `Nilai perolehan: ${rupiah(row.nilai_perolehan)}`, `Nilai buku: ${rupiah(row.nilai_buku)}`];
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
                    return [`${row.jumlah} aset`, rupiahRingkas(row.nilai_perolehan)];
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
                        labels: data.map((d) => String(d.tahun)),
                        datasets: [{ data: data.map((d) => d.jumlah), backgroundColor: '#1E40AF', borderRadius: 2, barPercentage: 0.6 }],
                    }}
                    options={options}
                    plugins={[ChartDataLabels]}
                    aria-label="Grafik jumlah aset per tahun perolehan"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Aset per tahun perolehan</caption>
                <thead><tr><th>Tahun</th><th>Jumlah</th><th>Nilai perolehan</th></tr></thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.tahun}><td>{d.tahun}</td><td>{d.jumlah}</td><td>{rupiah(d.nilai_perolehan)}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
