import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface WorkflowRow {
    id: number;
    code: string;
    name: string;
    summary: string;
    step_count: number;
    pending_count: number;
    last_changed_at: string | null;
}

interface IndexProps extends PageProps {
    workflows: WorkflowRow[];
}

export default function Index({ workflows }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Pengaturan Alur Persetujuan" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Pengaturan Alur' }]} title="Pengaturan Alur Persetujuan" />
                <p className="-mt-3 text-sm text-slate-500">
                    Atur langkah dan approver tiap alur. Perubahan hanya berlaku untuk pengajuan baru.
                </p>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    {workflows.length === 0 ? (
                        <p className="py-12 text-center text-sm text-slate-400">Belum ada alur persetujuan.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {workflows.map((w) => (
                                <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                                        <p className="truncate text-xs text-slate-500">{w.summary || 'Belum ada langkah'}</p>
                                        <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                                            {w.step_count} langkah · {w.pending_count} pengajuan berjalan
                                            {w.last_changed_at ? ` · diubah ${new Date(w.last_changed_at).toLocaleDateString('id-ID')}` : ''}
                                        </p>
                                    </div>
                                    <Button color="primary-green" size="md" className="shrink-0" href={route('workflow-settings.edit', w.id)}>
                                        Atur
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
