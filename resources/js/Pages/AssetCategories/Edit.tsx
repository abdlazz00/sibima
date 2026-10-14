import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CategoryForm, { CategoryFormData } from '@/Pages/AssetCategories/Partials/CategoryForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function Edit({
    category,
    parents,
}: PageProps<{
    category: AssetCategory & { children_count?: number };
    parents: AssetCategory[];
}>) {
    const hasChildren = (category.children_count ?? 0) > 0;

    // Initial category type based on whether category has parent_id
    const [categoryType, setCategoryType] = useState<'child' | 'parent'>(
        category.parent_id !== null ? 'child' : 'parent',
    );

    const form = useForm<CategoryFormData>({
        name: category.name,
        parent_id: category.parent_id ?? parents[0]?.id ?? '',
        code: category.code ?? category.formatted_code ?? '',
        description: category.description ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((values) => ({
            ...values,
            parent_id: categoryType === 'parent' || values.parent_id === '' ? null : values.parent_id,
        }));

        form.put(route('asset-categories.update', category.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Kategori - ${category.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset', href: route('asset-categories.index') }, { label: 'Ubah Kategori' }]}
                    title="Ubah Kategori Aset"
                />

                <CategoryForm
                    form={form}
                    parents={parents}
                    categoryType={categoryType}
                    onCategoryTypeChange={setCategoryType}
                    childDisabled={hasChildren}
                    parentHint="Pilih kategori utama untuk subkategori ini"
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('asset-categories.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
