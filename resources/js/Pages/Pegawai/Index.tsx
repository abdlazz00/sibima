import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

export default function Index({ pegawais }: PageProps<{ pegawais: unknown[] }>) {
    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Data Pegawai</h1>}>
            <Head title="Data Pegawai" />
            <p className="text-sm text-gray-500">{pegawais.length} pegawai.</p>
        </AuthenticatedLayout>
    );
}
