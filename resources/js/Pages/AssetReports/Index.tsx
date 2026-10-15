import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL, REPORT_STATUS_COLOR, REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetReport, AssetReportStatus, AssetReportType, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetReport>;
    filters: { search?: string; status?: string; jenis?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(REPORT_STATUS_LABEL) as AssetReportStatus[]).map((key) => ({ id: key, label: REPORT_STATUS_LABEL[key] })),
];

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua jenis' },
    ...(Object.keys(REPORT_TYPE_LABEL) as AssetReportType[]).map((key) => ({ id: key, label: REPORT_TYPE_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const hasFilter = Boolean(filters.status || filters.jenis);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-reports.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Lapor Rusak/Hilang" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang' }]}
                    title="Lapor Rusak/Hilang"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-reports.create')}>
                                Buat Laporan
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nomor laporan atau nama aset..."
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

                    <Table aria-label="Daftar laporan rusak atau hilang" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Laporan" isRowHeader />
                            <Table.Head id="aset" label="Aset" />
                            <Table.Head id="jenis" label="Jenis" />
                            <Table.Head id="kondisi" label="Kondisi Baru" />
                            <Table.Head id="unit" label="Unit" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada laporan yang cocok dengan filter.' : 'Belum ada laporan.'}
                                </p>
                            )}
                        >
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="whitespace-nowrap font-medium text-slate-800">{r.nomor_laporan}</Table.Cell>
                                    <Table.Cell className="font-semibold text-slate-900">{r.asset?.nama_aset}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{REPORT_TYPE_LABEL[r.jenis]}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[r.kondisi_baru] ?? 'gray'} className="rounded-sm">
                                            {KONDISI_LABEL[r.kondisi_baru]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="text-slate-800">{r.unit?.name}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-slate-800">{new Date(r.tanggal_kejadian).toLocaleDateString('id-ID')}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={REPORT_STATUS_COLOR[r.status]} className="rounded-sm">
                                            {REPORT_STATUS_LABEL[r.status]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Tooltip title="Lihat detail">
                                            <Button
                                                color="primary-sky"
                                                size="sm"
                                                iconLeading={Eye}
                                                aria-label={`Lihat laporan ${r.nomor_laporan}`}
                                                href={route('asset-reports.show', r.id)}
                                            />
                                        </Tooltip>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold tabular-nums text-slate-800">
                                {items.from ?? 0}-{items.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{items.total}</span> laporan
                        </p>

                        {items.last_page > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={items.current_page}
                                total={items.last_page}
                                onPageChange={(page) => go({ page })}
                            />
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
