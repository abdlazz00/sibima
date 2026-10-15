import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format';
import { MUTATION_STATUS_COLOR, MUTATION_STATUS_LABEL, MUTATION_TYPE_COLOR, MUTATION_TYPE_LABEL } from '@/lib/mutasi';
import { ApprovalStep, AssetMutation, AssetPhoto, PageProps, Pegawai, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, Eye, Printer, XClose } from '@untitledui/icons';
import { useState } from 'react';

interface ShowProps extends PageProps {
    mutation: AssetMutation;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ mutation, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activePhoto, setActivePhoto] = useState<AssetPhoto | null>(null);

    const req = mutation.approval_request;
    const steps = req?.steps ?? [];
    const items = mutation.items ?? [];
    const isPending = mutation.status === 'pending';

    const totalNilaiPerolehan = items.reduce((sum, item) => sum + Number(item.asset?.nilai_perolehan ?? 0), 0);

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const stepTitle = (step: ApprovalStep): string => {
        if (step.unit_scope === 'origin' && mutation.origin_unit?.name) return `${step.label} (${mutation.origin_unit.name})`;
        if (step.unit_scope === 'destination' && mutation.destination_unit?.name) return `${step.label} (${mutation.destination_unit.name})`;
        return step.label;
    };

    const rejectionAction = req?.actions?.find((a) => a.action === 'reject');
    const cancelAction = req?.actions?.find((a) => a.action === 'cancel');

    return (
        <AuthenticatedLayout>
            <Head title={`Mutasi Aset #${mutation.nomor_mutasi}`} />

            <div className="space-y-6">
                <div className="print:hidden">
                    <PageHeader
                        crumbs={[{ label: 'Mutasi Aset', href: route('asset-mutations.index') }, { label: 'Detail' }]}
                        title={`Mutasi #${mutation.nomor_mutasi}`}
                        badges={
                            <>
                                <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[mutation.status]} className="rounded-sm">
                                    {MUTATION_STATUS_LABEL[mutation.status]}
                                </Badge>
                                <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                    {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                </Badge>
                            </>
                        }
                        actions={
                            <>
                                <Button color="primary-violet" size="md" iconLeading={Printer} onPress={() => window.print()}>
                                    Cetak
                                </Button>
                                {can.cancel && isPending && (
                                    <Button color="primary-destructive" size="md" onPress={() => setShowCancel(true)}>
                                        Batalkan Pengajuan
                                    </Button>
                                )}
                                {can.reassign && isPending && (
                                    <Button color="primary-violet" size="md" onPress={() => setShowReassign(true)}>
                                        Alihkan Approver
                                    </Button>
                                )}
                                {can.act && isPending && (
                                    <>
                                        <Button color="primary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                            Tolak
                                        </Button>
                                        <Button color="primary" size="md" isLoading={submitting} onPress={approve}>
                                            Setujui
                                        </Button>
                                    </>
                                )}
                                <Button color="secondary" size="md" href={route('asset-mutations.index')}>
                                    Kembali
                                </Button>
                            </>
                        }
                    />
                </div>

                {/* Judul cetak (hanya tampil saat dicetak) */}
                <div className="hidden border-b border-slate-300 pb-4 print:block">
                    <h1 className="text-xl font-bold uppercase text-slate-900">Berita Acara Mutasi Aset</h1>
                    <p className="text-xs text-slate-600">
                        Nomor: {mutation.nomor_mutasi} • Tanggal: {tanggal(mutation.tanggal_mutasi)}
                    </p>
                </div>

                {mutation.status === 'rejected' && rejectionAction && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900 shadow-xs">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <XClose className="size-3.5" aria-hidden="true" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-red-900">Pengajuan Mutasi Ini Ditolak</h3>
                                <p className="text-xs text-red-700">
                                    Ditolak oleh <span className="font-medium">{rejectionAction.user?.name ?? 'Pejabat Pemeriksa'}</span> pada{' '}
                                    {tanggalWaktu(rejectionAction.created_at)}
                                </p>
                                {rejectionAction.note && (
                                    <div className="mt-2 rounded-lg border border-red-200/60 bg-white p-3 text-xs italic text-red-800">
                                        &ldquo;{rejectionAction.note}&rdquo;
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {mutation.status === 'cancelled' && cancelAction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-xs">
                        <h3 className="font-semibold">Pengajuan Mutasi Ini Dibatalkan</h3>
                        <p className="text-xs text-slate-600">
                            Dibatalkan oleh <span className="font-medium">{cancelAction.user?.name ?? 'pengaju'}</span> pada{' '}
                            {tanggalWaktu(cancelAction.created_at)}
                        </p>
                        {cancelAction.note && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-xs italic">&ldquo;{cancelAction.note}&rdquo;</div>
                        )}
                    </div>
                )}

                {req && <ApprovalStepper request={req} titleFor={stepTitle} />}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                            <h2 className="text-sm font-bold text-slate-900">Informasi Pengajuan Dokumen</h2>
                            <span className="text-xs text-slate-400">ID #{mutation.id}</span>
                        </div>

                        <dl className="divide-y divide-slate-100 text-sm">
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Nomor Mutasi</dt>
                                <dd className="font-mono font-semibold text-slate-900">{mutation.nomor_mutasi}</dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Tanggal Mutasi</dt>
                                <dd className="text-slate-900">{tanggal(mutation.tanggal_mutasi)}</dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Jenis Perpindahan</dt>
                                <dd>
                                    <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                        {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                    </Badge>
                                </dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Diajukan Oleh</dt>
                                <dd className="font-medium text-slate-900">{mutation.creator?.name ?? '—'}</dd>
                            </div>
                            <div className="py-2.5">
                                <dt className="mb-1 font-medium text-slate-500">Catatan / Keterangan Mutasi</dt>
                                <dd className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                                    {mutation.keterangan || 'Tidak ada catatan tambahan untuk mutasi ini.'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div>
                            <div className="mb-4 border-b border-slate-100 pb-3">
                                <h2 className="text-sm font-bold text-slate-900">Alur Pemindahan Unit Kerja</h2>
                                <p className="text-xs text-slate-500">Perpindahan kepemilikan dan penatausahaan aset</p>
                            </div>

                            <div className="my-4 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-5 sm:flex-row">
                                <div className="w-full text-center sm:w-5/12 sm:text-left">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Asal (Pengirim)</span>
                                    <p className="mt-1 text-base font-bold text-slate-900">{mutation.origin_unit?.name ?? '—'}</p>
                                    <Badge type="color" size="sm" color="gray" className="mt-1 rounded-sm capitalize">
                                        {mutation.origin_unit?.type ?? 'Unit'}
                                    </Badge>
                                </div>

                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 max-sm:rotate-90">
                                    <ArrowRight className="size-5" aria-hidden="true" />
                                </div>

                                <div className="w-full text-center sm:w-5/12 sm:text-right">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Tujuan (Penerima)</span>
                                    <p className="mt-1 text-base font-bold text-slate-900">{mutation.destination_unit?.name ?? '—'}</p>
                                    <Badge type="color" size="sm" color="blue" className="mt-1 rounded-sm capitalize">
                                        {mutation.destination_unit?.type ?? 'Unit'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">Jumlah Aset Dipindahkan</span>
                                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{items.length} Item</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">Total Nilai Perolehan</span>
                                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{rupiah(totalNilaiPerolehan)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="text-base font-bold text-slate-900">Daftar Aset yang Dimutasi</h2>
                        <p className="text-xs text-slate-500">Rincian fisik, nilai perolehan, dan peralihan pemegang aset</p>
                    </div>

                    <Table aria-label="Aset yang dimutasi" size="sm">
                        <Table.Header>
                            <Table.Head id="no" label="No" isRowHeader />
                            <Table.Head id="kode" label="Kode & Register" />
                            <Table.Head id="nama" label="Nama & Kategori Aset" />
                            <Table.Head id="nilai" label="Nilai Perolehan" />
                            <Table.Head id="pemegang" label="Peralihan Pemegang" />
                            <Table.Head id="kondisi" label="Kondisi" />
                            <Table.Head id="catatan" label="Catatan Item" />
                        </Table.Header>
                        <Table.Body
                            items={items}
                            renderEmptyState={() => <p className="py-8 text-center text-sm text-slate-500">Tidak ada aset yang terdaftar pada mutasi ini.</p>}
                        >
                            {(item) => {
                                const asset = item.asset;
                                const oldHolder =
                                    item.origin_holder ?? asset?.current_holder ?? (asset as unknown as { currentHolder?: Pegawai })?.currentHolder;
                                const newHolder = item.target_holder ?? (item as unknown as { targetHolder?: Pegawai })?.targetHolder;
                                const kondisi = asset?.kondisi ?? 'baik';

                                return (
                                    <Table.Row id={item.id}>
                                        <Table.Cell className="font-medium tabular-nums text-slate-500">{items.indexOf(item) + 1}</Table.Cell>
                                        <Table.Cell>
                                            <span className="font-mono text-xs font-bold text-slate-900">{asset?.kode_barang ?? '—'}</span>
                                            <span className="block font-mono text-[11px] text-slate-500">
                                                Reg: {asset?.nomor_register != null ? String(asset.nomor_register).padStart(4, '0') : '—'}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="font-semibold text-slate-900">{asset?.nama_aset ?? '—'}</span>
                                            <span className="block text-xs text-slate-500">
                                                {asset?.category?.name ?? 'Tanpa Kategori'}
                                                {asset?.merk_type ? ` • ${asset.merk_type}` : ''}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-right font-medium tabular-nums text-slate-900">
                                            {asset?.nilai_perolehan ? rupiah(Number(asset.nilai_perolehan)) : '—'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <span className={`font-medium ${oldHolder?.nama ? 'text-slate-800' : 'italic text-slate-400'}`}>
                                                    {oldHolder?.nama ?? 'Belum ada'}
                                                </span>
                                                <ArrowRight className="size-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                                                <span className={`font-medium ${newHolder?.nama ? 'text-blue-900' : 'italic text-slate-500'}`}>
                                                    {newHolder?.nama ??
                                                        (mutation.jenis_mutasi === 'pengembalian'
                                                            ? 'Inventaris unit'
                                                            : (mutation.destination_unit?.name ?? 'Unit Penerima'))}
                                                </span>
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[kondisi] ?? 'gray'} className="rounded-sm">
                                                {KONDISI_LABEL[kondisi] ?? kondisi}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell className="text-xs text-slate-600">{item.catatan || '—'}</Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                </div>

                {mutation.photos && mutation.photos.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <h2 className="mb-1 text-base font-bold text-slate-900">Lampiran Dokumentasi Fisik &amp; Berkas</h2>
                        <p className="mb-4 text-xs text-slate-500">Dokumentasi foto kondisi aset saat proses mutasi</p>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {mutation.photos.map((photo, idx) => (
                                <button
                                    key={photo.id}
                                    type="button"
                                    onClick={() => setActivePhoto(photo)}
                                    aria-label={`Perbesar foto dokumentasi ${idx + 1}`}
                                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                >
                                    <img src={photo.url} alt="" className="size-full object-cover" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                        <Eye className="size-6 text-white" aria-hidden="true" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {req && (
                    <ApprovalTimeline
                        request={req}
                        createdTitle="Pengajuan Mutasi Dibuat"
                        creatorName={mutation.creator?.name}
                        createdAt={mutation.tanggal_mutasi}
                    />
                )}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Pengajuan dihentikan dan aset yang diajukan dikembalikan ke status Aktif di unit asal. Persetujuan yang sudah diberikan ikut hangus."
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
                    description="Silakan tuliskan alasan penolakan mutasi secara jelas. Aset yang diajukan akan otomatis dikembalikan ke status “Aktif” di unit asal."
                />
            )}

            <ModalOverlay isOpen={activePhoto !== null} isDismissable onOpenChange={(open) => !open && setActivePhoto(null)}>
                <Modal className="sm:max-w-3xl">
                    <Dialog aria-label="Foto dokumentasi mutasi">
                        {activePhoto && <img src={activePhoto.url} alt="Foto dokumentasi mutasi" className="max-h-[80vh] w-full rounded-xl object-contain" />}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
