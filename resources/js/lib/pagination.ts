export function pageNumbersWithGaps(current: number, last: number): (number | '...')[] {
    if (last <= 7) {
        return Array.from({ length: last }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, 2, last - 1, last, current - 1, current, current + 1]);
    const sorted = Array.from(pages)
        .filter((p) => p >= 1 && p <= last)
        .sort((a, b) => a - b);

    const result: (number | '...')[] = [];
    sorted.forEach((page, idx) => {
        if (idx > 0 && page - (sorted[idx - 1] as number) > 1) {
            result.push('...');
        }
        result.push(page);
    });

    return result;
}
