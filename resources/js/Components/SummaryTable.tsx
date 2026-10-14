import { Table } from '@/Components/ui/application/table/table';
import { cx } from '@/lib/cx';
import { ReactNode } from 'react';

export interface SummaryColumn<T> {
    key: string;
    label: string;
    align?: 'right';
    isRowHeader?: boolean;
    render: (row: T) => ReactNode;
}

export default function SummaryTable<T extends { id: string | number }>({
    ariaLabel,
    columns,
    rows,
    total,
    emptyText,
}: {
    ariaLabel: string;
    columns: SummaryColumn<T>[];
    rows: T[];
    /** Baris Total, ditambahkan di akhir bila `rows` tidak kosong. */
    total?: T;
    emptyText: string;
}) {
    const items = total && rows.length > 0 ? [...rows, total] : rows;

    return (
        <Table aria-label={ariaLabel} size="sm">
            <Table.Header>
                {columns.map((c) => (
                    <Table.Head key={c.key} id={c.key} label={c.label} isRowHeader={c.isRowHeader} className={cx(c.align === 'right' && '[&>div]:justify-end')} />
                ))}
            </Table.Header>
            <Table.Body items={items} renderEmptyState={() => <p className="py-8 text-center text-sm text-slate-400">{emptyText}</p>}>
                {(row) => (
                    <Table.Row id={row.id} className={cx(row === total && 'bg-slate-50')}>
                        {columns.map((c) => (
                            <Table.Cell
                                key={c.key}
                                className={cx(c.align === 'right' && 'text-right tabular-nums', row === total ? 'font-semibold text-slate-900' : 'text-slate-800')}
                            >
                                {c.render(row)}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                )}
            </Table.Body>
        </Table>
    );
}
