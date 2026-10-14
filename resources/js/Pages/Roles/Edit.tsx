import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RoleForm, { RoleFormData } from '@/Pages/Roles/Partials/RoleForm';
import { PageProps, RoleItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface EditProps extends PageProps {
    role: RoleItem;
    permissionGroups: Record<string, string[]>;
}

export default function Edit({ role, permissionGroups }: EditProps) {
    const form = useForm<RoleFormData>({
        name: role.name,
        display_name: role.display_name,
        unit_scope: role.unit_scope,
        unit_head_of: role.unit_head_of ?? '',
        description: role.description ?? '',
        permissions: role.permissions ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            unit_head_of: data.unit_head_of || null,
            description: data.description.trim() || null,
        }));

        form.put(route('roles.update', role.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Role - ${role.display_name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Role', href: route('roles.index') }, { label: 'Ubah Role' }]}
                    title={`Ubah Role: ${role.display_name}`}
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Sesuaikan nama, cakupan data unit, dan izin akses untuk role ini.
                </p>
                {role.users_count > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Role ini dipakai oleh <span className="font-semibold tabular-nums">{role.users_count}</span> pengguna;
                        perubahan izin dan cakupan berlaku langsung bagi mereka.
                    </p>
                )}

                <RoleForm
                    form={form}
                    permissionGroups={permissionGroups}
                    isSystemRole={role.is_system}
                    submitLabel="Perbarui Role"
                    onSubmit={submit}
                    cancelHref={route('roles.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
