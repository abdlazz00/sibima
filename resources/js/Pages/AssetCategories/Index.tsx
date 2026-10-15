import ConfirmDialog from '@/Components/ConfirmDialog';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PageHeader from '@/Components/PageHeader';
import { PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, Edit01, Plus, Trash01 } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface Row {
    key: string;
    category: AssetCategory;
    code: string;
    assets: number;
    isChild: boolean;
}

export default function Index({
    categories,
    can = { create: true, update: true, delete: true },
}: PageProps<{
    categories: AssetCategory[];
    can?: { create: boolean; update: boolean; delete: boolean };
}>) {
    const { errors } = usePage<PageProps<{ errors: Record<string, string> }>>().props;

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
    const [deletingCategory, setDeletingCategory] = useState<AssetCategory | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const confirmDelete = () => {
        if (!deletingCategory) return;
        setIsDeleting(true);
        router.delete(route('asset-categories.destroy', deletingCategory.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeletingCategory(null);
            },
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

    // Parent and (when expanded) child rows flattened for the table; keys differ per table of origin
    const rows = useMemo<Row[]>(
        () =>
            displayedCategories.flatMap((category) => {
                const children = category.children ?? [];
                const code = category.code || category.formatted_code || `01.${String(category.id).padStart(2, '0')}`;
                const parent: Row = {
                    key: `p-${category.id}`,
                    category,
                    code,
                    assets: (category.assets_count ?? 0) + children.reduce((sum, child) => sum + (child.assets_count ?? 0), 0),
                    isChild: false,
                };
                const childRows: Row[] = expanded[category.id]
                    ? children.map((child, idx) => ({
                          key: `c-${child.id}`,
                          category: child,
                          code: child.code || child.formatted_code || `${code}.${String(idx + 1).padStart(2, '0')}`,
                          assets: child.assets_count ?? 0,
                          isChild: true,
                      }))
                    : [];

                return [parent, ...childRows];
            }),
        [displayedCategories, expanded],
    );

    return (
        <AuthenticatedLayout>
            <Head title="Master Kategori Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset' }]}
                    title="Master Kategori Aset"
                    actions={
                        <>
                            <ImportExportButtons modul="kategori" />
                            {can.create && (
                                <Button color="primary" size="md" iconLeading={Plus} href={route('asset-categories.create')}>
                                    Tambah Kategori
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Error Banner */}
                {errors.category && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                        {errors.category}
                    </div>
                )}

                {/* Data Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <Table aria-label="Daftar kategori aset">
                        <Table.Header>
                            <Table.Head id="nama" label="Nama Kategori" isRowHeader />
                            <Table.Head id="kode" label="Kode" />
                            <Table.Head id="jumlah" label="Jumlah Aset" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={rows}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-3 py-12 text-center">
                                    <p className="text-sm text-slate-400">Belum ada data kategori aset.</p>
                                    {can.create && (
                                        <Button color="primary-sky" size="sm" iconLeading={Plus} href={route('asset-categories.create')}>
                                            Tambah Kategori
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(row) => {
                                const isExpanded = expanded[row.category.id] ?? false;
                                const noun = row.isChild ? 'subkategori' : 'kategori';

                                return (
                                    <Table.Row id={row.key}>
                                        <Table.Cell>
                                            {row.isChild ? (
                                                <div className="flex items-center">
                                                    <span className="mr-3 ml-5 inline-block h-px w-4 bg-slate-300" aria-hidden="true" />
                                                    <span className="text-sm font-medium text-slate-700">{row.category.name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        color="tertiary"
                                                        size="sm"
                                                        iconLeading={ChevronDown}
                                                        aria-label={isExpanded ? 'Tutup subkategori' : 'Buka subkategori'}
                                                        aria-expanded={isExpanded}
                                                        className={isExpanded ? undefined : '*:data-icon:-rotate-90'}
                                                        onPress={() => toggleExpand(row.category.id)}
                                                    />
                                                    <span className="font-bold uppercase tracking-tight text-slate-900">
                                                        {row.category.name}
                                                    </span>
                                                </div>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="font-mono tabular-nums">{row.code}</Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={row.isChild ? 'brand' : 'gray'} className="rounded-sm">
                                                {row.assets} unit
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2">
                                                {can.update && (
                                                    <Tooltip title={`Ubah ${noun}`}>
                                                        <Button
                                                            color="primary-green"
                                                            size="sm"
                                                            iconLeading={Edit01}
                                                            aria-label={`Ubah ${noun}`}
                                                            href={route('asset-categories.edit', row.category.id)}
                                                        />
                                                    </Tooltip>
                                                )}
                                                {can.delete && (
                                                    <Tooltip title={`Hapus ${noun}`}>
                                                        <Button
                                                            color="primary-destructive"
                                                            size="sm"
                                                            iconLeading={Trash01}
                                                            aria-label={`Hapus ${noun}`}
                                                            onPress={() => setDeletingCategory(row.category)}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                    {/* Table Footer with Pagination */}
                    {categories.length > 0 && (
                        <PaginationCardMinimal
                            page={currentPage}
                            total={totalPages}
                            totalItems={categories.length}
                            itemLabel="kategori"
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>

            {deletingCategory && (
                <ConfirmDialog
                    title={deletingCategory.parent_id === null ? 'Hapus Kategori Aset' : 'Hapus Subkategori'}
                    confirmLabel={deletingCategory.parent_id === null ? 'Ya, Hapus Kategori' : 'Ya, Hapus Subkategori'}
                    isLoading={isDeleting}
                    onConfirm={confirmDelete}
                    onClose={() => setDeletingCategory(null)}
                >
                    Apakah Anda yakin ingin menghapus {deletingCategory.parent_id === null ? 'kategori' : 'subkategori'}{' '}
                    <strong className="text-slate-900">&quot;{deletingCategory.name}&quot;</strong>? Kategori yang memiliki
                    subkategori atau sedang digunakan aset tidak dapat dihapus.
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
