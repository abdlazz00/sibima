import { bulanLabel } from '@/lib/format';
import { LaporanMutasiData } from '@/types';
import BarTren from './BarTren';

type Tren = LaporanMutasiData['tren'];

export default function TrenMutasiChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-slate-400">
                Belum ada mutasi yang disetujui.
            </p>
        );
    }

    return (
        <BarTren
            categories={data.map((d) => bulanLabel(d.bulan))}
            values={data.map((d) => d.jumlah_mutasi)}
            color="#6D28D9"
            ariaLabel="Grafik jumlah mutasi disetujui per bulan"
            minPerItem={96}
            labelLines={(i) => (data[i].jumlah_mutasi === 0 ? [] : [`${data[i].jumlah_mutasi} mutasi`, `${data[i].aset_berpindah} aset`])}
            tooltipTitle={(i) => bulanLabel(data[i].bulan)}
            tooltipLines={(i) => [
                `${data[i].jumlah_mutasi} mutasi disetujui`,
                `${data[i].aset_berpindah} aset berpindah`,
            ]}
            table={{
                caption: 'Mutasi disetujui per bulan',
                head: ['Bulan', 'Mutasi', 'Aset berpindah'],
                rows: data.map((d) => [
                    bulanLabel(d.bulan),
                    d.jumlah_mutasi,
                    d.aset_berpindah,
                ]),
            }}
        />
    );
}
