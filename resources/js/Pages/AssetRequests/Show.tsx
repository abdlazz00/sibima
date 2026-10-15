import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_COLOR, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { XClose } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface EligibleAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
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

export default function Show({ assetRequest: r, can, reassignCandidates, eligibleAssets }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [note, setNote] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);

    const req = r.approval_request;
    const steps = req?.steps ?? [];
    const single = r.jenis === 'pegawai';

    const selectableEligibleAssets: SelectableAsset[] = useMemo(() => {
        return eligibleAssets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: null,
        }));
    }, [eligibleAssets]);

    const selectedAssetsDetails = useMemo(() => {
        return eligibleAssets.filter((a) => selected.includes(a.id));
    }, [eligibleAssets, selected]);

    const post = (name: string, id: number, data: Parameters<typeof router.post>[1], onSuccess?: () => void) => {
        if (submitting) return;
        setSubmitting(true);
        router.post(route(name, id), data, { preserveScroll: true, onSuccess, onFinish: () => setSubmitting(false) });
    };

    const dismissCloseModal = () => {
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
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset', href: route('asset-requests.index') }, { label: 'Detail' }]}
                    title={`Permohonan #${r.nomor_permohonan}`}
                    badges={
                        <Badge type="color" size="sm" color={REQUEST_STATUS_COLOR[r.status]} className="rounded-sm">
                            {REQUEST_STATUS_LABEL[r.status]}
                        </Badge>
                    }
                    actions={
                        <>
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
                            {can.close && (
                                <Button color="primary-destructive" size="md" onPress={() => setShowClose(true)}>
                                    Tutup Permohonan
                                </Button>
                            )}
                            {can.act && (
                                <>
                                    <Button color="primary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                        Tolak
                                    </Button>
                                    <Button color="primary" size="md" isLoading={submitting} onPress={() => req && post('approval-requests.approve', req.id, {})}>
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
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Permohonan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
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

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Pemenuhan</p>

                        {r.mutation && (
                            <p className="mb-3 text-sm text-slate-700">
                                Mutasi:{' '}
                                <Link href={route('asset-mutations.show', r.mutation.id)} className="font-semibold text-blue-700 hover:underline">
                                    {r.mutation.nomor_mutasi}
                                </Link>
                            </p>
                        )}

                        {(r.assets?.length ?? 0) > 0 && (
                            <ul className="mb-3 space-y-1.5 text-sm">
                                {r.assets?.map((a) => (
                                    <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <Link href={route('assets.show', a.id)} className="font-semibold text-slate-900 hover:text-blue-700">
                                            {a.nama_aset}
                                        </Link>
                                        <span className="ml-2 text-xs text-slate-500">{a.kode_barang}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {can.fulfill ? (
                            <div className="space-y-3">
                                {eligibleAssets.length === 0 ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                        Belum ada aset yang memenuhi syarat di unit Anda. Anda dapat menutup permohonan ini.
                                    </div>
                                ) : selected.length === 0 ? (
                                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                                        <p className="text-sm font-semibold text-slate-800">Pilih {single ? '1 aset' : `tepat ${r.jumlah} aset`} untuk dipenuhi</p>
                                        <p className="mt-1 text-xs text-slate-500">Tersedia {eligibleAssets.length} aset yang memenuhi syarat</p>
                                        <Button className="mt-3" color="primary" size="md" onPress={() => setIsFulfillModalOpen(true)}>
                                            Buka Daftar Aset untuk Dipenuhi
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Aset Terpilih ({selected.length}
                                                    {!single ? ` / ${r.jumlah}` : ''})
                                                </p>
                                                {!single && selected.length !== r.jumlah && (
                                                    <p className="text-xs font-semibold text-amber-600">Harus memilih tepat {r.jumlah} aset</p>
                                                )}
                                            </div>
                                            <Button color="link-color" size="sm" onPress={() => setIsFulfillModalOpen(true)}>
                                                Ubah Pilihan
                                            </Button>
                                        </div>

                                        <div className="overflow-hidden rounded-xl border border-slate-200">
                                            <Table aria-label="Aset terpilih untuk pemenuhan" size="sm">
                                                <Table.Header>
                                                    <Table.Head id="nama" label="Nama Barang" isRowHeader />
                                                    <Table.Head id="kode" label="Kode & Reg" />
                                                    <Table.Head id="aksi" label="Aksi" />
                                                </Table.Header>
                                                <Table.Body items={selectedAssetsDetails}>
                                                    {(asset) => (
                                                        <Table.Row id={asset.id}>
                                                            <Table.Cell>
                                                                <span className="font-semibold text-slate-900">{asset.nama_aset}</span>
                                                                <span className="block text-xs text-slate-500">{asset.merk_type || '—'}</span>
                                                            </Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">
                                                                <span className="font-mono text-xs text-slate-700">{asset.kode_barang}</span>
                                                                <span className="block text-[11px] font-semibold text-slate-500">
                                                                    Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <Button
                                                                    color="primary-destructive"
                                                                    size="sm"
                                                                    iconLeading={XClose}
                                                                    aria-label={`Hapus pilihan ${asset.nama_aset}`}
                                                                    onPress={() => setSelected((cur) => cur.filter((id) => id !== asset.id))}
                                                                />
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table>
                                        </div>

                                        <Button
                                            className="w-full"
                                            color="primary"
                                            size="md"
                                            isLoading={submitting}
                                            isDisabled={selected.length === 0 || (!single && selected.length !== r.jumlah)}
                                            onPress={() => post('asset-requests.fulfill', r.id, { asset_ids: selected }, () => setSelected([]))}
                                        >
                                            {single ? 'Serahkan ke Pegawai' : 'Ajukan Mutasi Pemenuhan'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            r.status === 'approved' && !r.mutation && <p className="text-sm text-slate-500">Menunggu pemenuhan oleh admin unit terkait.</p>
                        )}
                    </div>
                </div>

                {req && <ApprovalTimeline request={req} createdTitle="Permohonan Dibuat" creatorName={r.creator?.name} createdAt={r.created_at} />}
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

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Tuliskan alasan penolakan secara jelas. Alasan ini akan terlihat oleh pemohon."
                />
            )}

            <ModalOverlay isOpen={showClose} isDismissable={!submitting} isKeyboardDismissDisabled={submitting} onOpenChange={(open) => !open && dismissCloseModal()}>
                <Modal className="sm:max-w-md">
                    <Dialog aria-labelledby="close-request-title">
                        <div className="w-full p-6">
                            <h3 id="close-request-title" className="mb-2 text-base font-bold text-slate-900">
                                Tutup Permohonan
                            </h3>
                            <p className="mb-4 text-xs leading-relaxed text-slate-600">Permohonan ditutup tanpa dipenuhi. Alasan penutupan tercatat pada permohonan.</p>
                            <TextArea label="Alasan Penutupan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button color="secondary" size="md" isDisabled={submitting} onPress={dismissCloseModal}>
                                    Batal
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    isLoading={submitting}
                                    isDisabled={!note.trim()}
                                    onPress={() => post('asset-requests.close', r.id, { note: note.trim() }, dismissCloseModal)}
                                >
                                    Ya, Tutup
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {can.fulfill && (
                <AssetSelectModal
                    isOpen={isFulfillModalOpen}
                    onClose={() => setIsFulfillModalOpen(false)}
                    assets={selectableEligibleAssets}
                    selectedIds={selected}
                    onConfirm={(confirmed) => {
                        setSelected(confirmed.map((a) => a.id));
                        setIsFulfillModalOpen(false);
                    }}
                    mode={single ? 'single' : 'multiple'}
                    maxSelection={single ? 1 : r.jumlah}
                    title="Pilih Aset untuk Dipenuhi"
                    description={
                        single
                            ? 'Pilih 1 aset dari daftar di bawah ini untuk diserahkan kepada pegawai pemohon.'
                            : `Pilih tepat ${r.jumlah} aset dari daftar di bawah ini untuk dimutasi ke unit pemohon.`
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
