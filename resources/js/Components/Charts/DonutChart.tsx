import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

export interface DonutSlice {
    label: string;
    jumlah: number;
    persen: number;
    color: string;
}

export default function DonutChart({ data, ariaLabel, unit = 'aset' }: { data: DonutSlice[]; ariaLabel: string; unit?: string }) {
    const total = data.reduce((sum, s) => sum + s.jumlah, 0);

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    return (
        <div className="mx-auto h-56 w-56">
            <Doughnut
                data={{
                    labels: data.map((s) => s.label),
                    datasets: [{ data: data.map((s) => s.jumlah), backgroundColor: data.map((s) => s.color), borderWidth: 2, borderColor: '#FFFFFF' }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${data[ctx.dataIndex].jumlah} ${unit} (${data[ctx.dataIndex].persen}%)` } },
                    },
                }}
                aria-label={ariaLabel}
                role="img"
            />
        </div>
    );
}
