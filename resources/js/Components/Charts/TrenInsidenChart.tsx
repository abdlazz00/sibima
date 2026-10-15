import { bulanLabel, rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanRusakHilangData } from '@/types';
import BarTren from './BarTren';

type Tren = LaporanRusakHilangData['tren'];

export default function TrenInsidenChart({ data }: { data: Tren }) {
    if (data.length === 0 || data.every((d) => d.jumlah === 0)) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada insiden yang disetujui.</p>;
    }

    return (
        <BarTren
            categories={data.map((d) => bulanLabel(d.bulan))}
            values={data.map((d) => d.jumlah)}
            color="#B91C1C"
            ariaLabel="Grafik tren insiden disetujui per bulan"
            minPerItem={80}
            labelLines={(i) => {
                const row = data[i];
                if (row.jumlah === 0) return [];
                return row.nilai_perolehan > 0 ? [`${row.jumlah} lap`, rupiahRingkas(row.nilai_perolehan)] : [`${row.jumlah} lap`];
            }}
            tooltipTitle={(i) => bulanLabel(data[i].bulan)}
            tooltipLines={(i) => [`${data[i].jumlah} insiden disetujui`, `Nilai perolehan: ${rupiah(data[i].nilai_perolehan)}`]}
            table={{
                caption: 'Insiden disetujui per bulan',
                head: ['Bulan', 'Insiden Disetujui', 'Nilai Perolehan'],
                rows: data.map((d) => [bulanLabel(d.bulan), d.jumlah, rupiah(d.nilai_perolehan)]),
            }}
        />
    );
}
