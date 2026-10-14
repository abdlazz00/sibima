import CancelRequestModal from '@/Components/CancelRequestModal';
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check } from '@untitledui/icons';
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

export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
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
        setSubmitting(true);
        router.delete(route('penerimaan-aset.destroy', beritaAcara.id), {
            onFinish: () => {
                setSubmitting(false);
                setConfirmingDelete(false);
            },
        });
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
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset', href: route('penerimaan-aset.index') }, { label: 'Detail' }]}
                    title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`}
                    badges={
                        <Badge type="color" size="sm" color={PENERIMAAN_STATUS_COLOR[status]} className="rounded-sm">
                            {PENERIMAAN_STATUS_LABEL[status]}
                        </Badge>
                    }
                    actions={
                        <>
                            {can.delete && (
                                <Button color="secondary-destructive" size="md" onPress={() => setConfirmingDelete(true)}>
                                    Hapus Draft
                                </Button>
                            )}
                            {can.edit && (
                                <Button color="secondary-green" size="md" href={route('penerimaan-aset.edit', beritaAcara.id)}>
                                    Edit &amp; Ajukan
                                </Button>
                            )}
                            {can.cancel && (
                                <Button color="secondary" size="md" onPress={() => setShowCancel(true)}>
                                    Batalkan Pengajuan
                                </Button>
                            )}
                            {can.reassign && (
                                <Button color="secondary" size="md" onPress={() => setShowReassign(true)}>
                                    Alihkan Approver
                                </Button>
                            )}
                            {can.act && (
                                <>
                                    <Button color="secondary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                        Tolak
                                    </Button>
                                    <Button color="primary" size="md" isLoading={submitting} onPress={approve}>
                                        Setujui
                                    </Button>
                                </>
                            )}
                        </>
                    }
                />

                {!req && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Draft ini belum diajukan. Approver baru dapat melihatnya setelah Anda mengajukannya.
                    </div>
                )}

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-4 text-sm font-semibold text-slate-900">Status Alur Persetujuan</p>
                        <ol className="flex items-start overflow-x-auto">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                return (
                                    <li key={step.step_order} className="flex min-w-32 flex-1 flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex size-6 items-center justify-center rounded-full ${STEP_CIRCLE[state]}`}>
                                                {state === 'done' && <Check className="size-3.5 text-emerald-700" aria-hidden="true" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">
                                                Step {step.step_order}: {step.label}
                                            </p>
                                            <p className="text-[11px] text-slate-500">{STEP_TEXT[state]}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Penerimaan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {(
                                [
                                    ['No. Berita Acara', beritaAcara.no_berita_acara],
                                    ['Tanggal Pengajuan', new Date(beritaAcara.tanggal_penerimaan).toLocaleDateString('id-ID')],
                                    ['Sumber Perolehan', beritaAcara.sumber_perolehan ?? '—'],
                                    ['No. Kontrak/SPK', beritaAcara.no_kontrak_spk],
                                    ['Vendor/Penyedia', beritaAcara.vendor ?? '—'],
                                    ['Total Nilai', rupiah(total)],
                                ] as [string, string][]
                            ).map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Rincian Barang Diterima</p>
                        <div className="space-y-3">
                            {beritaAcara.items?.map((item) => (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{item.nama_aset}</p>
                                            <p className="text-xs text-slate-500">{item.merk_type}</p>
                                        </div>
                                        <div className="shrink-0 text-right text-sm">
                                            <p className="font-semibold tabular-nums text-slate-900">{rupiah(Number(item.nilai_per_unit))} / unit</p>
                                            <p className="text-xs tabular-nums text-slate-500">{item.jumlah_unit} unit</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute left-[-25px] top-1 size-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Pengajuan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {beritaAcara.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute left-[-25px] top-1 size-2.5 rounded-full ${ACTION_DOT[action.action]}`} />
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

            {confirmingDelete && (
                <ConfirmDialog
                    title="Hapus Draft"
                    confirmLabel="Ya, Hapus Draft"
                    isLoading={submitting}
                    onConfirm={deleteDraft}
                    onClose={() => setConfirmingDelete(false)}
                >
                    Hapus draft ini?
                </ConfirmDialog>
            )}

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

            <ModalOverlay isOpen={showReject} isDismissable={!submitting} isKeyboardDismissDisabled={submitting} onOpenChange={setShowReject}>
                <Modal className="sm:max-w-md">
                    <Dialog aria-labelledby="reject-title">
                        <div className="w-full p-6">
                            <h3 id="reject-title" className="mb-3 text-base font-bold text-slate-900">
                                Tolak Pengajuan
                            </h3>
                            <TextArea
                                aria-label="Alasan penolakan"
                                isRequired
                                rows={3}
                                placeholder="Alasan penolakan (wajib diisi)"
                                value={note}
                                onChange={setNote}
                            />
                            <div className="mt-4 flex justify-end gap-3">
                                <Button color="secondary" size="md" isDisabled={submitting} onPress={() => setShowReject(false)}>
                                    Batal
                                </Button>
                                <Button color="primary-destructive" size="md" isLoading={submitting} isDisabled={!note.trim()} onPress={reject}>
                                    Ya, Tolak
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
