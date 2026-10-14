export const rupiah = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/** Compact rupiah for chart labels, e.g. "Rp 1,2 jt". */
export const rupiahRingkas = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** "2026-10" -> "Okt 2026". */
export const bulanLabel = (ym: string): string => {
    const [year, month] = ym.split('-').map(Number);

    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

/** "2026-10-14" -> "14 Oktober 2026". */
export const tanggal = (value?: string | null): string =>
    value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

/** "2026-10-14T08:30:00Z" -> "14 Okt 2026 15.30". */
export const tanggalWaktu = (value?: string | null): string =>
    value
        ? new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

/** "2026-10-14" -> "14/10/2026"; kosong -> "—". */
export const tanggalSingkat = (value?: string | null): string => (value ? new Date(value).toLocaleDateString('id-ID') : '—');
