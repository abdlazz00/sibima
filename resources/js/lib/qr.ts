// ponytail: matches SIBIMA token scan URLs or raw 16-char tokens. Legacy numeric ID URLs return null.
export function qrTokenFromScan(text: string): string | null {
    let path: string;
    try {
        path = new URL(text.trim()).pathname;
    } catch {
        const raw = text.trim();
        return /^[A-Za-z0-9]{16}$/.test(raw) ? raw : null;
    }

    const match = path.match(/^\/scan\/([A-Za-z0-9]{16})\/?$/);
    return match ? match[1] : null;
}
