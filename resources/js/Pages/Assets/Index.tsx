import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PageHeader from '@/Components/PageHeader';
import PrintLabelModal from '@/Components/PrintLabelModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR } from '@/lib/assetReport';
import { Asset, AssetCategory, Paginated, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Eye, Plus, Printer, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useEffect, useState } from 'react';
import type { Selection } from 'react-aria-components';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface Option {
    value: string;
    label: string;
}

interface Filters {
    search?: string;
    category_id?: string;
    unit_id?: string;
    kondisi?: string;
    urut?: string;
    per_page?: number;
}

interface IndexProps extends PageProps {
    assets: Paginated<Asset>;
    filters: Filters;
    categories: AssetCategory[];
    units: UnitOption[];
    kondisiOptions: Option[];
    sortOptions: Option[];
    can: {
        create: boolean;
        printLabel?: boolean;
        update?: boolean;
    };
}

const ALL = '__all';
const DEFAULT_SORT = 'nama_asc';
const MAX_LABELS = 99;

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function registerLabel(nomor: number): string {
    return String(nomor).padStart(4, '0');
}

export default function Index({ assets, filters, categories, units, kondisiOptions, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [printIds, setPrintIds] = useState<number[] | null>(null);

    const pageIds = assets.data.map((a) => a.id);
    const selectedOnPage = new Set<number>(selectedIds.filter((id) => pageIds.includes(id)));
    const overLimit = selectedIds.length > MAX_LABELS;

    const onSelectionChange = (keys: Selection) => {
        const onPage = keys === 'all' ? pageIds : pageIds.filter((id) => keys.has(id));
        setSelectedIds((prev) => [...prev.filter((id) => !pageIds.includes(id)), ...onPage]);
    };

    const applyFilters = (next: Partial<Filters>) => {
        router.get(
            route('assets.index'),
            { ...filters, ...next },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        const handle = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilters({ search: search || undefined });
            }
        }, 400);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        applyFilters({ search: search || undefined });
    };

    const hasActiveFilter = Boolean(filters.search || filters.category_id || filters.unit_id || filters.kondisi);

    const resetFilters = () => {
        setSearch('');
        router.get(route('assets.index'), { urut: filters.urut, per_page: filters.per_page }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const categoryItems = [
        { id: ALL, label: 'Semua Kategori' },
        ...categories.flatMap((kategori) =>
            (kategori.children ?? []).map((sub) => ({ id: String(sub.id), label: `${kategori.name} › ${sub.name}` })),
        ),
    ];
    const unitItems = [{ id: ALL, label: 'Semua Unit' }, ...units.map((u) => ({ id: String(u.id), label: u.name }))];
    const kondisiItems = [
        { id: ALL, label: 'Semua Kondisi' },
        ...kondisiOptions.map((o) => ({ id: o.value, label: o.label })),
    ];
    const sortItems = sortOptions.map((o) => ({ id: o.value, label: `Urutkan: ${o.label}` }));

    const goToPage = (page: number) =>
        router.get(route('assets.index'), { ...filters, page }, { preserveState: true, preserveScroll: true });

    const changePageSize = (per_page: number) =>
        router.get(route('assets.index'), { ...filters, per_page, page: undefined }, { preserveState: true, preserveScroll: true });

    return (
        <AuthenticatedLayout>
            <Head title="Data Aset" />

            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    crumbs={[{ label: 'Data Aset' }]}
                    title="Daftar Barang Milik Daerah"
                    actions={
                        <>
                            {selectedIds.length > 0 && Boolean(can.printLabel) && (
                                <Button
                                    color="primary-violet"
                                    size="md"
                                    iconLeading={Printer}
                                    className={
                                        overLimit
                                            ? 'bg-amber-50 text-amber-800 ring-amber-300 hover:bg-amber-100 hover:text-amber-900 *:data-icon:text-amber-600 hover:*:data-icon:text-amber-700'
                                            : undefined
                                    }
                                    onPress={() => setPrintIds(selectedIds)}
                                >
                                    Cetak Label ({selectedIds.length}){overLimit && ` · Maks ${MAX_LABELS}`}
                                </Button>
                            )}
                            <ImportExportButtons modul="aset" query={{ ...filters, per_page: undefined }} />
                            {can.create && (
                                <Button color="primary" size="md" iconLeading={Plus} href={route('assets.create')}>
                                    Tambah Aset Baru
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Filter Toolbar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Select
                            aria-label="Kategori"
                            size="md"
                            popoverClassName="w-[46rem]! max-w-[calc(100vw-2rem)]"
                            items={categoryItems}
                            selectedKey={filters.category_id ?? ALL}
                            onSelectionChange={(key) => applyFilters({ category_id: key === ALL ? undefined : String(key) })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Unit"
                            size="md"
                            items={unitItems}
                            selectedKey={filters.unit_id ?? ALL}
                            onSelectionChange={(key) => applyFilters({ unit_id: key === ALL ? undefined : String(key) })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Kondisi"
                            size="md"
                            items={kondisiItems}
                            selectedKey={filters.kondisi ?? ALL}
                            onSelectionChange={(key) => applyFilters({ kondisi: key === ALL ? undefined : String(key) })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Urutkan"
                            size="md"
                            items={sortItems}
                            selectedKey={filters.urut ?? DEFAULT_SORT}
                            onSelectionChange={(key) =>
                                applyFilters({ urut: key === DEFAULT_SORT ? undefined : String(key) })
                            }
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                    {hasActiveFilter && (
                        <div className="mt-3 flex justify-end">
                            <Button color="tertiary" size="sm" iconLeading={XClose} onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        </div>
                    )}
                </div>

                {/* Data Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 p-4">
                        <form onSubmit={submitSearch} className="flex max-w-md items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    aria-label="Cari aset"
                                    size="md"
                                    icon={SearchLg}
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Cari nama barang, kode BMD, atau dokumen..."
                                />
                            </div>
                            {search && (
                                <Button
                                    color="tertiary"
                                    size="md"
                                    iconLeading={XClose}
                                    aria-label="Hapus pencarian"
                                    onPress={() => {
                                        setSearch('');
                                        applyFilters({ search: undefined });
                                    }}
                                />
                            )}
                        </form>
                    </div>

                    {/* onRowAction kosong: menekan baris atau tautan di dalamnya tidak memilih baris; seleksi hanya lewat checkbox. */}
                    <Table
                        aria-label="Daftar aset"
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        onRowAction={() => {}}
                        selectedKeys={selectedOnPage}
                        onSelectionChange={onSelectionChange}
                    >
                        <Table.Header>
                            <Table.Head id="foto" label="Foto" />
                            <Table.Head id="identitas" label="Identitas Barang" isRowHeader />
                            <Table.Head id="kode" label="Kode Register BMD" />
                            <Table.Head id="unit" label="Unit Pemilik" />
                            <Table.Head id="pemegang" label="Pemegang" />
                            <Table.Head id="kondisi" label="Kondisi" />
                            <Table.Head id="nilai" label="Nilai Perolehan" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={assets.data}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-3 py-14 text-center">
                                    <p className="text-sm text-slate-500">
                                        Tidak ada aset yang cocok dengan pencarian/filter ini.
                                    </p>
                                    {hasActiveFilter && (
                                        <Button color="secondary" size="sm" onPress={resetFilters}>
                                            Hapus semua filter
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(asset) => (
                                <Table.Row id={asset.id}>
                                    <Table.Cell>
                                        <div className="h-12 w-12 overflow-hidden rounded bg-slate-100">
                                            {asset.photos?.[0] && (
                                                <img
                                                    src={asset.photos[0].thumbnail_url || asset.photos[0].url}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="h-full w-full object-cover"
                                                />
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            href={route('assets.show', asset.id)}
                                            className="block max-w-[260px] truncate text-sm font-semibold text-slate-900 hover:text-blue-700"
                                        >
                                            {asset.nama_aset}
                                        </Link>
                                        <p className="max-w-[260px] truncate text-xs text-slate-500">{asset.merk_type ?? '—'}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p className="whitespace-nowrap font-mono text-[13px] text-slate-800">{asset.kode_barang}</p>
                                        <p className="text-[11px] text-slate-400">Reg. {registerLabel(asset.nomor_register)}</p>
                                    </Table.Cell>
                                    <Table.Cell>{asset.unit?.name}</Table.Cell>
                                    <Table.Cell>{asset.current_holder?.nama ?? '—'}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} size="sm" className="rounded-sm">
                                            {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ?? asset.kondisi}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                                        {formatRupiah(asset.nilai_perolehan)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Tooltip title="Lihat detail">
                                                <Button
                                                    color="primary-sky"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label="Lihat detail"
                                                    href={route('assets.show', asset.id)}
                                                />
                                            </Tooltip>
                                            {can.update && (
                                                <Tooltip title="Ubah aset">
                                                    <Button
                                                        color="primary-green"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label="Ubah aset"
                                                        href={route('assets.edit', asset.id)}
                                                    />
                                                </Tooltip>
                                            )}
                                            {can.printLabel && (
                                                <Tooltip title="Cetak label QR">
                                                    <Button
                                                        color="primary-violet"
                                                        size="sm"
                                                        iconLeading={Printer}
                                                        aria-label="Cetak label QR"
                                                        onPress={() => setPrintIds([asset.id])}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    {assets.total > 0 && (
                        <PaginationCardMinimal
                            page={assets.current_page}
                            total={assets.last_page}
                            pageSize={assets.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={assets.total}
                            itemLabel="aset"
                            onPageChange={goToPage}
                            onPageSizeChange={changePageSize}
                        />
                    )}
                </div>
            </div>

            {printIds && <PrintLabelModal assetIds={printIds} onClose={() => setPrintIds(null)} />}
        </AuthenticatedLayout>
    );
}
