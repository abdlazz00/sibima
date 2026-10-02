import { DashboardData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type PerUnit = DashboardData['per_unit'];

export default function SebaranUnitChart({ data }: { data: PerUnit }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-sm text-slate-400">
                <p>Data sebaran per unit kerja hanya tersedia pada tampilan seluruh unit (Kecamatan).</p>
            </div>
        );
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
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} aset`,
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: {
                    color: '#475569',
                    font: { size: 11 },
                    callback: function (val) {
                        const label = this.getLabelForValue(Number(val));
                        // Singkat nama unit jika panjang (misal 'Kelurahan Sagulung Kota' -> 'Sagulung Kota')
                        return label.replace('Kelurahan ', 'Kel. ').replace('Kecamatan ', 'Kec. ');
                    },
                },
            },
            y: {
                stacked: true,
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
                        labels: data.map((u) => u.name),
                        datasets: [
                            {
                                label: 'Kondisi Baik',
                                data: data.map((u) => u.kondisi?.baik ?? 0),
                                backgroundColor: '#047857',
                                borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 2, bottomRight: 2 },
                                barPercentage: 0.6,
                                stack: 'unit',
                            },
                            {
                                label: 'Bermasalah (Rusak/Hilang)',
                                data: data.map((u) => (u.kondisi?.rusak_ringan ?? 0) + (u.kondisi?.rusak_berat ?? 0) + (u.kondisi?.hilang ?? 0)),
                                backgroundColor: '#DC2626',
                                borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                                barPercentage: 0.6,
                                stack: 'unit',
                            },
                        ],
                    }}
                    options={options}
                    aria-label="Grafik sebaran aset per unit kerja berdasarkan kondisi fisik"
                    role="img"
                />
            </div>
            <table className="sr-only">
                <caption>Sebaran Aset per Unit</caption>
                <thead>
                    <tr>
                        <th>Unit</th>
                        <th>Baik</th>
                        <th>Bermasalah</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((u) => {
                        const baik = u.kondisi?.baik ?? 0;
                        const bermasalah = (u.kondisi?.rusak_ringan ?? 0) + (u.kondisi?.rusak_berat ?? 0) + (u.kondisi?.hilang ?? 0);
                        return (
                            <tr key={u.id}>
                                <td>{u.name}</td>
                                <td>{baik} aset</td>
                                <td>{bermasalah} aset</td>
                                <td>{u.jumlah} aset</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
