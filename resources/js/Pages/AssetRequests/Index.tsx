import PageHeader from '@/Components/PageHeader';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Toggle } from '@/Components/ui/base/toggle/toggle';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_COLOR, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, AssetRequestStatus, AssetRequestType, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetRequest>;
    filters: { search?: string; status?: string; jenis?: string; menunggu_pemenuhan?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(REQUEST_STATUS_LABEL) as AssetRequestStatus[]).map((key) => ({ id: key, label: REQUEST_STATUS_LABEL[key] })),
];

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua jenis' },
    ...(Object.keys(REQUEST_TYPE_LABEL) as AssetRequestType[]).map((key) => ({ id: key, label: REQUEST_TYPE_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const waiting = filters.menunggu_pemenuhan === '1';
    const hasFilter = Boolean(filters.status || filters.jenis || waiting);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-requests.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Permohonan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset' }]}
                    title="Permohonan Aset"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-requests.create')}>
                                Buat Permohonan
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Select
                            label="Status"
                            size="md"
                            items={STATUS_ITEMS}
                            selectedKey={filters.status ?? ALL}
                            onSelectionChange={(key) => go({ status: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            label="Jenis"
                            size="md"
                            items={JENIS_ITEMS}
                            selectedKey={filters.jenis ?? ALL}
                            onSelectionChange={(key) => go({ jenis: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            label="Urutkan"
                            size="md"
                            items={sortOptions.map((o) => ({ id: o.value, label: o.label }))}
                            selectedKey={filters.urut ?? 'terbaru'}
                            onSelectionChange={(key) => go({ urut: key === 'terbaru' ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <div className="pb-2.5">
                            <Toggle
                                label="Menunggu Pemenuhan"
                                isSelected={waiting}
                                onChange={(on) => go({ menunggu_pemenuhan: on ? '1' : undefined, page: undefined })}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nomor permohonan atau keterangan..."
                                value={search}
                                onChange={setSearch}
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
                                    go({ search: undefined, page: undefined });
                                }}
                            />
                        )}
                        <Button type="submit" color="primary-sky" size="md">
                            Cari
                        </Button>
                    </form>

                    <Table aria-label="Daftar permohonan aset" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Permohonan" isRowHeader />
                            <Table.Head id="jenis" label="Jenis" />
                            <Table.Head id="pemohon" label="Pemohon" />
                            <Table.Head id="kategori" label="Subkategori" />
                            <Table.Head id="jumlah" label="Jumlah" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada permohonan yang cocok dengan filter.' : 'Belum ada permohonan.'}
                                </p>
                            )}
                        >
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="whitespace-nowrap font-medium text-slate-800">{r.nomor_permohonan}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{REQUEST_TYPE_LABEL[r.jenis]}</Table.Cell>
                                    <Table.Cell className="font-semibold text-slate-900">{r.jenis === 'pegawai' ? r.pegawai?.nama : r.unit?.name}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{r.category?.name}</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-slate-800">{new Date(r.created_at).toLocaleDateString('id-ID')}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={REQUEST_STATUS_COLOR[r.status]} className="rounded-sm">
                                            {REQUEST_STATUS_LABEL[r.status]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Tooltip title="Lihat detail">
                                            <Button
                                                color="primary-sky"
                                                size="sm"
                                                iconLeading={Eye}
                                                aria-label={`Lihat permohonan ${r.nomor_permohonan}`}
                                                href={route('asset-requests.show', r.id)}
                                            />
                                        </Tooltip>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    {items.total > 0 && (
                        <PaginationCardMinimal
                            page={items.current_page}
                            total={items.last_page}
                            pageSize={items.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={items.total}
                            itemLabel="permohonan"
                            onPageChange={(page) => go({ page })}
                            onPageSizeChange={(per_page) => go({ per_page, page: undefined })}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
