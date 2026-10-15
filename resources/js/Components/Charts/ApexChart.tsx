import type { ApexOptions } from 'apexcharts';
import { Component, lazy, ReactNode, Suspense } from 'react';

const Chart = lazy(() => import('react-apexcharts'));

/** Menahan kegagalan memuat/menggambar chart agar halaman lain tidak ikut kosong. */
class ChartBoundary extends Component<{ height: number | string; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (this.state.failed) {
            return (
                <div
                    role="alert"
                    className="flex items-center justify-center rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-600"
                    style={{ minHeight: this.props.height }}
                >
                    Grafik gagal dimuat. Muat ulang halaman untuk mencoba lagi.
                </div>
            );
        }

        return this.props.children;
    }
}

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
        <ChartBoundary height={height}>
            <Suspense fallback={<div className="animate-pulse rounded-lg bg-slate-100" style={{ height }} aria-hidden="true" />}>
                <Chart type={type} series={series} options={options} height={height} width="100%" />
            </Suspense>
        </ChartBoundary>
    );
}
