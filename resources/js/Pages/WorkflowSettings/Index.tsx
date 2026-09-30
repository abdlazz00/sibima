import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

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
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Pengaturan Alur</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Pengaturan Alur Persetujuan</h1>
                    <p className="mt-1 text-sm text-slate-500">Atur langkah dan approver tiap alur. Perubahan hanya berlaku untuk pengajuan baru.</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <ul className="divide-y divide-slate-100">
                        {workflows.map((w) => (
                            <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                                    <p className="truncate text-xs text-slate-500">{w.summary || 'Belum ada langkah'}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {w.step_count} langkah · {w.pending_count} pengajuan berjalan
                                        {w.last_changed_at ? ` · diubah ${new Date(w.last_changed_at).toLocaleDateString('id-ID')}` : ''}
                                    </p>
                                </div>
                                <Link href={route('workflow-settings.edit', w.id)} className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                    Atur
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
