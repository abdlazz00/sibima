import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface PersetujuanItem {
    id: number;
    workflow_name: string;
    title: string;
    submitted_by: string;
    current_step: number;
    created_at: string;
    show_url: string;
}

interface IndexProps extends PageProps {
    items: PersetujuanItem[];
}

export default function Index({ items }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Kotak Persetujuan" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kotak Persetujuan' }]}
                    title="Kotak Persetujuan"
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    {items.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">Tidak ada pengajuan yang menunggu persetujuan Anda.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                                            {item.workflow_name}
                                        </Badge>
                                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">
                                            Diajukan oleh {item.submitted_by} · {item.created_at}
                                        </p>
                                    </div>
                                    <Button color="secondary-brand" size="md" href={item.show_url} aria-label={`Tinjau ${item.title}`} className="shrink-0">
                                        Tinjau
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
