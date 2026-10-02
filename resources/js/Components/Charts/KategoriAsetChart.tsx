import { rupiah } from '@/lib/format';
import { DashboardData } from '@/types';
import { BarElement, CategoryScale, Chart as ChartJS, ChartOptions, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type PerKategori = DashboardData['per_kategori'];

export default function KategoriAsetChart({ data }: { data: PerKategori }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada aset.</p>;
    }

    // Ambil maksimal 7 kategori teratas agar tampilan tetap proporsional dan rapi
    const displayData = data.slice(0, 7);

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => items[0]?.label ?? '',
                    label: (ctx) => {
                        const row = displayData[ctx.dataIndex];
                        if (!row) return '';
                        return [`Jumlah: ${row.jumlah} aset`, `Nilai buku: ${rupiah(row.nilai_buku)}`];
                    },
                },
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: { precision: 0, color: '#64748B', font: { size: 11 } },
                grid: { color: '#F1F5F9' },
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: '#334155',
                    font: { size: 12, weight: 500 },
                    callback: function (val, index) {
                        const label = this.getLabelForValue(Number(val));
                        return label.length > 20 ? label.slice(0, 18) + '...' : label;
                    },
                },
            },
        },
    };

    return (
        <div>
            <div className="h-64 w-full">
                <Bar
                    data={{
                        labels: displayData.map((k) => k.nama),
                        datasets: [
                            {
                                data: displayData.map((k) => k.jumlah),
                                backgroundColor: '#2563EB',
                                borderRadius: 4,
                                barPercentage: 0.7,
                            },
                        ],
                    }}
                    options={options}
                    aria-label="Grafik jumlah aset berdasarkan kategori"
                    role="img"
                />
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
