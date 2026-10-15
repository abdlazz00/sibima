import { router } from '@inertiajs/react';
import { useState } from 'react';

export type ReportFilters = Record<string, string | number | undefined>;

export interface ReportSort {
    urut: string;
    arah: 'asc' | 'desc';
}

const clean = (data: ReportFilters) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: ReportFilters) =>
    JSON.stringify(
        Object.entries(clean(data))
            .map(([k, v]) => [k, String(v)])
            .sort(),
    );

export function useLaporanFilters(routeName: string, downloadRouteName: string, filters: ReportFilters, sort: ReportSort, perPage?: number) {
    const [form, setForm] = useState<ReportFilters>(filters);
    const dirty = signature(form) !== signature(filters);

    const visit = (extra: ReportFilters, base: ReportFilters = filters) =>
        router.get(route(routeName), clean({ ...base, urut: sort.urut, arah: sort.arah, per_page: perPage, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });
    const apply = () => visit({ page: undefined }, form);

    const downloadUrl = `${route(downloadRouteName)}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    return { form, set, dirty, visit, sortBy, apply, downloadUrl };
}
