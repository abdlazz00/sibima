import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AssetForm, { AssetFormData } from '@/Pages/Assets/Partials/AssetForm';
import { Asset, AssetCategory, AssetPhoto, PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface EditProps extends PageProps {
    asset: Asset;
    categories: AssetCategory[];
    maxPhotos: number;
}

export default function Edit({ asset, categories, maxPhotos }: EditProps) {
    const form = useForm<AssetFormData>({
        category_id: asset.category_id,
        kode_barang: asset.kode_barang,
        nama_aset: asset.nama_aset,
        merk_type: asset.merk_type ?? '',
        tanggal_perolehan: asset.tanggal_perolehan,
        sumber_perolehan: asset.sumber_perolehan ?? '',
        nilai_perolehan: String(asset.nilai_perolehan),
        nilai_buku: String(asset.nilai_buku),
        no_dokumen: asset.no_dokumen ?? '',
        keterangan: asset.keterangan ?? '',
        photos: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(route('assets.update', asset.id), { forceFormData: true });
    };

    const removeExistingPhoto = (photo: AssetPhoto) => {
        if (confirm('Hapus foto ini?')) {
            router.delete(route('assets.photos.destroy', { asset: asset.id, photo: photo.id }), {
                preserveScroll: true,
            });
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Aset — ${asset.nama_aset}`} />

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
                        <span className="font-medium text-slate-800">Ubah Aset</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Ubah Data Aset</h1>
                </div>

                <AssetForm
                    form={form}
                    categories={categories}
                    maxPhotos={maxPhotos}
                    existingPhotos={asset.photos ?? []}
                    onRemoveExistingPhoto={removeExistingPhoto}
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('assets.show', asset.id)}
                />
            </div>
        </AuthenticatedLayout>
    );
}
