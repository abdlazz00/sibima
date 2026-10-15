import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { MUTATION_STATUS_COLOR, MUTATION_STATUS_LABEL, MUTATION_TYPE_COLOR, MUTATION_TYPE_LABEL } from '@/lib/mutasi';
import { AssetMutation, MutationType, Paginated, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    mutations: Paginated<AssetMutation>;
    filters?: { search?: string; jenis?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua alur' },
    ...(Object.keys(MUTATION_TYPE_LABEL) as MutationType[]).map((type) => ({ id: type, label: MUTATION_TYPE_LABEL[type] })),
];

export default function Index({ mutations, filters = {}, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-mutations.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Mutasi Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Mutasi Aset' }]}
                    title="Daftar Mutasi Aset"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-mutations.create')}>
                                Ajukan Mutasi Aset
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Jenis alur"
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
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari no. mutasi, nama aset, atau unit..."
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

                    <Table aria-label="Daftar mutasi aset" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Mutasi & Tanggal" isRowHeader />
                            <Table.Head id="jenis" label="Jenis Mutasi" />
                            <Table.Head id="alur" label="Alur Unit (Asal → Tujuan)" />
                            <Table.Head id="aset" label="Aset yang Dimutasi" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={mutations.data}
                            renderEmptyState={() => (
                                <div className="py-14 text-center">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {search || filters.jenis ? 'Tidak ada mutasi yang cocok dengan filter' : 'Belum ada transaksi mutasi'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">Pengajuan mutasi aset antar unit atau internal akan tampil di sini.</p>
                                    {can.create && !search && !filters.jenis && (
                                        <Button className="mt-3" color="link-color" size="md" iconLeading={Plus} href={route('asset-mutations.create')}>
                                            Buat Pengajuan Pertama
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(mutation) => {
                                const firstItem = mutation.items?.[0];
                                const extraItems = (mutation.items?.length ?? 0) - 1;
                                const sameUnit = mutation.jenis_mutasi === 'internal' || mutation.jenis_mutasi === 'pengembalian';

                                return (
                                    <Table.Row id={mutation.id}>
                                        <Table.Cell className="whitespace-nowrap">
                                            <span className="font-semibold text-slate-900">{mutation.nomor_mutasi}</span>
                                            <span className="block text-xs text-slate-500">
                                                {new Date(mutation.tanggal_mutasi).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                                {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">
                                            {sameUnit ? (
                                                <span className="font-medium text-slate-900">
                                                    {mutation.origin_unit?.name} ({mutation.jenis_mutasi === 'pengembalian' ? 'Ke Inventaris' : 'Internal'})
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs">
                                                    <span className="font-medium text-slate-900">{mutation.origin_unit?.name}</span>
                                                    <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                    <span className="font-medium text-blue-700">{mutation.destination_unit?.name}</span>
                                                </span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">
                                            {firstItem ? (
                                                <>
                                                    <span className="font-medium text-slate-900">{firstItem.asset?.nama_aset ?? `Aset #${firstItem.asset_id}`}</span>
                                                    {extraItems > 0 && <span className="ml-1 text-xs text-slate-500">+{extraItems} aset lainnya</span>}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[mutation.status]} className="rounded-sm">
                                                {MUTATION_STATUS_LABEL[mutation.status]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Tooltip title="Lihat detail mutasi">
                                                <Button
                                                    color="primary-sky"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat mutasi ${mutation.nomor_mutasi}`}
                                                    href={route('asset-mutations.show', mutation.id)}
                                                />
                                            </Tooltip>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold tabular-nums text-slate-800">
                                {mutations.from ?? 0}-{mutations.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{mutations.total}</span> mutasi
                        </p>

                        {mutations.last_page > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={mutations.current_page}
                                total={mutations.last_page}
                                onPageChange={(page) =>
                                    router.get(route('asset-mutations.index'), { ...filters, page }, { preserveState: true, preserveScroll: true })
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
