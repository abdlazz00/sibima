import ImportExportButtons from '@/Components/ImportExportButtons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
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
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    );
}

function TrashIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
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
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    );
}

function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    );
}

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

function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export default function Index({
    categories,
    can = { create: true, update: true, delete: true },
}: PageProps<{
    categories: AssetCategory[];
    can?: { create: boolean; update: boolean; delete: boolean };
}>) {
    const { errors } =
        usePage<PageProps<{ errors: Record<string, string> }>>().props;

    // Expand/collapse tracking for parent categories (default expanded)
    const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
        const init: Record<number, boolean> = {};
        categories.forEach((cat) => {
            init[cat.id] = true;
        });
        return init;
    });

    const toggleExpand = (id: number) => {
        setExpanded((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // Category delete confirmation modal state
    const [deletingCategory, setDeletingCategory] =
        useState<AssetCategory | null>(null);

    const confirmDelete = () => {
        if (!deletingCategory) return;
        router.delete(route('asset-categories.destroy', deletingCategory.id), {
            preserveScroll: true,
            onFinish: () => setDeletingCategory(null),
        });
    };

    // Pagination (5 parent categories per page as designed in Figma)
    const itemsPerPage = 5;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(categories.length / itemsPerPage) || 1;

    const displayedCategories = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return categories.slice(start, start + itemsPerPage);
    }, [categories, currentPage]);

    // Calculate total assets for parent (sum of direct assets + children's assets)
    const getCategoryTotalAssets = (cat: AssetCategory) => {
        const ownAssets = cat.assets_count ?? 0;
        const childrenAssets = (cat.children ?? []).reduce(
            (sum, child) => sum + (child.assets_count ?? 0),
            0,
        );
        return ownAssets + childrenAssets;
    };

    return (
        <AuthenticatedLayout>
            <Head title="Master Kategori Aset" />

            <div className="space-y-6">
                {/* Breadcrumbs & Header Row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                            <span className="font-medium text-gray-800">
                                Kategori Aset
                            </span>
                        </nav>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Master Kategori Aset
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ImportExportButtons modul="kategori" />
                        {can.create && (
                            <Link
                                href={route('asset-categories.create')}
                                className="shadow-xs inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-5 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span>Tambah Kategori</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Error Banner */}
                {errors.category && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                        {errors.category}
                    </div>
                )}

                {/* Data Table Card */}
                <div className="shadow-xs overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-gray-200 bg-white">
                                    <th className="py-3.5 pl-6 pr-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Nama Kategori
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Kode
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Jumlah Aset
                                    </th>
                                    <th className="py-3.5 pl-4 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {displayedCategories.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="py-12 text-center text-sm text-gray-400"
                                        >
                                            Belum ada data kategori aset.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedCategories.map((category) => {
                                        const isExpanded =
                                            expanded[category.id] ?? false;
                                        const totalAssets =
                                            getCategoryTotalAssets(category);
                                        const categoryCode =
                                            category.code ||
                                            category.formatted_code ||
                                            `01.${String(category.id).padStart(2, '0')}`;

                                        return (
                                            <div
                                                key={category.id}
                                                style={{ display: 'contents' }}
                                            >
                                                {/* Parent Row */}
                                                <tr className="group transition hover:bg-slate-50/60">
                                                    <td className="py-4 pl-6 pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleExpand(
                                                                        category.id,
                                                                    )
                                                                }
                                                                aria-label={
                                                                    isExpanded
                                                                        ? 'Tutup subkategori'
                                                                        : 'Buka subkategori'
                                                                }
                                                                className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
                                                            >
                                                                <div
                                                                    className={`transition-transform duration-150 ${
                                                                        isExpanded
                                                                            ? 'rotate-0'
                                                                            : '-rotate-90'
                                                                    }`}
                                                                >
                                                                    <ChevronDownIcon className="h-4 w-4" />
                                                                </div>
                                                            </button>
                                                            <span className="font-bold uppercase tracking-tight text-gray-900">
                                                                {category.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 font-mono text-sm tabular-nums text-gray-600">
                                                        {categoryCode}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                            {totalAssets} unit
                                                        </span>
                                                    </td>
                                                    <td className="py-4 pl-4 pr-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {can.update && (
                                                                <Link
                                                                    href={route(
                                                                        'asset-categories.edit',
                                                                        category.id,
                                                                    )}
                                                                    title="Ubah kategori"
                                                                    className="rounded-md border border-blue-200 p-1.5 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                >
                                                                    <PencilIcon className="h-3.5 w-3.5" />
                                                                </Link>
                                                            )}
                                                            {can.delete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setDeletingCategory(
                                                                            category,
                                                                        )
                                                                    }
                                                                    title="Hapus kategori"
                                                                    className="rounded-md border border-red-200 p-1.5 text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                                                                >
                                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Subcategory Rows */}
                                                {isExpanded &&
                                                    (
                                                        category.children ?? []
                                                    ).map((child, idx) => {
                                                        const childCode =
                                                            child.code ||
                                                            child.formatted_code ||
                                                            `${categoryCode}.${String(idx + 1).padStart(2, '0')}`;
                                                        const childAssets =
                                                            child.assets_count ??
                                                            0;

                                                        return (
                                                            <tr
                                                                key={child.id}
                                                                className="border-t border-gray-50 bg-slate-50/20 transition hover:bg-slate-50/70"
                                                            >
                                                                <td className="py-3.5 pl-6 pr-4">
                                                                    <div className="flex items-center">
                                                                        {/* Indent line connector */}
                                                                        <div className="ml-5 flex items-center pr-3">
                                                                            <span className="inline-block h-px w-4 bg-gray-300" />
                                                                        </div>
                                                                        <span className="text-sm font-medium text-gray-700">
                                                                            {
                                                                                child.name
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3.5 font-mono text-sm tabular-nums text-gray-500">
                                                                    {childCode}
                                                                </td>
                                                                <td className="px-4 py-3.5">
                                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                                                        {
                                                                            childAssets
                                                                        }{' '}
                                                                        unit
                                                                    </span>
                                                                </td>
                                                                <td className="py-3.5 pl-4 pr-6 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {can.update && (
                                                                            <Link
                                                                                href={route(
                                                                                    'asset-categories.edit',
                                                                                    child.id,
                                                                                )}
                                                                                title="Ubah subkategori"
                                                                                className="rounded-md border border-blue-200 p-1.5 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                            >
                                                                                <PencilIcon className="h-3.5 w-3.5" />
                                                                            </Link>
                                                                        )}
                                                                        {can.delete && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setDeletingCategory(
                                                                                        child,
                                                                                    )
                                                                                }
                                                                                title="Hapus subkategori"
                                                                                className="rounded-md border border-red-200 p-1.5 text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                                                                            >
                                                                                <TrashIcon className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </div>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer with Pagination */}
                    <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row">
                        <div className="text-xs text-gray-500">
                            Menampilkan{' '}
                            <span className="font-semibold text-gray-700">
                                {displayedCategories.length}
                            </span>{' '}
                            dari{' '}
                            <span className="font-semibold text-gray-700">
                                {categories.length}
                            </span>{' '}
                            kategori
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Sebelumnya
                                </button>

                                {Array.from(
                                    { length: totalPages },
                                    (_, i) => i + 1,
                                ).map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => setCurrentPage(page)}
                                        className={`flex h-8 min-w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                                            currentPage === page
                                                ? 'bg-[#1E40AF] text-white'
                                                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    disabled={currentPage === totalPages}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Berikutnya
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingCategory && (
                <div
                    className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setDeletingCategory(null)}
                >
                    <div
                        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <TrashIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    Hapus Kategori Aset
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Tindakan ini tidak dapat dibatalkan.
                                </p>
                            </div>
                        </div>

                        <p className="mb-6 text-sm text-gray-600">
                            Apakah Anda yakin ingin menghapus kategori{' '}
                            <strong className="text-gray-900">
                                &quot;{deletingCategory.name}&quot;
                            </strong>
                            ? Kategori yang memiliki subkategori atau sedang
                            digunakan aset tidak dapat dihapus.
                        </p>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingCategory(null)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="shadow-xs rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                            >
                                Ya, Hapus Kategori
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
