import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AssetForm, { AssetFormData } from '@/Pages/Assets/Partials/AssetForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    categories: AssetCategory[];
    kondisiOptions: { value: string; label: string }[];
    maxPhotos: number;
}

export default function Create({ categories, kondisiOptions, maxPhotos }: CreateProps) {
    const form = useForm<AssetFormData>({
        category_id: '',
        kode_barang: '',
        nama_aset: '',
        merk_type: '',
        kondisi: 'baik',
        tanggal_perolehan: '',
        sumber_perolehan: '',
        nilai_perolehan: '',
        nilai_buku: '',
        no_dokumen: '',
        keterangan: '',
        photos: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('assets.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Aset Baru" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Tambah Aset Baru' }]}
                    title="Tambah Aset Baru"
                />

                <AssetForm
                    form={form}
                    categories={categories}
                    kondisiOptions={kondisiOptions}
                    maxPhotos={maxPhotos}
                    submitLabel="Simpan Aset"
                    onSubmit={submit}
                    cancelHref={route('assets.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
