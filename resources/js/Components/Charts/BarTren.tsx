import { chartOptions, tooltipHtml } from '@/lib/apex';
import ApexChart from './ApexChart';

export interface BarTrenProps {
    categories: string[];
    values: number[];
    color: string;
    ariaLabel: string;
    /** Lebar minimum per batang (px); wadah menggulir bila data banyak. */
    minPerItem: number;
    /** Baris label di atas batang untuk titik ke-i (boleh kosong). */
    labelLines: (i: number) => string[];
    tooltipTitle: (i: number) => string;
    tooltipLines: (i: number) => string[];
    table: { caption: string; head: string[]; rows: (string | number)[][] };
}

/** Langkah sumbu yang bulat (1, 2, 5, 10, 20, 50, ...) paling kecil yang tidak kurang dari `x`. */
const niceStep = (x: number) => {
    const p = 10 ** Math.floor(Math.log10(x));

    return ([1, 2, 5, 10].find((m) => m * p >= x) ?? 10) * p;
};

export default function BarTren({
    categories,
    values,
    color,
    ariaLabel,
    minPerItem,
    labelLines,
    tooltipTitle,
    tooltipLines,
    table,
}: BarTrenProps) {
    // Ruang kosong di atas batang tertinggi: ApexCharts menahan label tetap di dalam area plot, jadi tanpa ruang
    // ini label dua baris terdesak masuk ke batang tertinggi.
    const rawTop = Math.max(2, Math.ceil(Math.max(...values, 1) * 1.3));
    const step = rawTop <= 5 ? 1 : niceStep(rawTop / 6);
    const top = Math.ceil(rawTop / step) * step;
    const options = chartOptions({
        colors: [color],
        plotOptions: {
            bar: {
                columnWidth: '55%',
                borderRadius: 6,
                borderRadiusApplication: 'end',
                dataLabels: { position: 'top' },
            },
        },
        dataLabels: {
            enabled: true,
            offsetY: -52,
            style: { fontSize: '13px', fontWeight: 600, colors: ['#0F172A'] },
            formatter: (_v, opts) =>
                labelLines(opts?.dataPointIndex ?? 0) as unknown as string,
        },
        grid: { padding: { top: 62 } },
        xaxis: { categories },
        yaxis: { min: 0, max: top, tickAmount: top / step },
        tooltip: {
            custom: ({ dataPointIndex }) =>
                tooltipHtml(
                    tooltipTitle(dataPointIndex),
                    tooltipLines(dataPointIndex),
                ),
        },
    });

    return (
        <div className="overflow-x-auto" role="img" aria-label={ariaLabel}>
            <div
                style={{
                    minWidth: Math.max(categories.length * minPerItem, 320),
                }}
            >
                <ApexChart
                    type="bar"
                    series={[{ name: 'Jumlah', data: values }]}
                    options={options}
                    height={340}
                />
            </div>
            <div className="relative h-px overflow-hidden">
                <table className="sr-only">
                    <caption>{table.caption}</caption>
                    <thead>
                        <tr>
                            {table.head.map((h) => (
                                <th key={h}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => (
                                    <td key={j}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
