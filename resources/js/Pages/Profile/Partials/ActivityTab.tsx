import { PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { tanggalWaktu } from '@/lib/format';
import { ActivityEntry, Paginated } from '@/types';
import { Link, router } from '@inertiajs/react';
import { AlertTriangle, FileCheck02, LogIn01, LogOut01 } from '@untitledui/icons';
import { useEffect, useState } from 'react';

type Filter = 'semua' | 'pekerjaan' | 'login';

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'semua', label: 'Semua' },
    { key: 'pekerjaan', label: 'Pekerjaan' },
    { key: 'login', label: 'Login' },
];

function EntryIcon({ entry }: { entry: ActivityEntry }) {
    const common = 'size-5';
    if (entry.tipe === 'pekerjaan') return <FileCheck02 className={`${common} text-blue-700`} aria-hidden="true" />;
    if (entry.hasil === 'gagal') return <AlertTriangle className={`${common} text-red-600`} aria-hidden="true" />;
    if (entry.hasil === 'keluar') return <LogOut01 className={`${common} text-slate-500`} aria-hidden="true" />;

    return <LogIn01 className={`${common} text-emerald-600`} aria-hidden="true" />;
}

export default function ActivityTab({ aktivitas }: { aktivitas?: Paginated<ActivityEntry> }) {
    const [filter, setFilter] = useState<Filter>('semua');
    const [loading, setLoading] = useState(false);

    const load = (nextFilter: Filter, halaman: number) => {
        setLoading(true);
        router.reload({
            only: ['aktivitas'],
            data: { filter: nextFilter, halaman },
            replace: true,
            preserveUrl: true,
            onFinish: () => setLoading(false),
        });
    };

    useEffect(() => {
        if (!aktivitas) load('semua', 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Riwayat aktivitas</h2>
                    <p className="text-xs text-slate-500">Tindakan kerja dan catatan login akun Anda.</p>
                </div>
                <Tabs
                    selectedKey={filter}
                    onSelectionChange={(key) => {
                        const next = String(key) as Filter;
                        setFilter(next);
                        load(next, 1);
                    }}
                    keyboardActivation="automatic"
                    className="w-auto"
                >
                    <Tabs.List type="button-border" size="sm" aria-label="Saring riwayat">
                        {FILTERS.map((f) => (
                            <Tabs.Item key={f.key} id={f.key} label={f.label} />
                        ))}
                    </Tabs.List>
                </Tabs>
            </div>

            {!aktivitas ? (
                <ul className="mt-4 space-y-3" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => (
                        <li key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </ul>
            ) : aktivitas.data.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Belum ada aktivitas.</p>
            ) : (
                <ul className={`mt-4 divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
                    {aktivitas.data.map((e) => (
                        <li key={e.id} className="flex items-start gap-3 py-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                                <EntryIcon entry={e} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">
                                    {e.url ? (
                                        <Link href={e.url} className="text-blue-700 hover:underline">
                                            {e.judul}
                                        </Link>
                                    ) : (
                                        e.judul
                                    )}
                                </p>
                                {e.keterangan && <p className="text-xs text-slate-500">{e.keterangan}</p>}
                            </div>
                            <time dateTime={e.waktu} className="shrink-0 text-xs tabular-nums text-slate-500">
                                {tanggalWaktu(e.waktu)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}

            {aktivitas && aktivitas.total > 0 && (
                <PaginationCardMinimal
                    className="mt-4 px-0 md:px-0 md:pb-0"
                    page={aktivitas.current_page}
                    total={aktivitas.last_page}
                    totalItems={aktivitas.total}
                    itemLabel="aktivitas"
                    onPageChange={(page) => load(filter, page)}
                />
            )}
        </div>
    );
}
