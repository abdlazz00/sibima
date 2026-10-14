import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_COLOR, REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetPhoto, AssetReport, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    report: AssetReport;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ report, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [photo, setPhoto] = useState<AssetPhoto | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const req = report.approval_request;
    const steps = req?.steps ?? [];

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
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
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang', href: route('asset-reports.index') }, { label: 'Detail' }]}
                    title={`Laporan ${REPORT_TYPE_LABEL[report.jenis]} #${report.nomor_laporan}`}
                    badges={
                        <Badge type="color" size="sm" color={REPORT_STATUS_COLOR[report.status]} className="rounded-sm">
                            {REPORT_STATUS_LABEL[report.status]}
                        </Badge>
                    }
                    actions={
                        <>
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

                {req && <ApprovalStepper request={req} />}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Laporan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Kronologi</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{report.kronologi}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Aset</p>
                        {report.asset && (
                            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-900">{report.asset.nama_aset}</p>
                                <p className="text-xs text-slate-500">
                                    {report.asset.kode_barang} · {report.asset.merk_type ?? '—'}
                                </p>
                                <Link href={route('assets.show', report.asset.id)} className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline">
                                    Lihat detail aset
                                </Link>
                            </div>
                        )}
                        <p className="mb-2 text-sm font-semibold text-slate-900">Foto ({report.photos?.length ?? 0})</p>
                        {(report.photos?.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400">Tidak ada foto.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {report.photos?.map((p, idx) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setPhoto(p)}
                                        aria-label={`Perbesar foto laporan ${idx + 1}`}
                                        className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                    >
                                        <img src={p.url} alt="" className="size-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {req && <ApprovalTimeline request={req} createdTitle="Laporan Dibuat" creatorName={report.creator?.name} />}
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

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Tuliskan alasan penolakan laporan secara jelas. Alasan ini akan terlihat oleh pelapor."
                />
            )}

            <ModalOverlay isOpen={photo !== null} isDismissable onOpenChange={(open) => !open && setPhoto(null)}>
                <Modal className="sm:max-w-3xl">
                    <Dialog aria-label="Foto laporan">
                        {photo && <img src={photo.url} alt="Foto laporan" className="max-h-[80vh] w-full rounded-xl object-contain" />}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
