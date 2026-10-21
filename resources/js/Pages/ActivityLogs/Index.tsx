import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import React from 'react';

export default function Index(props: PageProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Log Aktivitas Sistem" />
            <div className="p-6">
                <h1>Log Aktivitas Sistem</h1>
            </div>
        </AuthenticatedLayout>
    );
}
