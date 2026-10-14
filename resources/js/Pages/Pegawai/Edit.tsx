import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PegawaiForm, { PegawaiFormData, UnitOption } from '@/Pages/Pegawai/Partials/PegawaiForm';
import { PageProps, Pegawai } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface EditProps extends PageProps {
    pegawai: Pegawai;
    units: UnitOption[];
}

export default function Edit({ pegawai, units }: EditProps) {
    const form = useForm<PegawaiFormData>({
        nama: pegawai.nama || '',
        nip: pegawai.nip || '',
        status_kepegawaian: (pegawai.status_kepegawaian || 'pns') as 'pns' | 'pppk',
        no_hp: pegawai.no_hp || '',
        email_dinas: pegawai.email_dinas || '',
        pangkat_golongan: pegawai.pangkat_golongan || '',
        jabatan: pegawai.jabatan || '',
        unit_id: String(pegawai.unit_id || (units[0]?.id ? units[0].id : '')),
        foto_profile: null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // Spoofing metode lewat transform agar galat validasi masuk ke `form.errors`.
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(route('pegawais.update', pegawai.id), {
            forceFormData: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Edit Pegawai: ${pegawai.nama}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[
                        { label: 'Data Pegawai', href: route('pegawais.index') },
                        { label: pegawai.nama, href: route('pegawais.show', pegawai.id) },
                        { label: 'Edit Pegawai' },
                    ]}
                    title="Edit Data Pegawai"
                />

                <PegawaiForm
                    form={form}
                    units={units}
                    existingPhotoUrl={pegawai.foto_profile ? `/storage/${pegawai.foto_profile}` : null}
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('pegawais.show', pegawai.id)}
                />
            </div>
        </AuthenticatedLayout>
    );
}
