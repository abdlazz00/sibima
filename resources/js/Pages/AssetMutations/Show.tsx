import {
    CalendarIcon as Calendar,
    CheckCircleIcon as CheckCircle,
    ChevronRightIcon as ChevronRight,
    EyeIcon as Eye,
    PrinterIcon as Printer,
    UserIcon as User,
    XIcon as X,
} from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    AssetMutation,
    AssetPhoto,
    MutationStatus,
    MutationType,
    PageProps,
    Pegawai,
    ReassignCandidate,
    ApprovalStep,
} from '@/types';
import CancelRequestModal from '@/Components/CancelRequestModal';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    mutation: AssetMutation;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

const STATUS_STYLE: Record<MutationStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200/60',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rejected: 'bg-red-50 text-red-700 border-red-200/60',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<MutationStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const MUTATION_TYPE_STYLE: Record<MutationType, string> = {
    kec_ke_kel: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    antar_kel: 'bg-sky-50 text-sky-700 border-sky-200/60',
    retur_kel_ke_kec: 'bg-purple-50 text-purple-700 border-purple-200/60',
    internal: 'bg-teal-50 text-teal-700 border-teal-200/60',
    pengembalian: 'bg-amber-50 text-amber-700 border-amber-200/60',
};

const MUTATION_TYPE_LABEL: Record<MutationType, string> = {
    kec_ke_kel: 'Kecamatan ke Kelurahan',
    antar_kel: 'Antar Kelurahan',
    retur_kel_ke_kec: 'Retur ke Kecamatan',
    internal: 'Mutasi Internal',
    pengembalian: 'Pengembalian ke Inventaris',
};

const KONDISI_STYLE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200/60',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200/60',
    hilang: 'bg-slate-100 text-slate-700 border-slate-300',
};

const KONDISI_LABEL: Record<string, string> = {
    baik: 'Baik',
    rusak_ringan: 'Rusak Ringan',
    rusak_berat: 'Rusak Berat',
    hilang: 'Hilang',
};

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function stepTitle(step: ApprovalStep, originName?: string, destName?: string): string {
    if (step.unit_scope === 'origin' && originName) return `${step.label} (${originName})`;
    if (step.unit_scope === 'destination' && destName) return `${step.label} (${destName})`;
    return step.label;
}

export default function Show({ mutation, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activePhoto, setActivePhoto] = useState<AssetPhoto | null>(null);

    const req = mutation.approval_request;
    const steps = req?.steps ?? [];
    const items = mutation.items ?? [];

    const totalNilaiPerolehan = items.reduce(
        (sum, item) => sum + Number(item.asset?.nilai_perolehan ?? 0),
        0
    );

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.approve', req.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const reject = () => {
        if (!req || submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', req.id),
            { note: note.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowReject(false);
                    setNote('');
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const stepState = (
        order: number
    ): 'done' | 'current' | 'upcoming' | 'rejected' => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (req.status === 'cancelled') return order < req.current_step ? 'done' : 'upcoming';
        if (req.status === 'rejected' && order === req.current_step)
            return 'rejected';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) return 'current';
        return 'upcoming';
    };

    const rejectionAction = req?.actions?.find((a) => a.action === 'reject');
    const cancelAction = req?.actions?.find((a) => a.action === 'cancel');

    return (
        <AuthenticatedLayout>
            <Head title={`Mutasi Aset #${mutation.nomor_mutasi}`} />

            <div className="space-y-6">
                {/* Header & Navigation */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link
                                href={route('dashboard')}
                                className="transition hover:text-blue-700"
                            >
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link
                                href={route('asset-mutations.index')}
                                className="transition hover:text-blue-700"
                            >
                                Mutasi Aset
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">
                                Detail
                            </span>
                        </nav>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                Mutasi #{mutation.nomor_mutasi}
                            </h1>
                            <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                    STATUS_STYLE[mutation.status]
                                }`}
                            >
                                {STATUS_LABEL[mutation.status]}
                            </span>
                            <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                    MUTATION_TYPE_STYLE[mutation.jenis_mutasi]
                                }`}
                            >
                                {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            <Printer className="h-4 w-4 text-slate-500" />
                            Cetak
                        </button>

                        {can.cancel && mutation.status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => setShowCancel(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                Batalkan Pengajuan
                            </button>
                        )}

                        {can.reassign && mutation.status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => setShowReassign(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                Alihkan Approver
                            </button>
                        )}

                        {can.act && mutation.status === 'pending' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowReject(true)}
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-xs transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                                >
                                    Tolak
                                </button>
                                <button
                                    type="button"
                                    onClick={approve}
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                                >
                                    {submitting ? 'Memproses...' : 'Setujui'}
                                </button>
                            </>
                        )}

                        <Link
                            href={route('asset-mutations.index')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                            Kembali
                        </Link>
                    </div>
                </div>

                {/* Print Title Header (Visible only when printed) */}
                <div className="hidden border-b border-slate-300 pb-4 print:block">
                    <h1 className="text-xl font-bold uppercase text-slate-900">
                        Berita Acara Mutasi Aset
                    </h1>
                    <p className="text-xs text-slate-600">
                        Nomor: {mutation.nomor_mutasi} &bull; Tanggal:{' '}
                        {formatDate(mutation.tanggal_mutasi)}
                    </p>
                </div>

                {/* Rejection Alert Banner if Rejected */}
                {mutation.status === 'rejected' && rejectionAction && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900 shadow-xs">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <X className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-red-900">
                                    Pengajuan Mutasi Ini Ditolak
                                </h3>
                                <p className="text-xs text-red-700">
                                    Ditolak oleh{' '}
                                    <span className="font-medium">
                                        {rejectionAction.user?.name ?? 'Pejabat Pemeriksa'}
                                    </span>{' '}
                                    pada {formatDateTime(rejectionAction.created_at)}
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
                            Dibatalkan oleh{' '}
                            <span className="font-medium">{cancelAction.user?.name ?? 'pengaju'}</span> pada{' '}
                            {formatDateTime(cancelAction.created_at)}
                        </p>
                        {cancelAction.note && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-xs italic">
                                &ldquo;{cancelAction.note}&rdquo;
                            </div>
                        )}
                    </div>
                )}

                {/* Workflow Stepper */}
                {req && steps.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs print:hidden">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">
                                    Tahapan Alur Persetujuan
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Alur verifikasi berjenjang sesuai kewenangan unit kerja
                                </p>
                            </div>
                            <span className="text-xs font-medium text-slate-500">
                                Langkah {req.current_step} dari {steps.length}
                            </span>
                        </div>

                        <div className="flex flex-col gap-6 md:flex-row md:items-start">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                const isDone = state === 'done';
                                const isCurrent = state === 'current';
                                const isRejected = state === 'rejected';

                                const matchingAction = req.actions?.find(
                                    (a) => a.action === 'approve' && a.step_order === step.step_order
                                );

                                return (
                                    <div
                                        key={step.step_order}
                                        className="relative flex flex-1 flex-col gap-2"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                                    isDone
                                                        ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500/20'
                                                        : isCurrent
                                                          ? 'bg-amber-100 text-amber-800 ring-4 ring-amber-400/30'
                                                          : isRejected
                                                            ? 'bg-red-100 text-red-800 ring-4 ring-red-400/30'
                                                            : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {isDone ? (
                                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                                ) : isRejected ? (
                                                    <X className="h-4 w-4 text-red-600" />
                                                ) : (
                                                    step.step_order
                                                )}
                                            </div>

                                            {idx < steps.length - 1 && (
                                                <div
                                                    className={`hidden h-0.5 flex-1 md:block ${
                                                        isDone
                                                            ? 'bg-emerald-400'
                                                            : 'bg-slate-200'
                                                    }`}
                                                />
                                            )}
                                        </div>

                                        <div className="mt-1">
                                            <p className="text-xs font-semibold text-slate-900">
                                                {stepTitle(step, mutation.origin_unit?.name, mutation.destination_unit?.name)}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-slate-500">
                                                {isDone ? (
                                                    <span className="text-emerald-700">
                                                        Disetujui
                                                        {matchingAction?.user?.name
                                                            ? ` (${matchingAction.user.name})`
                                                            : ''}
                                                    </span>
                                                ) : isRejected ? (
                                                    <span className="text-red-700">
                                                        Ditolak
                                                    </span>
                                                ) : isCurrent ? (
                                                    <span className="font-medium text-amber-700">
                                                        Menunggu Persetujuan
                                                    </span>
                                                ) : (
                                                    'Belum dimulai'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Transaction Summary Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Card 1: Informasi Dokumen */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                            <h2 className="text-sm font-bold text-slate-900">
                                Informasi Pengajuan Dokumen
                            </h2>
                            <span className="text-xs text-slate-400">
                                SIMASET ID #{mutation.id}
                            </span>
                        </div>

                        <dl className="divide-y divide-slate-100 text-sm">
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">
                                    Nomor Mutasi
                                </dt>
                                <dd className="font-mono font-semibold text-slate-900">
                                    {mutation.nomor_mutasi}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">
                                    Tanggal Mutasi
                                </dt>
                                <dd className="text-slate-900">
                                    {formatDate(mutation.tanggal_mutasi)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">
                                    Jenis Perpindahan
                                </dt>
                                <dd>
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                            MUTATION_TYPE_STYLE[
                                                mutation.jenis_mutasi
                                            ]
                                        }`}
                                    >
                                        {MUTATION_TYPE_LABEL[
                                            mutation.jenis_mutasi
                                        ]}
                                    </span>
                                </dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">
                                    Diajukan Oleh
                                </dt>
                                <dd className="font-medium text-slate-900">
                                    {mutation.creator?.name ?? '—'}
                                </dd>
                            </div>
                            <div className="py-2.5">
                                <dt className="mb-1 font-medium text-slate-500">
                                    Catatan / Keterangan Mutasi
                                </dt>
                                <dd className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                                    {mutation.keterangan ||
                                        'Tidak ada catatan tambahan untuk mutasi ini.'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Card 2: Alur Perpindahan Unit */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div>
                            <div className="mb-4 border-b border-slate-100 pb-3">
                                <h2 className="text-sm font-bold text-slate-900">
                                    Alur Pemindahan Unit Kerja
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Perpindahan kepemilikan dan penatausahaan aset
                                </p>
                            </div>

                            <div className="my-4 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-5 sm:flex-row">
                                {/* Unit Asal */}
                                <div className="w-full text-center sm:w-5/12 sm:text-left">
                                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                                        Unit Asal (Pengirim)
                                    </span>
                                    <p className="mt-1 text-base font-bold text-slate-900">
                                        {mutation.origin_unit?.name ?? '—'}
                                    </p>
                                    <span className="mt-1 inline-flex items-center rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">
                                        {mutation.origin_unit?.type ?? 'Unit'}
                                    </span>
                                </div>

                                {/* Arrow Divider */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-xs">
                                    <svg
                                        className="h-5 w-5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M5 12h14" />
                                        <path d="m12 5 7 7-7 7" />
                                    </svg>
                                </div>

                                {/* Unit Tujuan */}
                                <div className="w-full text-center sm:w-5/12 sm:text-right">
                                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                                        Unit Tujuan (Penerima)
                                    </span>
                                    <p className="mt-1 text-base font-bold text-slate-900">
                                        {mutation.destination_unit?.name ?? '—'}
                                    </p>
                                    <span className="mt-1 inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 capitalize">
                                        {mutation.destination_unit?.type ?? 'Unit'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 gap-3 pt-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">
                                    Jumlah Aset Dipindahkan
                                </span>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                    {items.length} Item
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">
                                    Total Nilai Perolehan
                                </span>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                    {formatRupiah(totalNilaiPerolehan)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table of Items */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="text-base font-bold text-slate-900">
                            Daftar Aset yang Dimutasi
                        </h2>
                        <p className="text-xs text-slate-500">
                            Rincian fisik, nilai perolehan, dan peralihan pemegang aset
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th className="px-5 py-3.5 text-center">No</th>
                                    <th className="px-5 py-3.5">Kode & Register</th>
                                    <th className="px-5 py-3.5">Nama & Kategori Aset</th>
                                    <th className="px-5 py-3.5 text-right">Nilai Perolehan</th>
                                    <th className="px-5 py-3.5">Peralihan Pemegang</th>
                                    <th className="px-5 py-3.5 text-center">Kondisi</th>
                                    <th className="px-5 py-3.5">Catatan Item</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-6 py-8 text-center text-sm text-slate-500"
                                        >
                                            Tidak ada aset yang terdaftar pada mutasi ini.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, index) => {
                                        const asset = item.asset;
                                        const oldHolder =
                                            item.origin_holder ??
                                            asset?.current_holder ??
                                            (
                                                asset as unknown as {
                                                    currentHolder?: Pegawai;
                                                }
                                            )?.currentHolder;
                                        const newHolder =
                                            item.target_holder ??
                                            (
                                                item as unknown as {
                                                    targetHolder?: Pegawai;
                                                }
                                            )?.targetHolder;

                                        return (
                                            <tr
                                                key={item.id}
                                                className="transition hover:bg-slate-50/60"
                                            >
                                                <td className="px-5 py-4 text-center font-medium text-slate-500">
                                                    {index + 1}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="font-mono text-xs font-bold text-slate-900">
                                                        {asset?.kode_barang ?? '—'}
                                                    </span>
                                                    <p className="font-mono text-[11px] text-slate-500">
                                                        Reg:{' '}
                                                        {asset?.nomor_register != null
                                                            ? String(
                                                                  asset.nomor_register
                                                              ).padStart(4, '0')
                                                            : '—'}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-900">
                                                        {asset?.nama_aset ?? '—'}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {asset?.category?.name ?? 'Tanpa Kategori'}
                                                        {asset?.merk_type
                                                            ? ` &bull; ${asset.merk_type}`
                                                            : ''}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right font-medium text-slate-900">
                                                    {asset?.nilai_perolehan
                                                        ? formatRupiah(
                                                              asset.nilai_perolehan
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span
                                                            className={`font-medium ${
                                                                oldHolder?.nama
                                                                    ? 'text-slate-800'
                                                                    : 'text-slate-400 italic'
                                                            }`}
                                                        >
                                                            {oldHolder?.nama ?? 'Belum ada'}
                                                        </span>
                                                        <span className="text-blue-600">
                                                            &rarr;
                                                        </span>
                                                        <span
                                                            className={`font-medium ${
                                                                newHolder?.nama
                                                                    ? 'text-blue-900'
                                                                    : 'text-slate-500 italic'
                                                            }`}
                                                        >
                                                            {newHolder?.nama ??
                                                                (mutation.jenis_mutasi === 'pengembalian'
                                                                    ? 'Inventaris unit'
                                                                    : (mutation.destination_unit?.name ?? 'Unit Penerima'))}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                                            KONDISI_STYLE[
                                                                asset?.kondisi ?? 'baik'
                                                            ]
                                                        }`}
                                                    >
                                                        {KONDISI_LABEL[
                                                            asset?.kondisi ?? 'baik'
                                                        ] ?? asset?.kondisi}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-slate-600">
                                                    {item.catatan || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {items.length > 0 && (
                                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="px-5 py-3 text-right text-xs uppercase text-slate-600"
                                        >
                                            Total Nilai Buku / Perolehan:
                                        </td>
                                        <td className="px-5 py-3 text-right text-sm font-bold text-blue-900">
                                            {formatRupiah(totalNilaiPerolehan)}
                                        </td>
                                        <td
                                            colSpan={3}
                                            className="px-5 py-3 text-xs text-slate-500"
                                        >
                                            {items.length} item barang terdata
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Lampiran Foto Fisik Aset */}
                {mutation.photos && mutation.photos.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <h2 className="mb-1 text-base font-bold text-slate-900">
                            Lampiran Dokumentasi Fisik & Berkas
                        </h2>
                        <p className="mb-4 text-xs text-slate-500">
                            Dokumentasi foto kondisi aset saat proses mutasi
                        </p>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {mutation.photos.map((photo) => (
                                <div
                                    key={photo.id}
                                    onClick={() => setActivePhoto(photo)}
                                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:opacity-90"
                                >
                                    <img
                                        src={photo.url}
                                        alt="Dokumentasi Mutasi"
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                        <Eye className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Riwayat Aktivitas & Catatan Persetujuan */}
                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <h2 className="mb-1 text-base font-bold text-slate-900">
                            Riwayat Persetujuan & Log Aktivitas
                        </h2>
                        <p className="mb-6 text-xs text-slate-500">
                            Catatan audit trail seluruh tindakan pada mutasi ini
                        </p>

                        <ol className="relative space-y-6 border-l border-slate-200 pl-6">
                            {/* Created event */}
                            <li className="relative">
                                <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white" />
                                <div className="space-y-0.5">
                                    <p className="text-sm font-bold text-slate-900">
                                        Pengajuan Mutasi Dibuat
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Diajukan oleh{' '}
                                        <span className="font-semibold text-slate-700">
                                            {mutation.creator?.name ?? 'Pengguna'}
                                        </span>{' '}
                                        pada {formatDate(mutation.tanggal_mutasi)}
                                    </p>
                                </div>
                            </li>

                            {/* Approval / Rejection Actions */}
                            {req.actions?.map((action) => {
                                const isApprove = action.action === 'approve';
                                const isReassign = action.action === 'reassign';
                                const isNeutral = isReassign || action.action === 'cancel';
                                return (
                                    <li key={action.id} className="relative">
                                        <span
                                            className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                                                isApprove
                                                    ? 'bg-emerald-600'
                                                    : isReassign
                                                      ? 'bg-blue-600'
                                                      : isNeutral
                                                        ? 'bg-slate-500'
                                                        : 'bg-red-600'
                                            }`}
                                        />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-900">
                                                {isApprove
                                                    ? 'Persetujuan Diberikan'
                                                    : isReassign
                                                      ? 'Approver Dialihkan'
                                                      : action.action === 'cancel'
                                                        ? 'Pengajuan Dibatalkan'
                                                        : 'Pengajuan Ditolak'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Diproses oleh{' '}
                                                <span className="font-semibold text-slate-700">
                                                    {action.user?.name ?? 'Pejabat Pemeriksa'}
                                                </span>{' '}
                                                pada {formatDateTime(action.created_at)}
                                            </p>
                                            {action.note && (
                                                <div
                                                    className={`mt-2 rounded-lg border p-3 text-xs ${
                                                        isApprove
                                                            ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                                                            : isNeutral
                                                              ? 'border-slate-200 bg-slate-50 text-slate-800'
                                                              : 'border-red-100 bg-red-50/70 text-red-900'
                                                    }`}
                                                >
                                                    <span className="font-semibold">
                                                        Catatan:
                                                    </span>{' '}
                                                    {action.note}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
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

            {/* Modal Tolak Pengajuan */}
            {showReject && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs transition-all"
                    onClick={() => !submitting && setShowReject(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900">
                                Tolak Pengajuan Mutasi
                            </h3>
                            <button
                                type="button"
                                onClick={() => !submitting && setShowReject(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="mb-3 text-xs leading-relaxed text-slate-600">
                            Silakan tuliskan alasan penolakan mutasi secara jelas.
                            Aset yang diajukan akan otomatis dikembalikan ke status
                            &ldquo;Aktif&rdquo; di unit asal.
                        </p>

                        <div className="space-y-1.5">
                            <label
                                htmlFor="rejection-note"
                                className="block text-xs font-semibold text-slate-700"
                            >
                                Alasan Penolakan <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                id="rejection-note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={4}
                                maxLength={1000}
                                placeholder="Contoh: Dokumen pendukung belum lengkap / unit penerima belum siap..."
                                className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                            />
                            <div className="flex justify-between text-[11px] text-slate-400">
                                <span>Wajib diisi</span>
                                <span>{note.length} / 1000</span>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowReject(false)}
                                disabled={submitting}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={reject}
                                disabled={!note.trim() || submitting}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                            >
                                {submitting ? 'Memproses...' : 'Ya, Tolak Mutasi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal for Photo */}
            {activePhoto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setActivePhoto(null)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-xl bg-white p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setActivePhoto(null)}
                            className="absolute right-4 top-4 rounded-full bg-slate-900/60 p-1.5 text-white transition hover:bg-slate-900"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img
                            src={activePhoto.url}
                            alt="Foto Aset Penuh"
                            className="max-h-[85vh] w-auto rounded-lg object-contain"
                        />
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
