import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AssetForm, { AssetFormData } from '@/Pages/Assets/Partials/AssetForm';
import { Asset, AssetCategory, AssetPhoto, PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

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

    const [photoToDelete, setPhotoToDelete] = useState<AssetPhoto | null>(null);
    const [deletingPhoto, setDeletingPhoto] = useState(false);

    const confirmDeletePhoto = () => {
        if (!photoToDelete) return;
        setDeletingPhoto(true);
        router.delete(route('assets.photos.destroy', { asset: asset.id, photo: photoToDelete.id }), {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setDeletingPhoto(false);
                setPhotoToDelete(null);
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Aset — ${asset.nama_aset}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Ubah Aset' }]}
                    title="Ubah Data Aset"
                />

                <AssetForm
                    form={form}
                    categories={categories}
                    maxPhotos={maxPhotos}
                    existingPhotos={asset.photos ?? []}
                    onRemoveExistingPhoto={setPhotoToDelete}
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('assets.show', asset.id)}
                />
            </div>

            {photoToDelete && (
                <ConfirmDialog
                    title="Hapus Foto Aset"
                    confirmLabel="Ya, Hapus Foto"
                    isLoading={deletingPhoto}
                    onConfirm={confirmDeletePhoto}
                    onClose={() => setPhotoToDelete(null)}
                >
                    Foto ini akan dihapus dari aset.
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
