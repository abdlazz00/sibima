import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BeritaAcaraPenerimaan, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean };
}

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

function stepLabel(role: string): string {
    return role === 'kasubag' ? 'Verifikasi Kasubag' : 'Persetujuan Camat';
}

export default function Show({ beritaAcara, can }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [note, setNote] = useState('');
    const req = beritaAcara.approval_request;
    const steps = req?.definition?.steps ?? [];
    const total = (beritaAcara.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);

    const approve = () => {
        if (!req) return;
        router.post(route('approval-requests.approve', req.id));
    };

    const reject = () => {
        if (!req) return;
        router.post(route('approval-requests.reject', req.id), { note }, { onSuccess: () => setShowReject(false) });
    };

    const stepState = (order: number): 'done' | 'current' | 'upcoming' => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) return 'current';
        return 'upcoming';
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`} />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('penerimaan-aset.index')} className="hover:text-blue-700">Penerimaan Aset</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            Penerimaan Aset #{beritaAcara.no_berita_acara}
                        </h1>
                    </div>
                    {can.act && (
                        <div className="flex gap-3">
                            <button onClick={() => setShowReject(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Tolak
                            </button>
                            <button onClick={approve} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                                Setujui
                            </button>
                        </div>
                    )}
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-sm font-semibold text-slate-900">Status Alur Persetujuan</p>
                        <div className="flex items-start">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                return (
                                    <div key={step.step_order} className="flex flex-1 flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${state === 'done' ? 'bg-emerald-100' : state === 'current' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                {state === 'done' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">Step {step.step_order}: {stepLabel(step.approver_role)}</p>
                                            <p className="text-[11px] text-slate-500">
                                                {state === 'done' ? 'Selesai' : state === 'current' ? 'Menunggu' : 'Belum dimulai'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Penerimaan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {([
                                ['No. Berita Acara', beritaAcara.no_berita_acara],
                                ['Tanggal Pengajuan', new Date(beritaAcara.tanggal_penerimaan).toLocaleDateString('id-ID')],
                                ['Sumber Perolehan', beritaAcara.sumber_perolehan ?? '—'],
                                ['No. Kontrak/SPK', beritaAcara.no_kontrak_spk],
                                ['Vendor/Penyedia', beritaAcara.vendor ?? '—'],
                                ['Total Nilai', formatRupiah(total)],
                            ] as [string, string][]).map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Rincian Barang Diterima</p>
                        <div className="space-y-3">
                            {beritaAcara.items?.map((item) => (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{item.nama_aset}</p>
                                            <p className="text-xs text-slate-500">{item.merk_type}</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-semibold text-slate-900">{formatRupiah(item.nilai_per_unit)} / unit</p>
                                            <p className="text-xs text-slate-500">{item.jumlah_unit} unit</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Pengajuan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {beritaAcara.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${action.action === 'approve' ? 'bg-emerald-600' : 'bg-red-600'}`} />
                                    <p className="text-sm font-semibold text-slate-900">
                                        {action.action === 'approve' ? 'Disetujui' : 'Ditolak'} oleh {action.user?.name}
                                    </p>
                                    {action.note && <p className="text-xs text-slate-500">{action.note}</p>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReject(false)}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">Tolak Pengajuan</h3>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Alasan penolakan (wajib diisi)"
                            className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={reject} disabled={!note.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Ya, Tolak</button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
