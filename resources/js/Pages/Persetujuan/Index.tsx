import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

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
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Kotak Persetujuan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Kotak Persetujuan</h1>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {items.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">Tidak ada pengajuan yang menunggu persetujuan Anda.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <li key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.workflow_name}</p>
                                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-xs text-slate-500">Diajukan oleh {item.submitted_by} · {item.created_at}</p>
                                    </div>
                                    <Link href={item.show_url} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Tinjau
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
