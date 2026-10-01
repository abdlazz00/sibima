// ponytail: matches only this app's own URL shapes; the id is validated server-side by scan.show.
export function assetIdFromQr(text: string): number | null {
    let path: string;
    try {
        path = new URL(text.trim()).pathname;
    } catch {
        return null;
    }

    const match = path.match(/^\/(?:scan|assets)\/(\d+)\/?$/);

    return match ? Number(match[1]) : null;
}
