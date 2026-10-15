import { chartOptions } from '@/lib/apex';
import ApexChart from './ApexChart';

export interface DonutSlice {
    label: string;
    jumlah: number;
    persen: number;
    color: string;
}

export default function DonutChart({
    data,
    ariaLabel,
    unit = 'aset',
}: {
    data: DonutSlice[];
    ariaLabel: string;
    unit?: string;
}) {
    const total = data.reduce((sum, s) => sum + s.jumlah, 0);

    if (total === 0) {
        return (
            <p className="py-10 text-center text-sm text-slate-400">
                Belum ada data.
            </p>
        );
    }

    const options = chartOptions({
        labels: data.map((s) => s.label),
        colors: data.map((s) => s.color),
        stroke: { width: 3, colors: ['#FFFFFF'] },
        legend: { show: false },
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '68%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#475569',
                            offsetY: 18,
                        },
                        value: {
                            show: true,
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#0F172A',
                            offsetY: -14,
                            formatter: (v: string) =>
                                Number(v).toLocaleString('id-ID'),
                        },
                        total: {
                            show: true,
                            label: `Total ${unit}`,
                            fontSize: '14px',
                            color: '#475569',
                            formatter: () => total.toLocaleString('id-ID'),
                        },
                    },
                },
            },
        },
        tooltip: {
            y: {
                formatter: (v: number | null, opts?: { seriesIndex: number }) =>
                    `${(v ?? 0).toLocaleString('id-ID')} ${unit} (${data[opts?.seriesIndex ?? 0].persen}%)`,
            },
        },
    });

    return (
        <div role="img" aria-label={ariaLabel} className="mx-auto max-w-72">
            <ApexChart
                type="donut"
                series={data.map((s) => s.jumlah)}
                options={options}
                height={280}
            />
        </div>
    );
}
