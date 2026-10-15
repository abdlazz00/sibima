import PageHeader from '@/Components/PageHeader';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, PenerimaanStatusKey, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, Paginated, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<BeritaAcaraPenerimaan>;
    filters: { search?: string; status?: string; dari?: string; sampai?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(PENERIMAAN_STATUS_LABEL) as PenerimaanStatusKey[]).map((key) => ({ id: key, label: PENERIMAAN_STATUS_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const goTo = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('penerimaan-aset.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        goTo({ page: undefined });
    };

    const hasFilter = Boolean(filters.status || filters.dari || filters.sampai);

    return (
        <AuthenticatedLayout>
            <Head title="Penerimaan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset' }]}
                    title="Penerimaan Aset Baru"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('penerimaan-aset.create')}>
                                Ajukan Penerimaan
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
                            onSelectionChange={(key) => goTo({ status: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Dari tanggal"
                            type="date"
                            size="md"
                            value={filters.dari ?? ''}
                            onChange={(v) => goTo({ dari: v || undefined, page: undefined })}
                        />
                        <Input
                            label="Sampai tanggal"
                            type="date"
                            size="md"
                            value={filters.sampai ?? ''}
                            onChange={(v) => goTo({ sampai: v || undefined, page: undefined })}
                        />
                        <Select
                            label="Urutkan"
                            size="md"
                            items={sortOptions.map((o) => ({ id: o.value, label: o.label }))}
                            selectedKey={filters.urut ?? 'terbaru'}
                            onSelectionChange={(key) => goTo({ urut: key === 'terbaru' ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                    {hasFilter && (
                        <div className="mt-3">
                            <Button
                                color="link-color"
                                size="md"
                                onPress={() => goTo({ status: undefined, dari: undefined, sampai: undefined, page: undefined })}
                            >
                                Reset filter
                            </Button>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari no. berita acara atau nama aset..."
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
                                    goTo({ search: undefined, page: undefined });
                                }}
                            />
                        )}
                        <Button type="submit" color="primary-sky" size="md">
                            Cari
                        </Button>
                    </form>

                    <Table aria-label="Daftar penerimaan aset" size="sm">
                        <Table.Header>
                            <Table.Head id="no" label="No. Berita Acara" isRowHeader />
                            <Table.Head id="nama" label="Nama Aset" />
                            <Table.Head id="kategori" label="Kategori" />
                            <Table.Head id="nilai" label="Nilai" />
                            <Table.Head id="pengaju" label="Pengaju" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada penerimaan yang cocok dengan filter.' : 'Belum ada pengajuan penerimaan aset.'}
                                </p>
                            )}
                        >
                            {(ba) => {
                                const status = penerimaanStatus(ba);
                                const extra = (ba.items?.length ?? 0) - 1;
                                const nilai = (ba.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);

                                return (
                                    <Table.Row id={ba.id}>
                                        <Table.Cell className="text-slate-800">{ba.no_berita_acara}</Table.Cell>
                                        <Table.Cell className="font-semibold text-slate-900">
                                            {ba.items?.[0]?.nama_aset}
                                            {extra > 0 && <span className="font-normal text-slate-400"> +{extra} lainnya</span>}
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">{ba.items?.[0]?.category?.name ?? '—'}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-right tabular-nums text-slate-800">{rupiah(nilai)}</Table.Cell>
                                        <Table.Cell className="text-slate-800">{ba.creator?.name}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-slate-800">
                                            {new Date(ba.tanggal_penerimaan).toLocaleDateString('id-ID')}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={PENERIMAAN_STATUS_COLOR[status]} className="rounded-sm">
                                                {PENERIMAAN_STATUS_LABEL[status]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Tooltip title="Lihat detail">
                                                <Button
                                                    color="primary-sky"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat penerimaan ${ba.no_berita_acara}`}
                                                    href={route('penerimaan-aset.show', ba.id)}
                                                />
                                            </Tooltip>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                    {items.total > 0 && (
                        <PaginationCardMinimal
                            page={items.current_page}
                            total={items.last_page}
                            pageSize={items.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={items.total}
                            itemLabel="penerimaan"
                            onPageChange={(page) => goTo({ page })}
                            onPageSizeChange={(per_page) => goTo({ per_page, page: undefined })}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
