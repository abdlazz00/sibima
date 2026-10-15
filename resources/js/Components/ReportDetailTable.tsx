import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Button } from '@/Components/ui/base/buttons/button';
import { cx } from '@/lib/cx';
import { ReportSort } from '@/lib/use-laporan-filters';
import { ChevronDown, ChevronRight } from '@untitledui/icons';
import { ReactNode } from 'react';

export interface DetailColumn<T> {
    key: string;
    label: string;
    /** Nama kolom urut di server; bila ada, kolom bisa diurutkan. */
    sort?: string;
    align?: 'right';
    render: (row: T) => ReactNode;
}

interface Paginator {
    from: number | null;
    to: number | null;
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

type Item<T> = { id: string; kind: 'row'; row: T; no: number } | { id: string; kind: 'detail'; row: T };

export default function ReportDetailTable<T extends { id: number }>({
    ariaLabel,
    columns,
    rows,
    paginator,
    unit,
    sort,
    onSort,
    onPage,
    onPageSize,
    openId,
    onToggle,
    rowLabel,
    renderDetail,
    emptyText,
}: {
    ariaLabel: string;
    columns: DetailColumn<T>[];
    rows: T[];
    paginator: Paginator;
    /** Satuan di keterangan jumlah, mis. "aset", "mutasi", "laporan". */
    unit: string;
    sort: ReportSort;
    onSort: (column: string) => void;
    onPage: (page: number) => void;
    onPageSize: (perPage: number) => void;
    openId: number | null;
    onToggle: (id: number) => void;
    rowLabel: (row: T) => string;
    renderDetail: (row: T) => ReactNode;
    emptyText: string;
}) {
    const items = rows.flatMap((row, i): Item<T>[] => {
        const main: Item<T> = { id: `row-${row.id}`, kind: 'row', row, no: (paginator.from ?? 1) + i };

        return openId === row.id ? [main, { id: `detail-${row.id}`, kind: 'detail', row }] : [main];
    });

    return (
        <>
            <Table
                aria-label={ariaLabel}
                size="sm"
                sortDescriptor={{ column: sort.urut, direction: sort.arah === 'asc' ? 'ascending' : 'descending' }}
                onSortChange={(descriptor) => onSort(String(descriptor.column))}
            >
                <Table.Header>
                    <Table.Head id="no" label="No" isRowHeader />
                    {columns.map((c) => (
                        <Table.Head
                            key={c.key}
                            id={c.sort ?? c.key}
                            label={c.label}
                            allowsSorting={Boolean(c.sort)}
                            className={cx(c.align === 'right' && '[&>div]:justify-end')}
                        />
                    ))}
                </Table.Header>
                <Table.Body items={items} renderEmptyState={() => <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>}>
                    {(item) =>
                        item.kind === 'detail' ? (
                            <Table.Row id={item.id} className="h-auto bg-slate-50 hover:bg-slate-50">
                                <Table.Cell colSpan={columns.length + 1} className="whitespace-normal py-4">
                                    {renderDetail(item.row)}
                                </Table.Cell>
                            </Table.Row>
                        ) : (
                            <Table.Row id={item.id}>
                                <Table.Cell className="whitespace-nowrap tabular-nums">
                                    <span className="flex items-center gap-1">
                                        <Button
                                            color="tertiary"
                                            size="sm"
                                            iconLeading={openId === item.row.id ? ChevronDown : ChevronRight}
                                            aria-expanded={openId === item.row.id}
                                            aria-label={`Detail ${rowLabel(item.row)}`}
                                            onPress={() => onToggle(item.row.id)}
                                        />
                                        {item.no}
                                    </span>
                                </Table.Cell>
                                {columns.map((c) => (
                                    <Table.Cell key={c.key} className={cx('text-slate-800', c.align === 'right' && 'text-right tabular-nums')}>
                                        {c.render(item.row)}
                                    </Table.Cell>
                                ))}
                            </Table.Row>
                        )
                    }
                </Table.Body>
            </Table>

            {paginator.total > 0 && (
                <PaginationCardMinimal
                    page={paginator.current_page}
                    total={paginator.last_page}
                    pageSize={paginator.per_page}
                    pageSizes={PAGE_SIZES}
                    totalItems={paginator.total}
                    itemLabel={unit}
                    onPageChange={onPage}
                    onPageSizeChange={onPageSize}
                />
            )}
        </>
    );
}
