import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { tanggalWaktu } from '@/lib/format';
import { NotificationRow, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CheckCircle } from '@untitledui/icons';

interface IndexProps extends PageProps {
    items: Paginated<NotificationRow>;
    filters: { filter: 'semua' | 'belum'; per_page: number };
}

const FILTERS = [
    { key: 'semua', label: 'Semua' },
    { key: 'belum', label: 'Belum dibaca' },
] as const;

export default function Index({ items, filters, notifications }: IndexProps) {
    const visit = (changes: Record<string, string | number | undefined>) =>
        router.get(route('notifications.index'), { ...filters, ...changes }, { preserveState: true, preserveScroll: true, replace: true });

    const mark = (id: string, dibaca: boolean) =>
        router.post(route('notifications.mark', id), { dibaca }, { preserveScroll: true, preserveState: true });

    return (
        <AuthenticatedLayout>
            <Head title="Notifikasi" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Notifikasi' }]}
                    title="Notifikasi"
                    actions={
                        notifications.unread_count > 0 && (
                            <Button
                                color="primary-green"
                                size="md"
                                iconLeading={CheckCircle}
                                onPress={() => router.post(route('notifications.read-all'), {}, { preserveScroll: true })}
                            >
                                Tandai semua dibaca
                            </Button>
                        )
                    }
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-5 pt-4">
                        <Tabs selectedKey={filters.filter} onSelectionChange={(key) => visit({ filter: String(key), page: undefined })} keyboardActivation="automatic">
                            <Tabs.List type="underline" size="md" aria-label="Saring notifikasi">
                                {FILTERS.map((f) => (
                                    <Tabs.Item key={f.key} id={f.key} label={f.label} />
                                ))}
                            </Tabs.List>
                        </Tabs>
                    </div>

                    {items.data.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">
                            {filters.filter === 'belum' ? 'Tidak ada notifikasi yang belum dibaca.' : 'Belum ada notifikasi.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.data.map((n) => (
                                <li key={n.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${n.dibaca ? 'bg-white' : 'bg-blue-50/40'}`}>
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span
                                            className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.dibaca ? 'bg-transparent' : 'bg-blue-600'}`}
                                            aria-label={n.dibaca ? undefined : 'Belum dibaca'}
                                        />
                                        <div className="min-w-0">
                                            <p className={`text-base ${n.dibaca ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                                                {!n.dibaca && (
                                                    <Badge type="color" size="sm" color="blue" className="mr-2 rounded-sm align-middle">
                                                        Baru
                                                    </Badge>
                                                )}
                                                {n.message}
                                            </p>
                                            <p className="mt-0.5 text-sm text-slate-500">
                                                {n.relatif} · {tanggalWaktu(n.waktu)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {n.url && (
                                            <Button
                                                color="primary-sky"
                                                size="sm"
                                                aria-label={`Buka: ${n.message}`}
                                                onPress={() => router.post(route('notifications.read', n.id))}
                                            >
                                                Buka
                                            </Button>
                                        )}
                                        {n.dibaca ? (
                                            <Button color="secondary" size="sm" aria-label={`Tandai belum dibaca: ${n.message}`} onPress={() => mark(n.id, false)}>
                                                Tandai belum dibaca
                                            </Button>
                                        ) : (
                                            <Button color="primary-green" size="sm" aria-label={`Tandai dibaca: ${n.message}`} onPress={() => mark(n.id, true)}>
                                                Tandai dibaca
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {items.total > 0 && (
                        <PaginationCardMinimal
                            page={items.current_page}
                            total={items.last_page}
                            pageSize={items.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={items.total}
                            itemLabel="notifikasi"
                            onPageChange={(page) => visit({ page })}
                            onPageSizeChange={(per_page) => visit({ per_page, page: undefined })}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
