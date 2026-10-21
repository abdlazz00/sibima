import PageHeader from '@/Components/PageHeader';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { getInitials } from '@/config/navigation';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ClockRewind, Eye, FilterLines, InfoCircle, RefreshCw01, SearchLg, XClose } from '@untitledui/icons';
import React, { useState } from 'react';
import DiffInspectorModal, { ActivityLogItem } from './Partials/DiffInspectorModal';

interface ModuleOption {
    value: string;
    label: string;
}

interface EventOption {
    value: string;
    label: string;
}

interface UserOption {
    id: number;
    name: string;
}

interface PaginatedLogs {
    data: ActivityLogItem[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
}

interface ActivityLogsPageProps extends PageProps {
    logs: PaginatedLogs;
    filters: {
        q?: string;
        modul?: string;
        event?: string;
        user_id?: string;
        start_date?: string;
        end_date?: string;
        per_page?: number;
    };
    modules: ModuleOption[];
    events: EventOption[];
    users: UserOption[];
}

const ACTION_BADGES: Record<string, { color: 'success' | 'blue' | 'error' | 'gray'; label: string }> = {
    created: { color: 'success', label: 'Dibuat' },
    updated: { color: 'blue', label: 'Diubah' },
    deleted: { color: 'error', label: 'Dihapus' },
    restored: { color: 'blue', label: 'Dipulihkan' },
};

export default function Index({ logs, filters, modules, events, users }: ActivityLogsPageProps) {
    const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

    const [search, setSearch] = useState(filters.q ?? '');
    const [selectedModule, setSelectedModule] = useState(filters.modul ?? '');
    const [selectedEvent, setSelectedEvent] = useState(filters.event ?? '');
    const [selectedUserId, setSelectedUserId] = useState(filters.user_id ?? '');
    const [startDate, setStartDate] = useState(filters.start_date ?? '');
    const [endDate, setEndDate] = useState(filters.end_date ?? '');

    const applyFilters = (overrides = {}) => {
        const query: Record<string, any> = {
            q: search || undefined,
            modul: selectedModule || undefined,
            event: selectedEvent || undefined,
            user_id: selectedUserId || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            page: 1,
            per_page: filters.per_page,
            ...overrides,
        };

        // Filter out empty keys
        Object.keys(query).forEach((k) => query[k] === undefined && delete query[k]);

        router.get(route('activity-logs.index'), query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const resetFilters = () => {
        setSearch('');
        setSelectedModule('');
        setSelectedEvent('');
        setSelectedUserId('');
        setStartDate('');
        setEndDate('');
        router.get(route('activity-logs.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const isFiltered = Boolean(
        filters.q || filters.modul || filters.event || filters.user_id || filters.start_date || filters.end_date
    );

    const goToPage = (page: number) => {
        router.get(
            route('activity-logs.index'),
            { ...filters, page },
            { preserveState: true, preserveScroll: true }
        );
    };

    const changePageSize = (per_page: number) => {
        router.get(
            route('activity-logs.index'),
            { ...filters, per_page, page: 1 },
            { preserveState: true, preserveScroll: true }
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title="Log Aktivitas Sistem" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <PageHeader
                    crumbs={[
                        { label: 'Pengaturan', href: '#' },
                        { label: 'Log Aktivitas' },
                    ]}
                    title="Log Aktivitas Sistem"
                    badges={
                        <Badge color="brand" size="md">
                            Audit Trail
                        </Badge>
                    }
                    actions={
                        <div className="flex items-center gap-2">
                            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                <InfoCircle className="size-4 text-blue-600" />
                                Retensi log otomatis 90 hari
                            </span>
                            <Button
                                color="secondary"
                                size="sm"
                                iconLeading={RefreshCw01}
                                onPress={() => router.reload()}
                                aria-label="Muat ulang log"
                            >
                                Segarkan
                            </Button>
                        </div>
                    }
                />

                {/* Filter Toolbar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <SearchLg className="size-4" aria-hidden="true" />
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari deskripsi, pelaku, atau target perubahan..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>

                        {/* Search Button */}
                        <Button color="primary" size="md" type="submit">
                            Cari
                        </Button>
                    </form>

                    {/* Secondary Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
                        {/* Modul Select */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Modul</label>
                            <select
                                value={selectedModule}
                                onChange={(e) => {
                                    setSelectedModule(e.target.value);
                                    applyFilters({ modul: e.target.value || undefined });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="">Semua Modul</option>
                                {modules.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Event Select */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Aksi</label>
                            <select
                                value={selectedEvent}
                                onChange={(e) => {
                                    setSelectedEvent(e.target.value);
                                    applyFilters({ event: e.target.value || undefined });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="">Semua Aksi</option>
                                {events.map((ev) => (
                                    <option key={ev.value} value={ev.value}>
                                        {ev.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* User Select */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pelaku</label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => {
                                    setSelectedUserId(e.target.value);
                                    applyFilters({ user_id: e.target.value || undefined });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="">Semua Pelaku</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dari Tanggal</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    applyFilters({ start_date: e.target.value || undefined });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    applyFilters({ end_date: e.target.value || undefined });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Reset Button */}
                    {isFiltered && (
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                                <XClose className="size-3.5" />
                                Reset Semua Filter
                            </button>
                        </div>
                    )}
                </div>

                {/* Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                                    <th className="py-3 px-4 w-[180px]">Waktu</th>
                                    <th className="py-3 px-4 w-[220px]">Pelaku</th>
                                    <th className="py-3 px-3 w-[110px]">Aksi</th>
                                    <th className="py-3 px-3 w-[130px]">Modul</th>
                                    <th className="py-3 px-4">Deskripsi & Target</th>
                                    <th className="py-3 px-4 text-right w-[110px]">Rincian</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <ClockRewind className="size-8 text-slate-300 dark:text-slate-600" />
                                                <p className="font-medium text-slate-600 dark:text-slate-400">
                                                    Tidak ada catatan aktivitas yang sesuai filter.
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    Coba sesuaikan kata kunci pencarian atau tanggal filter.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.data.map((log) => {
                                        const actionBadge = ACTION_BADGES[log.aksi] || { color: 'gray', label: log.aksi };

                                        return (
                                            <tr
                                                key={log.id}
                                                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                {/* Waktu */}
                                                <td className="py-3 px-4 align-top">
                                                    <span className="block text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                                                        {log.waktu}
                                                    </span>
                                                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                                        {log.waktu_relatif}
                                                    </span>
                                                </td>

                                                {/* Pelaku */}
                                                <td className="py-3 px-4 align-top">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                                                            {getInitials(log.pelaku.nama)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">
                                                                {log.pelaku.nama}
                                                            </span>
                                                            {log.pelaku.role && log.pelaku.role !== '-' && (
                                                                <span className="inline-block text-[11px] text-blue-600 font-medium dark:text-blue-400">
                                                                    {log.pelaku.role}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Aksi */}
                                                <td className="py-3 px-3 align-top whitespace-nowrap">
                                                    <Badge color={actionBadge.color} size="sm">
                                                        {actionBadge.label}
                                                    </Badge>
                                                </td>

                                                {/* Modul */}
                                                <td className="py-3 px-3 align-top whitespace-nowrap">
                                                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {log.modul}
                                                    </span>
                                                </td>

                                                {/* Deskripsi & Target */}
                                                <td className="py-3 px-4 align-top">
                                                    <div className="text-xs">
                                                        <span className="font-semibold text-slate-900 dark:text-white">
                                                            {log.target}
                                                        </span>
                                                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                                            {log.deskripsi}
                                                        </p>
                                                        {log.diff && log.diff.length > 0 && (
                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                    {log.diff.length} perubahan atribut
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Detail Button */}
                                                <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                                                    <Button
                                                        color="secondary"
                                                        size="sm"
                                                        iconLeading={Eye}
                                                        onPress={() => setSelectedLog(log)}
                                                    >
                                                        Detail
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.total > 0 && (
                        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                            <PaginationCardMinimal
                                page={logs.current_page}
                                total={logs.last_page}
                                pageSize={logs.per_page}
                                pageSizes={PAGE_SIZES}
                                totalItems={logs.total}
                                itemLabel="log aktivitas"
                                onPageChange={goToPage}
                                onPageSizeChange={changePageSize}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Diff Inspector Modal */}
            <DiffInspectorModal
                isOpen={Boolean(selectedLog)}
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
            />
        </AuthenticatedLayout>
    );
}
