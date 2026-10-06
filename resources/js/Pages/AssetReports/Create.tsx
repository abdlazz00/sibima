import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import { ChevronRightIcon as ChevronRight, UploadIcon as Upload } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { AssetReportType, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

interface ReportableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
    holder: string | null;
}

interface CreateProps extends PageProps {
    assets: ReportableAsset[];
    kondisiOptions: { value: string; label: string }[];
}

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Create({ assets, kondisiOptions }: CreateProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const form = useForm({
        asset_id: '',
        jenis: 'rusak' as AssetReportType,
        kondisi_baru: 'rusak_ringan',
        tanggal_kejadian: new Date().toISOString().slice(0, 10),
        kronologi: '',
        photos: [] as File[],
    });

    const selectableAssets: SelectableAsset[] = useMemo(() => {
        return assets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: a.holder,
        }));
    }, [assets]);

    const asset = assets.find((a) => String(a.id) === form.data.asset_id);
    const photoError = Object.entries(form.errors).find(([key]) => key.startsWith('photos'))?.[1];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, kondisi_baru: data.jenis === 'rusak' ? data.kondisi_baru : '' }));
        form.post(route('asset-reports.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Laporan Rusak/Hilang" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('asset-reports.index')} className="hover:text-blue-700">Lapor Rusak/Hilang</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Buat Laporan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Buat Laporan Rusak/Hilang</h1>
                </div>

                <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Aset yang Dilaporkan *</label>
                        {assets.length === 0 ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                Tidak ada aset yang dapat dilaporkan di unit Anda.
                            </div>
                        ) : !asset ? (
                            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                                <p className="text-sm font-semibold text-slate-800">
                                    Belum ada aset yang dipilih
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Buka tabel daftar aset untuk memilih aset yang mengalami kerusakan atau kehilangan
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(true)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-800"
                                >
                                    + Pilih Aset yang Dilaporkan
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-slate-600">{asset.kode_barang}</span>
                                            <span className="inline-flex rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                                Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                            </span>
                                        </div>
                                        <h3 className="mt-1 text-base font-bold text-slate-900">{asset.nama_aset}</h3>
                                        <p className="text-xs text-slate-500">{asset.merk_type || '—'}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Kondisi Saat Ini</p>
                                            <span className="mt-0.5 inline-block text-xs font-semibold text-slate-800">
                                                {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                            </span>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Pemegang</p>
                                            <span className="mt-0.5 inline-block text-xs font-semibold text-slate-800">
                                                {asset.holder ?? 'Inventaris Unit'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(true)}
                                            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-xs hover:bg-slate-50"
                                        >
                                            Ganti Aset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {form.errors.asset_id && <p className="mt-1.5 text-xs font-medium text-red-600">{form.errors.asset_id}</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Jenis Laporan *</label>
                            <div className="flex gap-4 text-sm">
                                {(['rusak', 'hilang'] as AssetReportType[]).map((j) => (
                                    <label key={j} className="flex items-center gap-2">
                                        <input type="radio" name="jenis" checked={form.data.jenis === j} onChange={() => form.setData('jenis', j)} />
                                        {j === 'rusak' ? 'Rusak' : 'Hilang'}
                                    </label>
                                ))}
                            </div>
                            {form.errors.jenis && <p className="mt-1 text-xs text-red-600">{form.errors.jenis}</p>}
                        </div>
                        {form.data.jenis === 'rusak' && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Kondisi Baru *</label>
                                <select value={form.data.kondisi_baru} onChange={(e) => form.setData('kondisi_baru', e.target.value)} className={FIELD}>
                                    {kondisiOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                {form.errors.kondisi_baru && <p className="mt-1 text-xs text-red-600">{form.errors.kondisi_baru}</p>}
                            </div>
                        )}
                    </div>

                    <div className="max-w-xs">
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Tanggal Kejadian *</label>
                        <input type="date" value={form.data.tanggal_kejadian} max={new Date().toISOString().slice(0, 10)} onChange={(e) => form.setData('tanggal_kejadian', e.target.value)} className={FIELD} />
                        {form.errors.tanggal_kejadian && <p className="mt-1 text-xs text-red-600">{form.errors.tanggal_kejadian}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Kronologi *</label>
                        <textarea value={form.data.kronologi} onChange={(e) => form.setData('kronologi', e.target.value)} rows={4} className={FIELD} placeholder="Jelaskan kejadian, waktu, dan penyebabnya." />
                        {form.errors.kronologi && <p className="mt-1 text-xs text-red-600">{form.errors.kronologi}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">
                            Foto Pendukung {form.data.jenis === 'rusak' ? '* (minimal 1)' : '(opsional)'}
                        </label>
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
                            <Upload className="h-6 w-6 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah foto (JPG/PNG/WEBP)</span>
                            <span className="text-xs text-slate-500">Maks. 10 foto, 5MB per foto</span>
                            <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => form.setData('photos', Array.from(e.target.files ?? []))} />
                        </label>
                        {form.data.photos.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {form.data.photos.map((f, i) => <li key={i}>{f.name}</li>)}
                            </ul>
                        )}
                        {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link href={route('asset-reports.index')} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</Link>
                        <button type="submit" disabled={form.processing || !form.data.asset_id} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {form.processing ? 'Mengirim...' : 'Ajukan Laporan'}
                        </button>
                    </div>
                </form>
            </div>

            <AssetSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                assets={selectableAssets}
                selectedIds={form.data.asset_id ? [Number(form.data.asset_id)] : []}
                onConfirm={(confirmed) => {
                    if (confirmed.length > 0) {
                        form.setData('asset_id', String(confirmed[0].id));
                    }
                    setIsModalOpen(false);
                }}
                mode="single"
                title="Pilih Aset yang Dilaporkan"
                description="Pilih 1 aset dari tabel di bawah ini yang mengalami kerusakan atau kehilangan."
            />
        </AuthenticatedLayout>
    );
}
