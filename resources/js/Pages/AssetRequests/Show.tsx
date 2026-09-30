import CancelRequestModal from '@/Components/CancelRequestModal';
import { CheckCircleIcon as Check, ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface EligibleAsset {
    id: number;
    kode_barang: string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
}

interface ShowProps extends PageProps {
    assetRequest: AssetRequest;
    can: { act: boolean; cancel: boolean; reassign: boolean; fulfill: boolean; close: boolean };
    reassignCandidates: ReassignCandidate[];
    eligibleAssets: EligibleAsset[];
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

export default function Show({ assetRequest: r, can, reassignCandidates, eligibleAssets }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [note, setNote] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const req = r.approval_request;
    const steps = req?.steps ?? [];
    const single = r.jenis === 'pegawai';

    const toggle = (id: number) =>
        setSelected((cur) => (single ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

    const post = (name: string, id: number, data: Parameters<typeof router.post>[1], onSuccess?: () => void) => {
        if (submitting) return;
        setSubmitting(true);
        router.post(route(name, id), data, { preserveScroll: true, onSuccess, onFinish: () => setSubmitting(false) });
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

    const closeNoteModal = () => {
        setShowReject(false);
        setShowClose(false);
        setNote('');
    };

    const rows: [string, string][] = [
        ['Nomor Permohonan', r.nomor_permohonan],
        ['Jenis', REQUEST_TYPE_LABEL[r.jenis]],
        ['Pemohon', r.jenis === 'pegawai' ? (r.pegawai?.nama ?? '—') : (r.unit?.name ?? '—')],
        ['Unit', r.unit?.name ?? '—'],
        ['Subkategori', r.category?.name ?? '—'],
        ['Jumlah', String(r.jumlah)],
        ['Diajukan Oleh', r.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Permohonan #${r.nomor_permohonan}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('asset-requests.index')} className="hover:text-blue-700">Permohonan Aset</Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail</span>
                        </nav>
                        <div className="mt-1 flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Permohonan #{r.nomor_permohonan}</h1>
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${REQUEST_STATUS_STYLE[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {can.cancel && <button onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batalkan Pengajuan</button>}
                        {can.reassign && <button onClick={() => setShowReassign(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Alihkan Approver</button>}
                        {can.close && <button onClick={() => setShowClose(true)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tutup Permohonan</button>}
                        {can.act && (
                            <>
                                <button onClick={() => setShowReject(true)} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tolak</button>
                                <button onClick={() => req && post('approval-requests.approve', req.id, {})} disabled={submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{submitting ? 'Memproses...' : 'Setujui'}</button>
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
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Permohonan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="w-40 shrink-0 font-medium text-slate-500">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Keterangan</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{r.keterangan}</p>
                        {r.catatan_penutupan && (
                            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Ditutup: {r.catatan_penutupan}</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-3 text-base font-semibold text-slate-900">Pemenuhan</p>

                        {r.mutation && (
                            <p className="mb-3 text-sm text-slate-700">
                                Mutasi:{' '}
                                <Link href={route('asset-mutations.show', r.mutation.id)} className="font-semibold text-blue-700 hover:underline">{r.mutation.nomor_mutasi}</Link>
                            </p>
                        )}

                        {(r.assets?.length ?? 0) > 0 && (
                            <ul className="mb-3 space-y-1.5 text-sm">
                                {r.assets?.map((a) => (
                                    <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <Link href={route('assets.show', a.id)} className="font-semibold text-slate-900 hover:text-blue-700">{a.nama_aset}</Link>
                                        <span className="ml-2 text-xs text-slate-500">{a.kode_barang}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {can.fulfill ? (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-600">
                                    Pilih {single ? '1 aset' : `tepat ${r.jumlah} aset`} yang memenuhi syarat ({selected.length} dipilih).
                                </p>
                                {eligibleAssets.length === 0 ? (
                                    <p className="text-sm text-amber-700">Belum ada aset yang memenuhi syarat. Anda dapat menutup permohonan ini.</p>
                                ) : (
                                    <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
                                        {eligibleAssets.map((a) => (
                                            <li key={a.id}>
                                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                                                    <input type={single ? 'radio' : 'checkbox'} name="asset" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                                                    <span className="font-medium text-slate-900">{a.nama_aset}</span>
                                                    <span className="text-xs text-slate-500">{a.kode_barang}{a.merk_type ? ` · ${a.merk_type}` : ''}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    type="button"
                                    onClick={() => post('asset-requests.fulfill', r.id, { asset_ids: selected }, () => setSelected([]))}
                                    disabled={submitting || selected.length === 0 || (!single && selected.length !== r.jumlah)}
                                    className="rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                                >
                                    {single ? 'Serahkan ke Pegawai' : 'Ajukan Mutasi Pemenuhan'}
                                </button>
                            </div>
                        ) : (
                            r.status === 'approved' && !r.mutation && <p className="text-sm text-slate-500">Menunggu pemenuhan oleh admin unit terkait.</p>
                        )}
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Permohonan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {r.creator?.name}</p>
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
                    description="Permohonan dihentikan dan tidak lagi muncul di kotak persetujuan."
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

            {(showReject || showClose) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeNoteModal}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-3 text-base font-bold text-gray-900">{showClose ? 'Tutup Permohonan' : 'Tolak Permohonan'}</h3>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Alasan (wajib diisi)" className="mb-4 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                        <div className="flex justify-end gap-3">
                            <button onClick={closeNoteModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button
                                disabled={!note.trim() || submitting}
                                onClick={() => {
                                    if (showClose) post('asset-requests.close', r.id, { note: note.trim() }, closeNoteModal);
                                    else if (req) post('approval-requests.reject', req.id, { note: note.trim() }, closeNoteModal);
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {showClose ? 'Ya, Tutup' : 'Ya, Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
