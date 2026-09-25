import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

function CategoryRow({ category }: { category: AssetCategory }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({ name: category.name, parent_id: category.parent_id });

    const save = (e: FormEvent) => {
        e.preventDefault();
        form.put(route('asset-categories.update', category.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const remove = () => {
        if (confirm(`Hapus "${category.name}"?`)) {
            router.delete(route('asset-categories.destroy', category.id), { preserveScroll: true });
        }
    };

    if (editing) {
        return (
            <form onSubmit={save} className="flex items-start gap-2">
                <div className="flex-1">
                    <TextInput
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className="w-full"
                        isFocused
                    />
                    <InputError message={form.errors.name ?? form.errors.parent_id} className="mt-1" />
                </div>
                <PrimaryButton disabled={form.processing}>Simpan</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setEditing(false)}>
                    Batal
                </SecondaryButton>
            </form>
        );
    }

    return (
        <div className="flex items-center justify-between gap-2">
            <span>
                {category.name}{' '}
                <span className="text-xs text-gray-500">({category.assets_count ?? 0} aset)</span>
            </span>
            <span className="flex gap-2">
                <SecondaryButton type="button" onClick={() => setEditing(true)}>
                    Ubah
                </SecondaryButton>
                <DangerButton type="button" onClick={remove}>
                    Hapus
                </DangerButton>
            </span>
        </div>
    );
}

export default function Index({ categories }: PageProps<{ categories: AssetCategory[] }>) {
    const { errors } = usePage<PageProps<{ errors: Record<string, string> }>>().props;
    const form = useForm<{ name: string; parent_id: number | '' }>({ name: '', parent_id: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, parent_id: data.parent_id === '' ? null : data.parent_id }));
        form.post(route('asset-categories.store'), {
            preserveScroll: true,
            onSuccess: () => form.reset('name'),
        });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Master Kategori Aset</h1>}>
            <Head title="Kategori Aset" />

            {errors.category && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {errors.category}
                </div>
            )}

            <form onSubmit={submit} className="mb-6 flex flex-wrap items-start gap-2 rounded-lg bg-white p-4 shadow-sm">
                <div className="min-w-64 flex-1">
                    <TextInput
                        placeholder="Nama kategori / subkategori"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className="w-full"
                    />
                    <InputError message={form.errors.name} className="mt-1" />
                </div>
                <div>
                    <select
                        value={form.data.parent_id}
                        onChange={(e) => form.setData('parent_id', e.target.value === '' ? '' : Number(e.target.value))}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="">— Kategori utama —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                Subkategori dari: {c.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.parent_id} className="mt-1" />
                </div>
                <PrimaryButton disabled={form.processing}>Tambah</PrimaryButton>
            </form>

            <div className="space-y-4">
                {categories.length === 0 && <p className="text-sm text-gray-500">Belum ada kategori.</p>}
                {categories.map((category) => (
                    <div key={category.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="font-semibold">
                            <CategoryRow category={category} />
                        </div>
                        <ul className="mt-3 space-y-2 border-l border-gray-200 pl-4 text-sm">
                            {(category.children ?? []).map((child) => (
                                <li key={child.id}>
                                    <CategoryRow category={child} />
                                </li>
                            ))}
                            {(category.children ?? []).length === 0 && (
                                <li className="text-gray-400">Belum ada subkategori.</li>
                            )}
                        </ul>
                    </div>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
