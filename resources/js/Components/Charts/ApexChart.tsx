import type { ApexOptions } from 'apexcharts';
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('react-apexcharts'));

export default function ApexChart({
    type,
    series,
    options,
    height,
}: {
    type: 'donut' | 'bar' | 'area' | 'line';
    series: ApexOptions['series'];
    options: ApexOptions;
    height: number | string;
}) {
    return (
        <Suspense
            fallback={
                <div
                    className="animate-pulse rounded-lg bg-slate-100"
                    style={{ height }}
                    aria-hidden="true"
                />
            }
        >
            <Chart
                type={type}
                series={series}
                options={options}
                height={height}
                width="100%"
            />
        </Suspense>
    );
}
