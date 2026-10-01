import { LaporanAsetData } from '@/types';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

export const KONDISI_COLOR: Record<string, string> = {
    baik: '#047857',
    rusak_ringan: '#B45309',
    rusak_berat: '#B91C1C',
    hilang: '#4B5563',
};

export default function KondisiChart({ data }: { data: LaporanAsetData['kondisi'] }) {
    const total = data.reduce((sum, k) => sum + k.jumlah, 0);

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    return (
        <div className="mx-auto h-56 w-56">
            <Doughnut
                data={{
                    labels: data.map((k) => k.label),
                    datasets: [{ data: data.map((k) => k.jumlah), backgroundColor: data.map((k) => KONDISI_COLOR[k.kondisi]), borderWidth: 2, borderColor: '#FFFFFF' }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${data[ctx.dataIndex].jumlah} aset (${data[ctx.dataIndex].persen}%)` } },
                    },
                }}
                aria-label="Grafik persentase aset menurut kondisi"
                role="img"
            />
        </div>
    );
}
