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
