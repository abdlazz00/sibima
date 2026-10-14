import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PegawaiForm, { PegawaiFormData, UnitOption } from '@/Pages/Pegawai/Partials/PegawaiForm';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    units: UnitOption[];
}

export default function Create({ units }: CreateProps) {
    const form = useForm<PegawaiFormData>({
        nama: '',
        nip: '',
        status_kepegawaian: 'pns',
        no_hp: '',
        email_dinas: '',
        pangkat_golongan: '',
        jabatan: '',
        unit_id: units[0]?.id ? String(units[0].id) : '',
        foto_profile: null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.store'), {
            forceFormData: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Pegawai Baru" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Pegawai', href: route('pegawais.index') }, { label: 'Tambah Pegawai' }]}
                    title="Tambah Pegawai Baru"
                />

                <PegawaiForm
                    form={form}
                    units={units}
                    submitLabel="Simpan Pegawai"
                    onSubmit={submit}
                    cancelHref={route('pegawais.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
