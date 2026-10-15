import { Button } from '@/Components/ui/base/buttons/button';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';

type Modul = 'aset' | 'pegawai' | 'kategori';

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
                <Button color="primary-teal" size="md" href={route('import.show', modul)}>
                    Impor
                </Button>
            )}
            {canExport && (
                <Button
                    color="primary-teal"
                    size="md"
                    onPress={() => {
                        window.location.href = route('export', { modul, ...params });
                    }}
                >
                    Ekspor
                </Button>
            )}
        </>
    );
}
