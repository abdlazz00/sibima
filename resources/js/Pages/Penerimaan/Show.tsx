import CancelRequestModal from '@/Components/CancelRequestModal';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PENERIMAAN_STATUS_LABEL, PENERIMAAN_STATUS_STYLE, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean; cancel: boolean; edit: boolean; delete: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

type StepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled';

const STEP_CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-100',
    current: 'bg-amber-100',
    upcoming: 'bg-slate-100',
    rejected: 'bg-red-100',
    cancelled: 'bg-slate-200',
};

const STEP_TEXT: Record<StepState, string> = {
    done: 'Selesai',
    current: 'Menunggu',
    upcoming: 'Belum dimulai',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const ACTION_LABEL = { approve: 'Disetujui', reject: 'Ditolak', cancel: 'Dibatalkan', reassign: 'Dialihkan' } as const;
const ACTION_DOT = { approve: 'bg-emerald-600', reject: 'bg-red-600', cancel: 'bg-slate-500', reassign: 'bg-blue-600' } as const;

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const req = beritaAcara.approval_request;
    const steps = req?.steps ?? [];
    const total = (beritaAcara.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);
    const status = penerimaanStatus(beritaAcara);

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const reject = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', req.id),
            { note },
            { preserveScroll: true, onSuccess: () => setShowReject(false), onFinish: () => setSubmitting(false) },
        );
    };

    const deleteDraft = () => {
        if (window.confirm('Hapus draft ini? Tindakan ini tidak dapat dibatalkan.')) {
            router.delete(route('penerimaan-aset.destroy', beritaAcara.id));
        }
    };

    const stepState = (order: number): StepState => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) {
            if (req.status === 'rejected') return 'rejected';
            if (req.status === 'cancelled') return 'cancelled';
            return 'current';
        }
        return 'upcoming';
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('penerimaan-aset.index')} className="hover:text-blue-700">Penerimaan Aset</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <div className="mt-1 flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                Penerimaan Aset #{beritaAcara.no_berita_acara}
                            </h1>
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${PENERIMAAN_STATUS_STYLE[status]}`}>
                                {PENERIMAAN_STATUS_LABEL[status]}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {can.delete && (
                            <button onClick={deleteDraft} className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                                Hapus Draft
                            </button>
                        )}
                        {can.edit && (
                            <Link href={route('penerimaan-aset.edit', beritaAcara.id)} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                                Edit &amp; Ajukan
                            </Link>
                        )}
                        {can.cancel && (
                            <button onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Batalkan Pengajuan
                            </button>
                        )}
                        {can.reassign && (
                            <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Alihkan Approver
                            </button>
                        )}
                        {can.act && (
                            <>
                                <button onClick={() => setShowReject(true)} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                    Tolak
                                </button>
                                <button onClick={approve} disabled={submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                                    {submitting ? 'Memproses...' : 'Setujui'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {!req && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Draft ini belum diajukan. Approver baru dapat melihatnya setelah Anda mengajukannya.
                    </div>
                )}

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-sm font-semibold text-slate-900">Status Alur Persetujuan</p>
                        <div className="flex items-start">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                return (
                                    <div key={step.step_order} className="flex flex-1 flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${STEP_CIRCLE[state]}`}>
                                                {state === 'done' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">Step {step.step_order}: {step.label}</p>
                                            <p className="text-[11px] text-slate-500">{STEP_TEXT[state]}</p>
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
                                    <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${ACTION_DOT[action.action]}`} />
                                    <p className="text-sm font-semibold text-slate-900">
                                        {ACTION_LABEL[action.action]} oleh {action.user?.name}
                                    </p>
                                    {action.note && <p className="text-xs text-slate-500">{action.note}</p>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Pengajuan akan dihentikan dan tidak lagi muncul di kotak persetujuan. Persetujuan yang sudah diberikan ikut hangus."
                />
            )}

            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    stepOrder={req.current_step}
                    stepLabel={steps.find((st) => st.step_order === req.current_step)?.label}
                    onClose={() => setShowReassign(false)}
                />
            )}

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
                            <button onClick={reject} disabled={!note.trim() || submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Ya, Tolak</button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
