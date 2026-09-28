import {
    CameraIcon as Camera,
    ChevronRightIcon as ChevronRight,
    PencilIcon as Pencil,
    PrinterIcon as Printer,
} from '@/Components/Icons';
import PrintLabelModal from '@/Components/PrintLabelModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    asset: Asset;
    kondisiOptions: { value: string; label: string }[];
    can: { update: boolean };
    qr: string;
}

const KONDISI_STYLE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rusak_ringan: 'bg-amber-50 text-amber-700 border-amber-200',
    rusak_berat: 'bg-red-50 text-red-700 border-red-200',
    hilang: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_STYLE: Record<string, string> = {
    aktif: 'bg-blue-50 text-blue-700 border-blue-200',
    dalam_proses: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function DetailRow({ label, value, striped }: { label: string; value: React.ReactNode; striped: boolean }) {
    return (
        <div className={`flex gap-4 px-3 py-2.5 text-sm ${striped ? 'bg-slate-50' : 'bg-white'}`}>
            <p className="w-40 shrink-0 font-medium text-slate-500">{label}</p>
            <p className="flex-1 text-slate-900">{value}</p>
        </div>
    );
}

export default function Show({ asset, kondisiOptions, can, qr }: ShowProps) {
    const photos = asset.photos ?? [];
    const [activePhoto, setActivePhoto] = useState(0);
    const histories = asset.histories ?? [];
    const [showPrintModal, setShowPrintModal] = useState(false);

    return (
        <AuthenticatedLayout>
            <Head title={asset.nama_aset} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link href={route('dashboard')} className="hover:text-blue-700">
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link href={route('assets.index')} className="hover:text-blue-700">
                                Data Aset
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">Detail Aset</span>
                        </nav>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{asset.nama_aset}</h1>
                            <span
                                className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${KONDISI_STYLE[asset.kondisi]}`}
                            >
                                {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ?? asset.kondisi}
                            </span>
                            <span
                                className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[asset.status] ?? STATUS_STYLE.aktif}`}
                            >
                                {asset.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <Printer className="h-4 w-4" />
                            <span>Cetak Label QR</span>
                        </button>
                        {can.update && (
                            <Link
                                href={route('assets.edit', asset.id)}
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                            >
                                <Pencil className="h-4 w-4" />
                                <span>Edit Data</span>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Galeri Foto */}
                    <div className="w-full shrink-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-[420px]">
                        <p className="text-sm font-semibold text-slate-900">Galeri Foto Aset</p>

                        <div className="flex h-64 items-center justify-center rounded-lg bg-slate-100">
                            {photos[activePhoto] ? (
                                <img
                                    src={photos[activePhoto].url}
                                    alt={asset.nama_aset}
                                    className="h-full w-full rounded-lg object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Camera className="h-9 w-9" />
                                    <p className="text-sm">Belum ada foto aset</p>
                                </div>
                            )}
                        </div>

                        {photos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {photos.map((photo, idx) => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setActivePhoto(idx)}
                                        className={`h-16 w-16 overflow-hidden rounded border-2 ${
                                            idx === activePhoto ? 'border-blue-600' : 'border-transparent'
                                        }`}
                                    >
                                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="text-[11px] font-medium text-slate-500">
                            {photos.length} dari 10 foto
                        </p>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="mb-2 text-sm font-semibold text-slate-900">Label QR</p>
                            <img src={qr} alt="QR aset" className="mx-auto h-36 w-36" />
                        </div>
                    </div>

                    {/* Informasi Aset */}
                    <div className="flex-1 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-base font-semibold text-slate-900">Informasi Aset</p>
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                            <DetailRow label="Nama Barang" value={asset.nama_aset} striped />
                            <DetailRow label="Merk / Tipe" value={asset.merk_type ?? '—'} striped={false} />
                            <DetailRow label="Kategori" value={`${asset.category?.parent?.name ?? '—'} / ${asset.category?.name ?? '—'}`} striped />
                            <DetailRow label="Kode Barang BMD" value={<span className="font-mono">{asset.kode_barang}</span>} striped={false} />
                            <DetailRow label="No. Register" value={String(asset.nomor_register).padStart(4, '0')} striped />
                            <DetailRow label="Tanggal Perolehan" value={formatDate(asset.tanggal_perolehan)} striped={false} />
                            <DetailRow label="Sumber Perolehan" value={asset.sumber_perolehan ?? '—'} striped />
                            <DetailRow label="Nilai Perolehan" value={formatRupiah(asset.nilai_perolehan)} striped={false} />
                            <DetailRow label="Nilai Buku" value={formatRupiah(asset.nilai_buku)} striped />
                            <DetailRow label="No. Dokumen" value={asset.no_dokumen ?? '—'} striped={false} />
                            {asset.keterangan && <DetailRow label="Keterangan" value={asset.keterangan} striped />}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="mb-2 text-sm font-semibold text-slate-900">Lokasi &amp; Penanggung Jawab</p>
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <DetailRow label="Unit Kerja" value={asset.unit?.name ?? '—'} striped />
                                <DetailRow
                                    label="Pemegang Saat Ini"
                                    value={asset.current_holder?.nama ?? 'Belum ada pemegang'}
                                    striped={false}
                                />
                                <DetailRow label="Jabatan" value={asset.current_holder?.jabatan ?? '—'} striped />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Riwayat */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <p className="text-base font-semibold text-slate-900">Riwayat Mutasi &amp; Perubahan</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            {histories.length} riwayat
                        </span>
                    </div>

                    {histories.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada riwayat untuk aset ini.</p>
                    ) : (
                        <ol className="space-y-5 border-l border-slate-200 pl-5">
                            {histories.map((h) => (
                                <li key={h.id} className="relative">
                                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                    <p className="text-sm font-semibold text-slate-900">{h.event}</p>
                                    {h.keterangan && <p className="mt-0.5 text-sm text-slate-600">{h.keterangan}</p>}
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {formatDateTime(h.created_at)}
                                        {h.user ? ` · oleh ${h.user.name}` : ''}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>

            {showPrintModal && (
                <PrintLabelModal assetIds={[asset.id]} onClose={() => setShowPrintModal(false)} />
            )}
        </AuthenticatedLayout>
    );
}
