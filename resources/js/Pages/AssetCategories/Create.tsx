import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CategoryForm, { CategoryFormData } from '@/Pages/AssetCategories/Partials/CategoryForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function Create({ parents }: PageProps<{ parents: AssetCategory[] }>) {
    // Radio toggle: 'child' (Subkategori) or 'parent' (Kategori Utama)
    const [categoryType, setCategoryType] = useState<'child' | 'parent'>(parents.length > 0 ? 'child' : 'parent');

    const form = useForm<CategoryFormData>({
        name: '',
        parent_id: parents[0]?.id ?? '',
        code: '',
        description: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((values) => ({
            ...values,
            parent_id: categoryType === 'parent' || values.parent_id === '' ? null : values.parent_id,
        }));

        form.post(route('asset-categories.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Kategori Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset', href: route('asset-categories.index') }, { label: 'Tambah Kategori' }]}
                    title="Tambah Kategori Aset"
                />

                <CategoryForm
                    form={form}
                    parents={parents}
                    categoryType={categoryType}
                    onCategoryTypeChange={setCategoryType}
                    parentHint="Pilih kategori utama untuk subkategori baru ini"
                    submitLabel="Simpan Kategori"
                    onSubmit={submit}
                    cancelHref={route('asset-categories.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
