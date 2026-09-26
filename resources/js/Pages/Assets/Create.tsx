import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AssetForm, { AssetFormData } from '@/Pages/Assets/Partials/AssetForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
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
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">
                            Home
                        </Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('assets.index')} className="hover:text-blue-700">
                            Data Aset
                        </Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Tambah Aset Baru</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Tambah Aset Baru</h1>
                </div>

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
