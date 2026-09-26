import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

function ChevronRightIcon({ className = 'h-3 w-3' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

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

    const { data, setData, put, processing, errors, transform } = useForm({
        name: category.name,
        parent_id: (category.parent_id ?? parents[0]?.id ?? '') as number | '',
        code: category.code ?? category.formatted_code ?? '',
        description: category.description ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        transform((values) => ({
            ...values,
            parent_id:
                categoryType === 'parent' || values.parent_id === ''
                    ? null
                    : values.parent_id,
        }));

        put(route('asset-categories.update', category.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Kategori - ${category.name}`} />

            <div className="space-y-6">
                {/* Breadcrumbs & Header Row */}
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500"
                    >
                        <Link
                            href="/dashboard"
                            className="text-gray-500 transition hover:text-gray-900"
                        >
                            Home
                        </Link>
                        <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                        <Link
                            href={route('asset-categories.index')}
                            className="text-gray-500 transition hover:text-gray-900"
                        >
                            Kategori Aset
                        </Link>
                        <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                        <span className="font-medium text-gray-800">
                            Ubah Kategori
                        </span>
                    </nav>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        Ubah Kategori Aset
                    </h1>
                </div>

                {/* Form Card */}
                <form onSubmit={submit} className="space-y-6">
                    <div className="shadow-xs rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
                        {/* Card Section Header */}
                        <div className="border-b border-gray-100 pb-4">
                            <h2 className="text-base font-semibold text-gray-900">
                                Informasi Kategori
                            </h2>
                        </div>

                        <div className="space-y-6 pt-6">
                            {/* Jenis Kategori (Radio Selection) */}
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                                    Jenis Kategori{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-6 pt-1">
                                    <label className="flex cursor-pointer select-none items-center gap-2.5">
                                        <input
                                            type="radio"
                                            name="categoryType"
                                            value="parent"
                                            checked={categoryType === 'parent'}
                                            onChange={() =>
                                                setCategoryType('parent')
                                            }
                                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-800">
                                            Kategori Utama (Induk)
                                        </span>
                                    </label>

                                    <label
                                        className={`flex select-none items-center gap-2.5 ${
                                            hasChildren
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="categoryType"
                                            value="child"
                                            checked={categoryType === 'child'}
                                            disabled={hasChildren}
                                            onChange={() =>
                                                setCategoryType('child')
                                            }
                                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                        />
                                        <span className="text-sm font-medium text-gray-800">
                                            Subkategori
                                        </span>
                                    </label>
                                </div>
                                {hasChildren && (
                                    <p className="mt-1.5 text-xs text-amber-600">
                                        Kategori ini memiliki subkategori,
                                        sehingga tidak dapat dijadikan
                                        subkategori dari kategori lain.
                                    </p>
                                )}
                            </div>

                            {/* Conditional Row: Parent Selection & Kode */}
                            {categoryType === 'child' ? (
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div>
                                        <label
                                            htmlFor="parent_id"
                                            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
                                        >
                                            Kategori Induk{' '}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <select
                                            id="parent_id"
                                            value={data.parent_id}
                                            onChange={(e) =>
                                                setData(
                                                    'parent_id',
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(
                                                              e.target.value,
                                                          ),
                                                )
                                            }
                                            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            required
                                        >
                                            <option value="">
                                                Pilih Kategori Induk
                                            </option>
                                            {parents.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1.5 text-xs text-gray-500">
                                            Pilih kategori utama untuk
                                            subkategori ini
                                        </p>
                                        <InputError
                                            message={errors.parent_id}
                                            className="mt-1"
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="code"
                                            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
                                        >
                                            Kode Kategori
                                        </label>
                                        <input
                                            id="code"
                                            type="text"
                                            value={data.code}
                                            onChange={(e) =>
                                                setData('code', e.target.value)
                                            }
                                            placeholder="Contoh: 02.09.04"
                                            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                        <p className="mt-1.5 text-xs text-gray-500">
                                            Kode akan mengikuti format standar
                                            BMD
                                        </p>
                                        <InputError
                                            message={errors.code}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label
                                        htmlFor="code"
                                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
                                    >
                                        Kode Kategori
                                    </label>
                                    <input
                                        id="code"
                                        type="text"
                                        value={data.code}
                                        onChange={(e) =>
                                            setData('code', e.target.value)
                                        }
                                        placeholder="Contoh: 02.09"
                                        className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Kode akan mengikuti format standar BMD
                                    </p>
                                    <InputError
                                        message={errors.code}
                                        className="mt-1"
                                    />
                                </div>
                            )}

                            {/* Nama Kategori */}
                            <div>
                                <label
                                    htmlFor="name"
                                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
                                >
                                    Nama Kategori{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    placeholder="Masukkan nama kategori (huruf kapital)"
                                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    required
                                />
                                <InputError
                                    message={errors.name}
                                    className="mt-1"
                                />
                            </div>

                            {/* Deskripsi (Opsional) */}
                            <div>
                                <label
                                    htmlFor="description"
                                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
                                >
                                    Deskripsi (Opsional)
                                </label>
                                <textarea
                                    id="description"
                                    rows={4}
                                    value={data.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    placeholder="Tambahkan keterangan kategori jika diperlukan"
                                    className="w-full rounded-lg border border-gray-300 bg-white p-3.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                                <InputError
                                    message={errors.description}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-end gap-3">
                        <Link
                            href={route('asset-categories.index')}
                            className="shadow-xs inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="shadow-xs inline-flex h-11 items-center justify-center rounded-lg bg-[#1E40AF] px-6 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
