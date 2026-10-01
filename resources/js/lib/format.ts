export const rupiah = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/** Compact rupiah for chart labels, e.g. "Rp 1,2 jt". */
export const rupiahRingkas = (n: number): string =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
