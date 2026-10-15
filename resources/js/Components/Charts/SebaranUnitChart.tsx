import { chartOptions, tooltipHtml } from '@/lib/apex';
import { DashboardData } from '@/types';
import ApexChart from './ApexChart';

type PerUnit = DashboardData['per_unit'];

const singkat = (nama: string) => nama.replace('Kelurahan ', 'Kel. ').replace('Kecamatan ', 'Kec. ');

export default function SebaranUnitChart({ data }: { data: PerUnit }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-sm text-slate-400">
                <p>Data sebaran per unit kerja hanya tersedia pada tampilan seluruh unit (Kecamatan).</p>
            </div>
        );
    }

    const baik = data.map((u) => u.kondisi?.baik ?? 0);
    const bermasalah = data.map((u) => (u.kondisi?.rusak_ringan ?? 0) + (u.kondisi?.rusak_berat ?? 0) + (u.kondisi?.hilang ?? 0));

    const options = chartOptions({
        colors: ['#047857', '#DC2626'],
        chart: { stacked: true },
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 4, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last' } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' },
        xaxis: { categories: data.map((u) => singkat(u.name)), labels: { trim: true, hideOverlappingLabels: false, rotate: -30, rotateAlways: false } },
        yaxis: { min: 0, forceNiceScale: true },
        tooltip: { shared: true, intersect: false, custom: ({ dataPointIndex }) => tooltipHtml(data[dataPointIndex].name, [`Baik: ${baik[dataPointIndex]} aset`, `Bermasalah: ${bermasalah[dataPointIndex]} aset`, `Total: ${data[dataPointIndex].jumlah} aset`]) },
    });

    return (
        <div>
            <div role="img" aria-label="Grafik sebaran aset per unit kerja berdasarkan kondisi fisik">
                <ApexChart
                    type="bar"
                    series={[
                        { name: 'Kondisi Baik', data: baik },
                        { name: 'Bermasalah (Rusak/Hilang)', data: bermasalah },
                    ]}
                    options={options}
                    height={300}
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
                    {data.map((u, i) => (
                        <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{baik[i]} aset</td>
                            <td>{bermasalah[i]} aset</td>
                            <td>{u.jumlah} aset</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
