import PageHeader from '@/Components/PageHeader';
import PrintLabelModal from '@/Components/PrintLabelModal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR } from '@/lib/assetReport';
import { Asset, PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { Camera01, Edit01, Printer } from '@untitledui/icons';
import { useState } from 'react';

interface ShowProps extends PageProps {
    asset: Asset;
    kondisiOptions: { value: string; label: string }[];
    can: { update: boolean };
    qr: string;
}

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
        <div className={`flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:gap-4 ${striped ? 'bg-slate-50' : 'bg-white'}`}>
            <p className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</p>
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
                <PageHeader
                    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Detail Aset' }]}
                    title={asset.nama_aset}
                    badges={
                        <>
                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="rounded-sm">
                                {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ?? asset.kondisi}
                            </Badge>
                            <Badge type="color" size="sm" color={asset.status === 'aktif' ? 'brand' : 'warning'} className="rounded-sm">
                                {asset.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
                            </Badge>
                        </>
                    }
                    actions={
                        <>
                            <Button color="primary-violet" size="md" iconLeading={Printer} onPress={() => setShowPrintModal(true)}>
                                Cetak Label QR
                            </Button>
                            {can.update && (
                                <Button color="primary-green" size="md" iconLeading={Edit01} href={route('assets.edit', asset.id)}>
                                    Edit Data
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Galeri Foto */}
                    <div className="w-full shrink-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:w-[420px]">
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
                                    <Camera01 className="size-9" aria-hidden="true" />
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
                                        aria-label={`Foto ${idx + 1}`}
                                        aria-current={idx === activePhoto}
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
                    <div className="flex-1 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
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
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
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
                                    <span className="absolute left-[-25px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
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
