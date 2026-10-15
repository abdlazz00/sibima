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

export default function BarTren({ categories, values, color, ariaLabel, minPerItem, labelLines, tooltipTitle, tooltipLines, table }: BarTrenProps) {
    const options = chartOptions({
        colors: [color],
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 6, borderRadiusApplication: 'end', dataLabels: { position: 'top' } } },
        dataLabels: {
            enabled: true,
            offsetY: -38,
            style: { fontSize: '12px', fontWeight: 600, colors: ['#0F172A'] },
            formatter: (_v, opts) => labelLines(opts?.dataPointIndex ?? 0) as unknown as string,
        },
        grid: { padding: { top: 36 } },
        xaxis: { categories },
        yaxis: { min: 0, forceNiceScale: true },
        tooltip: { custom: ({ dataPointIndex }) => tooltipHtml(tooltipTitle(dataPointIndex), tooltipLines(dataPointIndex)) },
    });

    return (
        <div className="overflow-x-auto" role="img" aria-label={ariaLabel}>
            <div style={{ minWidth: Math.max(categories.length * minPerItem, 320) }}>
                <ApexChart type="bar" series={[{ name: 'Jumlah', data: values }]} options={options} height={340} />
            </div>
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
    );
}
