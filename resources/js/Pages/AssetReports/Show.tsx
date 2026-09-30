import CancelRequestModal from '@/Components/CancelRequestModal';
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetPhoto, AssetReport, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    report: AssetReport;
    can: { act: boolean; cancel: boolean; reassign: boolean };
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

const ACTION_LABEL = { approve: 'Disetujui', reject: 'Ditolak', cancel: 'Dibatalkan', reassign: 'Approver Dialihkan' } as const;
const ACTION_DOT = { approve: 'bg-emerald-600', reject: 'bg-red-600', cancel: 'bg-slate-500', reassign: 'bg-blue-600' } as const;

export default function Show({ report, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [photo, setPhoto] = useState<AssetPhoto | null>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const req = report.approval_request;
    const steps = req?.steps ?? [];

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const reject = () => {
        if (!req || submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', req.id),
            { note: note.trim() },
            { preserveScroll: true, onSuccess: () => setShowReject(false), onFinish: () => setSubmitting(false) },
        );
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

    const rows: [string, string][] = [
        ['Nomor Laporan', report.nomor_laporan],
        ['Jenis', REPORT_TYPE_LABEL[report.jenis]],
        ['Kondisi Baru', KONDISI_LABEL[report.kondisi_baru]],
        ['Kondisi Saat Ini', report.asset ? KONDISI_LABEL[report.asset.kondisi] : '—'],
        ['Tanggal Kejadian', new Date(report.tanggal_kejadian).toLocaleDateString('id-ID')],
        ['Unit', report.unit?.name ?? '—'],
        ['Pemegang', report.pegawai?.nama ?? 'Tidak ada (milik unit)'],
        ['Dilaporkan Oleh', report.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Laporan #${report.nomor_laporan}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('asset-reports.index')} className="hover:text-blue-700">Lapor Rusak/Hilang</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <div className="mt-1 flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laporan {REPORT_TYPE_LABEL[report.jenis]} #{report.nomor_laporan}</h1>
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REPORT_STATUS_STYLE[report.status]}`}>{REPORT_STATUS_LABEL[report.status]}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {can.cancel && (
                            <button onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batalkan Pengajuan</button>
                        )}
                        {can.reassign && (
                            <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Alihkan Approver</button>
                        )}
                        {can.act && (
                            <>
                                <button onClick={() => setShowReject(true)} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tolak</button>
                                <button onClick={approve} disabled={submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{submitting ? 'Memproses...' : 'Setujui'}</button>
                            </>
                        )}
                    </div>
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Laporan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Kronologi</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{report.kronologi}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Aset</p>
                        {report.asset && (
                            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-900">{report.asset.nama_aset}</p>
                                <p className="text-xs text-slate-500">{report.asset.kode_barang} · {report.asset.merk_type ?? '—'}</p>
                                <Link href={route('assets.show', report.asset.id)} className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline">Lihat detail aset</Link>
                            </div>
                        )}
                        <p className="mb-2 text-sm font-semibold text-slate-900">Foto ({report.photos?.length ?? 0})</p>
                        {(report.photos?.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400">Tidak ada foto.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {report.photos?.map((p) => (
                                    <button key={p.id} type="button" onClick={() => setPhoto(p)} className="aspect-square overflow-hidden rounded-lg border border-slate-200">
                                        <img src={p.url} alt="Foto laporan" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Laporan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {report.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${ACTION_DOT[action.action]}`} />
                                    <p className="text-sm font-semibold text-slate-900">{ACTION_LABEL[action.action]} oleh {action.user?.name}</p>
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
                    description="Laporan dihentikan dan tidak lagi muncul di kotak persetujuan. Kondisi aset tidak berubah."
                />
            )}

            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    stepOrder={req.current_step}
                    stepLabel={steps.find((s) => s.step_order === req.current_step)?.label}
                    onClose={() => setShowReassign(false)}
                />
            )}

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReject(false)}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">Tolak Laporan</h3>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Alasan penolakan (wajib diisi)" className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={reject} disabled={!note.trim() || submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Ya, Tolak</button>
                        </div>
                    </div>
                </div>
            )}

            {photo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPhoto(null)}>
                    <img src={photo.url} alt="Foto laporan" className="max-h-[90vh] max-w-3xl rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </AuthenticatedLayout>
    );
}
