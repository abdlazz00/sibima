import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean; cancel: boolean; edit: boolean; delete: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
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

    const deleteDraft = () => {
        setSubmitting(true);
        router.delete(route('penerimaan-aset.destroy', beritaAcara.id), {
            onFinish: () => {
                setSubmitting(false);
                setConfirmingDelete(false);
            },
        });
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
                                <Button color="primary-destructive" size="md" onPress={() => setConfirmingDelete(true)}>
                                    Hapus Draft
                                </Button>
                            )}
                            {can.edit && (
                                <Button color="primary-green" size="md" href={route('penerimaan-aset.edit', beritaAcara.id)}>
                                    Edit &amp; Ajukan
                                </Button>
                            )}
                            {can.cancel && (
                                <Button color="primary-destructive" size="md" onPress={() => setShowCancel(true)}>
                                    Batalkan Pengajuan
                                </Button>
                            )}
                            {can.reassign && (
                                <Button color="primary-violet" size="md" onPress={() => setShowReassign(true)}>
                                    Alihkan Approver
                                </Button>
                            )}
                            {can.act && (
                                <>
                                    <Button color="primary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
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

                {req && <ApprovalStepper request={req} />}

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

                {req && <ApprovalTimeline request={req} createdTitle="Pengajuan Dibuat" creatorName={beritaAcara.creator?.name} />}
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

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Tuliskan alasan penolakan secara jelas. Alasan ini akan terlihat oleh pengaju."
                />
            )}
        </AuthenticatedLayout>
    );
}
