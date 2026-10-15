# Chart ApexCharts, KPI Card Berwarna, dan Dashboard/Laporan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (eksekusi native, satu sesi). Steps use checkbox (`- [ ]`) syntax for tracking. Dua Task = dua tahap bergerbang; **berhenti di akhir tiap Task dan tunggu pengguna menyatakan lolos** sebelum Task berikutnya.

**Goal:** Mengganti Chart.js dengan ApexCharts, memberi KPI card ikon dan warna sesuai data, mempercantik Dashboard dan tiga Laporan (banner, pintasan solid berikon, judul kartu berikon, teks lebih besar).

**Architecture:** Frontend saja. Tujuh komponen di `Components/Charts/` ditulis ulang di atas `react-apexcharts` (dimuat lazy lewat satu pembungkus `ApexChart`) dengan opsi dasar bersama di `lib/apex.ts`; tiga chart tren berbagi satu komponen `BarTren`. `StatCard` dan `ReportCard` menerima `icon`/`tone` yang dipetakan di `lib/tone.ts`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, `apexcharts` 8.x + `react-apexcharts` 2.x, `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-15-chart-apex-kpi-dashboard-design.md`

## Global Constraints

- Bahasa UI Indonesia; font Figtree; angka `tabular-nums`; badge `rounded-sm`.
- Aturan warna tombol di panduan UI/UX bagian 9 tetap; amber hanya untuk peringatan (kartu antrean "menunggu" boleh amber; pintasan tidak).
- Kontras teks minimal WCAG AA; label data dan legenda minimal 13px; angka KPI 28px (layar kecil) / 32px (`sm` ke atas).
- 375 px tanpa scroll horizontal pada halaman; chart lebar boleh menggulir di dalam wadahnya.
- Setiap chart tetap punya `role="img"` + `aria-label` dan tabel `sr-only` setara.
- Props komponen chart yang dipakai halaman tidak berubah; tidak ada perubahan backend, route, atau data server.
- Commit tanpa Co-Authored-By/atribusi Claude, stage dengan path eksplisit, di `main`, tanpa push. Jangan jalankan Pint pada `routes/web.php` (tidak relevan di sini).
- Dependensi hanya yang disebut di Task 1 (sudah disetujui pengguna, termasuk keputusan lisensi).

## Review Focus

- Donat total 0, tren kosong/satu titik, laporan tanpa data → tampil "Belum ada data." tanpa galat (cek tiap chart saat runtime memakai filter yang menghasilkan data kosong).
- Nama unit/kategori panjang di sumbu dan angka rupiah besar di KPI → terpotong/membungkus rapi, tidak melebar.
- 375 px dan perubahan ukuran jendela → chart responsif, tanpa scroll horizontal halaman.
- Pengguna tanpa izin tertentu → pintasan hanya yang diizinkan, tidak ada tombol kosong (logika `candidateActions` tidak diubah).
- Halaman non-chart (mis. Aset, Pegawai) tidak ikut memuat ApexCharts (cek keluaran build: pecahan `apexcharts` terpisah).

---

### Task 1 (Tahap A – Chart ke ApexCharts)

**Files:**
- Create: `resources/js/lib/apex.ts`, `resources/js/Components/Charts/ApexChart.tsx`, `resources/js/Components/Charts/BarTren.tsx`
- Modify: `resources/js/Components/Charts/{DonutChart,KategoriAsetChart,SebaranUnitChart,TrenAktivitasChart,TrenAsetChart,TrenInsidenChart,TrenMutasiChart}.tsx`, `resources/js/lib/chartColors.ts`, `resources/js/Components/ChartLegend.tsx`, `package.json`, `package-lock.json`, `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md`

**Interfaces:**
- Produces: `ApexChart` (props `type`, `series`, `options: ApexOptions`, `height: number | string`); `chartOptions(overrides: ApexOptions): ApexOptions`; `tooltipHtml(title: string, lines: string[]): string`; `BarTren` (props di Step 4); `KATEGORI_PALETTE: string[]`. `DonutChart`, `KategoriAsetChart`, `SebaranUnitChart`, `TrenAktivitasChart`, `TrenAsetChart`, `TrenInsidenChart`, `TrenMutasiChart` mempertahankan props lama.

- [ ] **Step 1: Pasang dependensi dan periksa API**

```bash
npm install apexcharts react-apexcharts
```
Lalu verifikasi bentuk ekspor (versi sekarang `apexcharts` 8.x, `react-apexcharts` 2.x): `node -e "console.log(Object.keys(require('react-apexcharts')))"` dan baca `node_modules/react-apexcharts/types/react-apexcharts.d.ts` (atau `dist/*.d.ts`). Kode di plan memakai `import Chart from 'react-apexcharts'` dan `import type { ApexOptions } from 'apexcharts'`. Bila ekspor/tipenya berbeda, **hanya ubah baris impor di `ApexChart.tsx`/`apex.ts`**, jangan struktur lain.

- [ ] **Step 2: Opsi dasar `lib/apex.ts`**

```ts
import type { ApexOptions } from 'apexcharts';

const FONT = 'Figtree, ui-sans-serif, system-ui, sans-serif';

export const BASE_OPTIONS: ApexOptions = {
    chart: { fontFamily: FONT, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 400 } },
    grid: { borderColor: '#E2E8F0', strokeDashArray: 4 },
    legend: { fontSize: '13px', fontWeight: 500, labels: { colors: '#334155' }, itemMargin: { horizontal: 10, vertical: 4 } },
    xaxis: { labels: { style: { fontSize: '13px', colors: '#475569' } }, axisBorder: { color: '#CBD5E1' }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '13px', colors: '#475569' }, formatter: (v: number) => String(Math.round(v)) } },
    dataLabels: { style: { fontSize: '13px', fontWeight: 600 } },
    tooltip: { style: { fontSize: '13px' } },
    states: { hover: { filter: { type: 'lighten' } }, active: { filter: { type: 'none' } } },
};

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Gabung opsi dasar dengan opsi khusus chart; objek di tiap kunci level atas digabung satu tingkat. */
export function chartOptions(overrides: ApexOptions): ApexOptions {
    const out: Record<string, unknown> = { ...BASE_OPTIONS };
    for (const [key, value] of Object.entries(overrides)) {
        const base = out[key];
        out[key] = isPlain(base) && isPlain(value) ? { ...base, ...value } : value;
    }

    return out as ApexOptions;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Isi tooltip kustom: judul tebal + baris keterangan. */
export function tooltipHtml(title: string, lines: string[]): string {
    return `<div style="padding:8px 12px;font-family:${FONT};font-size:13px;line-height:1.5;color:#0F172A"><div style="font-weight:700">${esc(title)}</div>${lines
        .map((l) => `<div>${esc(l)}</div>`)
        .join('')}</div>`;
}
```

- [ ] **Step 3: Pembungkus lazy `Components/Charts/ApexChart.tsx`**

```tsx
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
        <Suspense fallback={<div className="animate-pulse rounded-lg bg-slate-100" style={{ height }} aria-hidden="true" />}>
            <Chart type={type} series={series} options={options} height={height} width="100%" />
        </Suspense>
    );
}
```

- [ ] **Step 4: Komponen tren bersama `Components/Charts/BarTren.tsx`**

```tsx
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
            formatter: (_v, opts) => labelLines(opts.dataPointIndex) as unknown as string,
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
```
Catatan: `formatter` mengembalikan larik string agar label tampil dua baris (didukung ApexCharts untuk label data). Bila saat cek runtime label tampil sebagai satu string bergabung koma, ganti `formatter` menjadi `labelLines(i).join(' · ')` dan `offsetY` menjadi `-22`.

- [ ] **Step 5: Tiga chart tren menjadi pembungkus tipis**

`TrenAsetChart.tsx`:
```tsx
import { rupiah, rupiahRingkas } from '@/lib/format';
import { LaporanAsetData } from '@/types';
import BarTren from './BarTren';

type Tren = LaporanAsetData['tren'];

export default function TrenAsetChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
    }

    return (
        <BarTren
            categories={data.map((d) => String(d.tahun))}
            values={data.map((d) => d.jumlah)}
            color="#1E40AF"
            ariaLabel="Grafik jumlah aset per tahun perolehan"
            minPerItem={96}
            labelLines={(i) => [`${data[i].jumlah} aset`, rupiahRingkas(data[i].nilai_perolehan)]}
            tooltipTitle={(i) => `Tahun ${data[i].tahun}`}
            tooltipLines={(i) => [`${data[i].jumlah} aset`, `Nilai perolehan: ${rupiah(data[i].nilai_perolehan)}`, `Nilai buku: ${rupiah(data[i].nilai_buku)}`]}
            table={{
                caption: 'Aset per tahun perolehan',
                head: ['Tahun', 'Jumlah', 'Nilai perolehan'],
                rows: data.map((d) => [d.tahun, d.jumlah, rupiah(d.nilai_perolehan)]),
            }}
        />
    );
}
```

`TrenMutasiChart.tsx`:
```tsx
import { bulanLabel } from '@/lib/format';
import { LaporanMutasiData } from '@/types';
import BarTren from './BarTren';

type Tren = LaporanMutasiData['tren'];

export default function TrenMutasiChart({ data }: { data: Tren }) {
    if (data.length === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada mutasi yang disetujui.</p>;
    }

    return (
        <BarTren
            categories={data.map((d) => bulanLabel(d.bulan))}
            values={data.map((d) => d.jumlah_mutasi)}
            color="#6D28D9"
            ariaLabel="Grafik jumlah mutasi disetujui per bulan"
            minPerItem={96}
            labelLines={(i) => [`${data[i].jumlah_mutasi} mutasi`, `${data[i].aset_berpindah} aset`]}
            tooltipTitle={(i) => bulanLabel(data[i].bulan)}
            tooltipLines={(i) => [`${data[i].jumlah_mutasi} mutasi disetujui`, `${data[i].aset_berpindah} aset berpindah`]}
            table={{
                caption: 'Mutasi disetujui per bulan',
                head: ['Bulan', 'Mutasi', 'Aset berpindah'],
                rows: data.map((d) => [bulanLabel(d.bulan), d.jumlah_mutasi, d.aset_berpindah]),
            }}
        />
    );
}
```

`TrenInsidenChart.tsx`:
```tsx
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
```

- [ ] **Step 6: `DonutChart.tsx`**

```tsx
import { chartOptions } from '@/lib/apex';
import ApexChart from './ApexChart';

export interface DonutSlice {
    label: string;
    jumlah: number;
    persen: number;
    color: string;
}

export default function DonutChart({ data, ariaLabel, unit = 'aset' }: { data: DonutSlice[]; ariaLabel: string; unit?: string }) {
    const total = data.reduce((sum, s) => sum + s.jumlah, 0);

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>;
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
                        name: { show: true, fontSize: '14px', fontWeight: 500, color: '#475569', offsetY: 18 },
                        value: { show: true, fontSize: '28px', fontWeight: 700, color: '#0F172A', offsetY: -14, formatter: (v: string) => Number(v).toLocaleString('id-ID') },
                        total: { show: true, label: `Total ${unit}`, fontSize: '14px', color: '#475569', formatter: () => total.toLocaleString('id-ID') },
                    },
                },
            },
        },
        tooltip: { y: { formatter: (v: number, opts: { seriesIndex: number }) => `${v.toLocaleString('id-ID')} ${unit} (${data[opts.seriesIndex].persen}%)` } },
    });

    return (
        <div role="img" aria-label={ariaLabel} className="mx-auto max-w-72">
            <ApexChart type="donut" series={data.map((s) => s.jumlah)} options={options} height={280} />
        </div>
    );
}
```

- [ ] **Step 7: `KategoriAsetChart.tsx`** (batang horizontal berwarna) dan palet

Tambahkan di akhir `lib/chartColors.ts`:
```ts
export const KATEGORI_PALETTE = ['#1E40AF', '#6D28D9', '#0F766E', '#047857', '#0369A1', '#4338CA', '#BE185D'];
```
`KategoriAsetChart.tsx`:
```tsx
import { chartOptions, tooltipHtml } from '@/lib/apex';
import { KATEGORI_PALETTE } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { DashboardData } from '@/types';
import ApexChart from './ApexChart';

type PerKategori = DashboardData['per_kategori'];

export default function KategoriAsetChart({ data }: { data: PerKategori }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada aset.</p>;
    }

    // Maksimal 7 kategori teratas agar proporsional
    const displayData = data.slice(0, 7);

    const options = chartOptions({
        colors: KATEGORI_PALETTE,
        plotOptions: { bar: { horizontal: true, distributed: true, barHeight: '68%', borderRadius: 6, borderRadiusApplication: 'end' } },
        legend: { show: false },
        dataLabels: { enabled: true, style: { fontSize: '13px', fontWeight: 700, colors: ['#FFFFFF'] }, formatter: (v: number) => `${v}` },
        grid: { padding: { left: 4, right: 8 } },
        xaxis: { categories: displayData.map((k) => k.nama), labels: { formatter: (v: string) => String(Math.round(Number(v))) } },
        yaxis: { labels: { style: { fontSize: '13px', colors: '#334155', fontWeight: 500 }, maxWidth: 160, formatter: (v: string | number) => { const s = String(v); return s.length > 20 ? `${s.slice(0, 18)}…` : s; } } },
        tooltip: { custom: ({ dataPointIndex }) => { const k = displayData[dataPointIndex]; return tooltipHtml(k.nama, [`Jumlah: ${k.jumlah} aset`, `Nilai buku: ${rupiah(k.nilai_buku)}`]); } },
    });

    return (
        <div>
            <div role="img" aria-label="Grafik jumlah aset berdasarkan kategori">
                <ApexChart type="bar" series={[{ name: 'Aset', data: displayData.map((k) => k.jumlah) }]} options={options} height={displayData.length * 46 + 40} />
            </div>
            <table className="sr-only">
                <caption>Aset per Kategori</caption>
                <thead>
                    <tr>
                        <th>Kategori</th>
                        <th>Jumlah</th>
                        <th>Nilai Buku</th>
                    </tr>
                </thead>
                <tbody>
                    {displayData.map((k) => (
                        <tr key={k.id}>
                            <td>{k.nama}</td>
                            <td>{k.jumlah} aset</td>
                            <td>{rupiah(k.nilai_buku)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 8: `SebaranUnitChart.tsx`** (bertumpuk) dan `TrenAktivitasChart.tsx` (area)

`SebaranUnitChart.tsx`:
```tsx
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
```

`TrenAktivitasChart.tsx`:
```tsx
import { chartOptions } from '@/lib/apex';
import { bulanLabel } from '@/lib/format';
import { DashboardData } from '@/types';
import ApexChart from './ApexChart';

type TrenAktivitas = DashboardData['tren_aktivitas'];

export default function TrenAktivitasChart({ data }: { data: TrenAktivitas }) {
    if (!data || data.length === 0) {
        return <p className="py-12 text-center text-sm text-slate-400">Belum ada transaksi dalam 6 bulan terakhir.</p>;
    }

    const options = chartOptions({
        colors: ['#2563EB', '#4F46E5', '#DC2626', '#D97706'],
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.02, stops: [0, 95, 100] } },
        markers: { size: 4, strokeWidth: 2, strokeColors: '#FFFFFF' },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' },
        xaxis: { categories: data.map((d) => bulanLabel(d.bulan)) },
        yaxis: { min: 0, forceNiceScale: true },
        tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => `${v} transaksi` } },
    });

    return (
        <div>
            <div role="img" aria-label="Grafik volume transaksi per bulan selama 6 bulan terakhir">
                <ApexChart
                    type="area"
                    series={[
                        { name: 'Penerimaan', data: data.map((d) => d.penerimaan) },
                        { name: 'Mutasi', data: data.map((d) => d.mutasi) },
                        { name: 'Rusak/Hilang', data: data.map((d) => d.rusak_hilang) },
                        { name: 'Permohonan', data: data.map((d) => d.permohonan) },
                    ]}
                    options={options}
                    height={300}
                />
            </div>
            <table className="sr-only">
                <caption>Tren Aktivitas Transaksi 6 Bulan Terakhir</caption>
                <thead>
                    <tr>
                        <th>Bulan</th>
                        <th>Penerimaan</th>
                        <th>Mutasi</th>
                        <th>Rusak & Hilang</th>
                        <th>Permohonan</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.bulan}>
                            <td>{bulanLabel(d.bulan)}</td>
                            <td>{d.penerimaan} transaksi</td>
                            <td>{d.mutasi} transaksi</td>
                            <td>{d.rusak_hilang} laporan</td>
                            <td>{d.permohonan} permohonan</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 9: Legenda donat lebih besar** — di `Components/ChartLegend.tsx` ubah kelas `text-sm` pada `<ul>` menjadi `text-base`, kotak warna `size-3` menjadi `size-3.5`, dan `mt-4 space-y-2` menjadi `mt-4 space-y-2.5` (teks legenda minimal ±14–16px untuk pengguna usia lanjut).

- [ ] **Step 10: Verifikasi, cabut Chart.js, dan commit**

```bash
npx tsc --noEmit
```
Perbaiki galat tipe seperlunya (mis. tipe `formatter` Apex), tanpa mengubah perilaku. Pastikan tidak ada sisa impor:
```bash
grep -rn "chart.js\|react-chartjs-2\|chartjs-plugin" resources/js
```
Hasil harus kosong. Lalu:
```bash
npm uninstall chart.js react-chartjs-2 chartjs-plugin-datalabels
npm run build 2>&1 | tail -15
```
Pastikan keluaran build memuat pecahan terpisah untuk apexcharts (bukan di `app-*.js`). Tambahkan di `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` (bagian 9) satu butir: "**Chart**: ApexCharts via `Components/Charts/ApexChart` (dimuat lazy), opsi dasar di `lib/apex.ts`. Lisensi ApexCharts Community (gratis di bawah US$2 juta pendapatan/anggaran per tahun); pakai hanya jenis chart gratis (donat, batang, area/garis)." Lalu:
```bash
git add package.json package-lock.json resources/js/lib/apex.ts resources/js/lib/chartColors.ts resources/js/Components/Charts resources/js/Components/ChartLegend.tsx docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md
git commit -m "feat(charts): migrate all charts from Chart.js to ApexCharts"
```
Expected: `tsc` dan build bersih; commit tidak menyertakan `docs/*.xlsx|pdf`.

- [ ] **Step 11: Tes terkait dan cek runtime, lalu GERBANG TAHAP A — berhenti**

```bash
php artisan test --compact --filter='Dashboard|Laporan'
```
Cek runtime headless (Playwright; jangan ubah data): buka Dashboard dan tiga laporan (login demo `kasubag@simaset.test`/`password`, lalu `admin.kelurahan@simaset.test` untuk tampilan terbatas), tidak ada galat konsol, tidak ada scroll horizontal di 375 px, label data dua baris tampil benar (lihat catatan Step 4), dan label batang kategori aset terbaca pada batang pendek (nilai 1–2); bila terpotong, ubah `dataLabels` di `KategoriAsetChart` menjadi `textAnchor: 'start'`, `offsetX: 6`, warna `#0F172A` (label gelap di ujung batang), halaman Aset tidak memuat pecahan apexcharts (periksa permintaan jaringan). Laporkan hasilnya. Minta pengguna menilai: semua chart (donat dengan total di tengah, batang tren berlabel, kategori berwarna-warni, sebaran unit bertumpuk, tren aktivitas area), tooltip, teks cukup besar, 375 px. Setelah lolos baru Task 2.

---

### Task 2 (Tahap B – KPI card, Dashboard, Laporan)

**Files:**
- Create: `resources/js/lib/tone.ts`
- Modify: `resources/js/Components/StatCard.tsx`, `resources/js/Components/ReportCard.tsx`, `resources/js/lib/format.ts`, `resources/js/Pages/Dashboard.tsx`, `resources/js/Pages/LaporanAset/Index.tsx`, `resources/js/Pages/LaporanMutasi/Index.tsx`, `resources/js/Pages/LaporanRusakHilang/Index.tsx`, `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md`

**Interfaces:**
- Consumes: Task 1 (komponen chart tidak berubah antarmukanya).
- Produces: `Tone` dan `TONE` di `lib/tone.ts`; `StatCard` props baru `icon?: ComponentType<{ className?: string }>`, `tone?: Tone`; `ReportCard` props baru `icon?`, `tone?`; `sapaan(date?: Date): string` dan `tanggalLengkap(date?: Date): string` di `lib/format.ts`.

- [ ] **Step 1: Peta warna `lib/tone.ts`**

```ts
export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal' | 'slate';

/** Kelas Tailwind dituliskan utuh agar terbaca pemindai kelas. */
export const TONE: Record<Tone, { card: string; chip: string; soft: string; value: string; accent: string; solid: string }> = {
    blue: { card: 'border-blue-200 bg-blue-50', chip: 'bg-blue-700 text-white', soft: 'bg-blue-100 text-blue-700', value: 'text-blue-950', accent: 'border-t-blue-600', solid: 'bg-blue-800 hover:bg-blue-900 focus-visible:ring-blue-800' },
    green: { card: 'border-emerald-200 bg-emerald-50', chip: 'bg-emerald-700 text-white', soft: 'bg-emerald-100 text-emerald-700', value: 'text-emerald-950', accent: 'border-t-emerald-600', solid: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-700' },
    amber: { card: 'border-amber-200 bg-amber-50', chip: 'bg-amber-600 text-white', soft: 'bg-amber-100 text-amber-700', value: 'text-amber-950', accent: 'border-t-amber-500', solid: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600' },
    red: { card: 'border-red-200 bg-red-50', chip: 'bg-red-700 text-white', soft: 'bg-red-100 text-red-700', value: 'text-red-950', accent: 'border-t-red-600', solid: 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-700' },
    violet: { card: 'border-violet-200 bg-violet-50', chip: 'bg-violet-700 text-white', soft: 'bg-violet-100 text-violet-700', value: 'text-violet-950', accent: 'border-t-violet-600', solid: 'bg-violet-700 hover:bg-violet-800 focus-visible:ring-violet-700' },
    teal: { card: 'border-teal-200 bg-teal-50', chip: 'bg-teal-700 text-white', soft: 'bg-teal-100 text-teal-700', value: 'text-teal-950', accent: 'border-t-teal-600', solid: 'bg-teal-700 hover:bg-teal-800 focus-visible:ring-teal-700' },
    slate: { card: 'border-slate-200 bg-slate-50', chip: 'bg-slate-700 text-white', soft: 'bg-slate-100 text-slate-700', value: 'text-slate-900', accent: 'border-t-slate-500', solid: 'bg-slate-700 hover:bg-slate-800 focus-visible:ring-slate-700' },
};
```

- [ ] **Step 2: `StatCard.tsx` baru**

```tsx
import { Tone, TONE } from '@/lib/tone';
import { ComponentType, ReactNode } from 'react';

export default function StatCard({
    label,
    value,
    note,
    badge,
    icon: Icon,
    tone = 'blue',
}: {
    label: string;
    value: string;
    note?: string;
    badge?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
    tone?: Tone;
}) {
    const t = TONE[tone];

    return (
        <div className={`rounded-xl border p-5 shadow-xs ${t.card}`}>
            <div className="flex items-start gap-4">
                {Icon && (
                    <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${t.chip}`}>
                        <Icon className="size-6" aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">{label}</p>
                    <p className={`mt-1 break-words text-[28px] font-bold leading-9 tracking-tight tabular-nums sm:text-[32px] sm:leading-10 ${t.value}`}>{value}</p>
                    {badge && <div className="mt-2">{badge}</div>}
                    {note && <p className="mt-1 text-sm text-slate-600">{note}</p>}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: `ReportCard.tsx` — ikon judul dan garis aksen**

Tambahkan prop `icon?: ComponentType<{ className?: string }>` dan `tone?: Tone` (default `'slate'`), impor `Tone, TONE` dari `@/lib/tone` dan `ComponentType`, dan `const t = TONE[tone]`. Ubah kelas pembungkus menjadi `` `rounded-xl border border-t-[3px] border-slate-200 ${t.accent} bg-white shadow-xs ...` ``, dan judul menjadi:
```tsx
<div className="flex items-center gap-3">
    {Icon && (
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${t.soft}`}>
            <Icon className="size-5" aria-hidden="true" />
        </span>
    )}
    <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
    </div>
</div>
```
(menggantikan `<div><h2 …>…</div>` lama; sisanya tetap).

- [ ] **Step 4: Helper di `lib/format.ts`** (tambahkan di akhir)

```ts
/** Sapaan menurut jam: "Selamat pagi" … "Selamat malam". */
export const sapaan = (date: Date = new Date()): string => {
    const h = date.getHours();

    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};

/** "Kamis, 15 Oktober 2026". */
export const tanggalLengkap = (date: Date = new Date()): string =>
    date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
```

- [ ] **Step 5: Dashboard — banner, pintasan, KPI, antrean, ikon kartu**

Di `Pages/Dashboard.tsx`:

1. Impor tambahan: `import { sapaan, tanggalLengkap } from '@/lib/format'` (gabungkan ke impor `rupiah, tanggalSingkat` yang ada), `import { TONE } from '@/lib/tone'`, dan ikon `AlertTriangle, BarChart01, BarChartSquare02, Building01, CheckCircle, Coins01, Inbox01, LineChartUp01, Package, PieChart01, PlusCircle, QrCode01, Send01, Wallet02` dari `@untitledui/icons` (gabungkan ke impor `ArrowRight, Bell01`).
2. Hapus blok header lama (`<div className="flex flex-wrap items-end justify-between gap-3">…</div>` yang berisi `<h1>Dashboard</h1>` dan Select unit) dan ganti dengan banner:
```tsx
<div className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-950 p-6 text-white shadow-sm">
    <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-9 tracking-tight">
                {sapaan()}, {auth.user?.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-blue-100">
                <span>
                    Login sebagai <strong className="text-white">{role}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>{auth.user?.unit?.name ?? 'Kecamatan Sagulung'}</span>
                <span aria-hidden="true">·</span>
                <span>{tanggalLengkap()}</span>
            </p>
        </div>
        {d.units.length > 0 && (
            <div className="w-full sm:w-64">
                <Select aria-label="Filter unit" size="md" items={…sama seperti sebelumnya…} selectedKey={…} onSelectionChange={…}>
                    {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
            </div>
        )}
    </div>
</div>
```
(isi `Select` dipindahkan apa adanya dari header lama). `<Head title="Dashboard" />` tetap.
3. Tambahkan `icon` dan `tone` ke tiap entri `candidateActions` (tipe entri menjadi `{ label; href; permission; icon: ComponentType<{ className?: string }>; tone: Tone }`; tambahkan `ComponentType` ke impor `react` dan `Tone` ke impor `@/lib/tone`). Warna **tetap per aksi** (tidak bergilir) agar pengguna mengingatnya: Kotak Persetujuan `Inbox01`/`violet`, Scan QR `QrCode01`/`teal`, Data Aset `Package`/`blue`, Laporan `BarChart01`/`green`, Catat Aset `PlusCircle`/`blue`, Buat Permohonan `Send01`/`violet`, Lapor Rusak/Hilang `AlertTriangle`/`green`.
Ganti blok `actions.length > 0 && (…)` dengan:
```tsx
{actions.length > 0 && (
    <section aria-labelledby="pintasan">
        <h2 id="pintasan" className="mb-3 text-xl font-semibold text-slate-900">
            Pintasan
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((a) => (
                <Link
                    key={a.label}
                    href={a.href}
                    className={`flex items-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold text-white shadow-md outline-hidden transition focus-visible:ring-2 focus-visible:ring-offset-2 ${TONE[a.tone].solid}`}
                >
                    <a.icon className="size-7 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{a.label}</span>
                </Link>
            ))}
        </div>
    </section>
)}
```
4. KPI: tambahkan `icon`/`tone`:
   - Total Aset → `icon={Package} tone="blue"`.
   - Total Nilai Aset → `icon={Wallet02} tone="teal"` (teal, bukan hijau, agar tidak berdampingan dengan kartu "Kondisi Baik" yang hijau).
   - Aset Kondisi Baik → `icon={CheckCircle} tone="green"`.
   - Aset Rusak / Hilang → `icon={AlertTriangle} tone="red"`.
5. Kartu antrean: tambahkan ikon/nada ke `queueCandidates` (`icon`, `tone`): persetujuan `Inbox01`/`amber`, permohonan `Send01`/`blue`, laporan `AlertTriangle`/`red`, mutasi `Package`? gunakan `SwitchHorizontal01`/`violet` (tambahkan ke impor ikon). Render:
```tsx
{queue.map((q) => (
    <Link
        key={q.label}
        href={q.href}
        className={`flex items-center gap-4 rounded-xl border p-5 shadow-xs outline-hidden transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${TONE[q.tone].card}`}
    >
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${TONE[q.tone].chip}`}>
            <q.icon className="size-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
            <span className={`block text-3xl font-bold tabular-nums ${TONE[q.tone].value}`}>{q.value}</span>
            <span className="block text-sm font-medium text-slate-700">{q.label}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
    </Link>
))}
```
6. `ReportCard` Dashboard: tambahkan `icon`/`tone` — Proporsi Kondisi Aset `PieChart01`/`blue`; Aset per Kategori `BarChartSquare02`/`violet`; Sebaran Aset per Unit `Building01`/`teal`; Tren Aktivitas `LineChartUp01`/`green`. Teks `aside` kecil (`text-xs`) naik ke `text-sm`.
   `Coins01` tidak dipakai di Dashboard; hapus dari impor bila tak terpakai (tsc akan memberi tahu).

- [ ] **Step 6: Laporan — KPI dan ikon kartu**

`LaporanAset/Index.tsx`: impor `Coins01, File05, Wallet02`? Gunakan peta berikut dan tambahkan impor ikon dari `@untitledui/icons`:
- `Jumlah Aset` → `icon={Package} tone="blue"`; `Total Nilai Perolehan` → `icon={Coins01} tone="green"`; `Total Nilai Buku` → `icon={Wallet02} tone="teal"`.
- `ReportCard`: Persentase per Kondisi `PieChart01`/`blue`; Tren per Tahun Perolehan `BarChart01`/`teal`; Rekap per Kategori `Grid01`/`violet`; Rekap per Unit `Building01`/`teal`; Daftar Rinci `File05`/`slate`.

`LaporanMutasi/Index.tsx`:
- `Jumlah Mutasi` → `File05`/`blue`; `Mutasi Disetujui` → `CheckCircle`/`green`; `Aset Berpindah` → `SwitchHorizontal01`/`violet`; `Nilai Perolehan Aset Berpindah` → `Coins01`/`green`; `Rata-rata Lama Proses` → `Clock`/`teal`.
- Grid KPI: ganti `lg:grid-cols-5` menjadi `lg:grid-cols-3 xl:grid-cols-5` (angka rupiah 32px butuh lebar).
- `ReportCard`: Komposisi per Status `PieChart01`/`blue`; Komposisi per Jenis Mutasi `PieChart01`/`violet`; Tren Mutasi per Bulan `LineChartUp01`/`green`; Arus Antar Unit `ArrowsRight`/`teal`; Kinerja Persetujuan `Clock`/`amber`? tidak (amber untuk peringatan) → `Clock`/`teal`; Daftar Rinci `File05`/`slate`.

`LaporanRusakHilang/Index.tsx`:
- `Jumlah Laporan` → `File05`/`blue`; `Laporan Disetujui` → `CheckCircle`/`green`; `Nilai Perolehan Terdampak` → `Coins01`/`red`; `Nilai Buku Terdampak` → `Wallet02`/`red`; `Rata-rata Lama Proses` → `Clock`/`teal`. Grid KPI sama seperti Mutasi (`lg:grid-cols-3 xl:grid-cols-5`).
- `ReportCard`: Komposisi per Status `PieChart01`/`blue`; Komposisi per Kondisi Insiden `PieChart01`/`red`; Tren Insiden per Bulan `LineChartUp01`/`red`; Sebaran Insiden per Unit Kerja `Building01`/`teal`; Kinerja Persetujuan `Clock`/`teal`; Daftar Rinci `File05`/`slate`.

- [ ] **Step 7: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Dashboard|Laporan'
```
Tambahkan di panduan UI/UX bagian 9: butir "**KPI card**: `StatCard` dengan `icon` + `tone` (peta di `lib/tone.ts`); satu data, satu ikon dan warna yang sesuai maknanya; pintasan Dashboard memakai warna solid (`TONE[...].solid`) agar berbeda dari KPI card berlatar lembut."
```bash
git add resources/js/lib/tone.ts resources/js/lib/format.ts resources/js/Components/StatCard.tsx resources/js/Components/ReportCard.tsx resources/js/Pages/Dashboard.tsx resources/js/Pages/LaporanAset/Index.tsx resources/js/Pages/LaporanMutasi/Index.tsx resources/js/Pages/LaporanRusakHilang/Index.tsx docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md
git commit -m "feat(dashboard): colorful KPI cards with icons, welcome banner, solid shortcuts, and icon card titles"
```
Expected: bersih; tes hijau.

- [ ] **Step 8: Suite penuh dan GERBANG TAHAP B — berhenti**

Jalankan suite penuh di latar belakang (`php artisan test --compact`, ±10 menit) dan laporkan. Cek runtime headless Dashboard (dua akun: approver dan non-approver) dan tiga laporan: tanpa galat konsol, tanpa scroll horizontal di 375 px, nilai rupiah panjang membungkus rapi, pintasan sesuai izin (non-approver tanpa `aset.create` tidak melihat "Catat Aset"). Minta pengguna menilai: KPI card (warna dan ikon sesuai data), pintasan jelas berbeda dari KPI card, banner, ikon judul kartu, ukuran teks, 375 px, keyboard/fokus. Setelah lolos: perbarui memori proyek (`project-sibima-progress`); lanjut ke sisa pembersihan (cabut `@headlessui/react` bila disetujui, review whole-branch) dan minta persetujuan sebelum push.

---

## Catatan Self-Review

- Cakupan spec: chart (Task 1), KPI/banner/pintasan/ikon judul/teks besar (Task 2), lisensi tercatat di panduan, lazy load (`ApexChart` + cek build), Review Focus punya langkah cek di gerbang masing-masing.
- Penyimpangan kecil dari spec yang disengaja: Total Nilai Aset di Dashboard memakai teal (bukan hijau) agar tidak berdampingan dengan kartu hijau "Kondisi Baik"; Kinerja Persetujuan memakai teal karena amber dicadangkan untuk peringatan.
- Konsistensi tipe: `Tone`/`TONE` (Task 2 Step 1) dipakai `StatCard`, `ReportCard`, Dashboard; `chartOptions`/`tooltipHtml` (Task 1 Step 2) dipakai semua chart; `BarTren` props sama dengan pemakainya.
- Risiko diketahui: API `react-apexcharts` 2.x diverifikasi di Step 1 Task 1; label data dua baris diverifikasi saat runtime (ada jalan mundur tertulis di Step 4).

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: `ReportCard` memakai `tone` default `slate` tanpa percabangan; ikon pintasan langsung di `candidateActions` (peta per label dihapus); prop `seriesName` `BarTren` dihapus. `ApexChart` lazy, `lib/tone.ts`, dan `BarTren` dipertahankan karena punya banyak pemanggil/diminta spec.
- Impeccable (Operate, pengguna lansia): warna pintasan **tetap per aksi** (bukan bergilir) agar mudah diingat; kartu antrean diberi panah agar berbeda dari KPI card yang tidak bisa diklik; gradien area tren aktivitas ditipiskan agar empat seri tetap terbaca; cek runtime untuk label batang pendek di chart kategori dengan jalan mundur tertulis.
