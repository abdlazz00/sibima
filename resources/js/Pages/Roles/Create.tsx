import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RoleForm, { RoleFormData } from '@/Pages/Roles/Partials/RoleForm';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    permissionGroups: Record<string, string[]>;
}

export default function Create({ permissionGroups }: CreateProps) {
    const form = useForm<RoleFormData>({
        name: '',
        display_name: '',
        unit_scope: 'own',
        unit_head_of: '',
        description: '',
        permissions: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            unit_head_of: data.unit_head_of || null,
            description: data.description.trim() || null,
        }));

        form.post(route('roles.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Role Baru" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Role', href: route('roles.index') }, { label: 'Tambah Role' }]}
                    title="Tambah Role Baru"
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Definisikan role baru beserta hak akses granular modul aplikasi.
                </p>

                <RoleForm
                    form={form}
                    permissionGroups={permissionGroups}
                    submitLabel="Simpan Role"
                    onSubmit={submit}
                    cancelHref={route('roles.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
