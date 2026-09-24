import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';

export default function Dashboard() {
    const { auth } = usePage<PageProps>().props;

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="rounded-lg bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-gray-800">
                    Selamat datang, {auth.user?.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Anda login sebagai <strong>{auth.user?.roles?.[0]}</strong> di{' '}
                    {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}
