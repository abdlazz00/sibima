import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';

type Modul = 'aset' | 'pegawai' | 'kategori';

const BUTTON =
    'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2';

export default function ImportExportButtons({ modul, query = {} }: { modul: Modul; query?: object }) {
    const permissions = usePage<PageProps>().props.auth.user?.permissions ?? [];
    const canImport = permissions.includes(`import-${modul}`);
    const canExport = permissions.includes(`export-${modul}`);

    if (!canImport && !canExport) return null;

    const params = Object.fromEntries(
        Object.entries(query as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );

    return (
        <>
            {canImport && (
                <Link href={route('import.show', modul)} className={BUTTON}>
                    Impor
                </Link>
            )}
            {canExport && (
                <a href={route('export', { modul, ...params })} className={BUTTON}>
                    Ekspor
                </a>
            )}
        </>
    );
}
