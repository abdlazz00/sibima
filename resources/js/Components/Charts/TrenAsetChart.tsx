import { rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanAsetData } from '@/types';
import BarTren from './BarTren';

type Tren = LaporanAsetData['tren'];

export default function TrenAsetChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-slate-400">
                Belum ada data.
            </p>
        );
    }

    return (
        <BarTren
            categories={data.map((d) => String(d.tahun))}
            values={data.map((d) => d.jumlah)}
            color="#1E40AF"
            ariaLabel="Grafik jumlah aset per tahun perolehan"
            minPerItem={96}
            labelLines={(i) => (data[i].jumlah === 0 ? [] : [`${data[i].jumlah} aset`, rupiahRingkas(data[i].nilai_perolehan)])}
            tooltipTitle={(i) => `Tahun ${data[i].tahun}`}
            tooltipLines={(i) => [
                `${data[i].jumlah} aset`,
                `Nilai perolehan: ${rupiah(data[i].nilai_perolehan)}`,
                `Nilai buku: ${rupiah(data[i].nilai_buku)}`,
            ]}
            table={{
                caption: 'Aset per tahun perolehan',
                head: ['Tahun', 'Jumlah', 'Nilai perolehan'],
                rows: data.map((d) => [
                    d.tahun,
                    d.jumlah,
                    rupiah(d.nilai_perolehan),
                ]),
            }}
        />
    );
}
