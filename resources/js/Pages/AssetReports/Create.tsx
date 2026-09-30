import { ChevronRightIcon as ChevronRight, UploadIcon as Upload } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { AssetReportType, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface ReportableAsset {
    id: number;
    kode_barang: string;
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
    const form = useForm({
        asset_id: '',
        jenis: 'rusak' as AssetReportType,
        kondisi_baru: 'rusak_ringan',
        tanggal_kejadian: new Date().toISOString().slice(0, 10),
        kronologi: '',
        photos: [] as File[],
    });

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
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Aset *</label>
                        <select value={form.data.asset_id} onChange={(e) => form.setData('asset_id', e.target.value)} className={FIELD}>
                            <option value="">Pilih aset...</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>{a.kode_barang} — {a.nama_aset}{a.merk_type ? ` (${a.merk_type})` : ''}</option>
                            ))}
                        </select>
                        {form.errors.asset_id && <p className="mt-1 text-xs text-red-600">{form.errors.asset_id}</p>}
                        {asset && (
                            <p className="mt-2 text-xs text-slate-500">
                                Kondisi sekarang: <span className="font-semibold text-slate-700">{KONDISI_LABEL[asset.kondisi]}</span>
                                {' · '}Pemegang: <span className="font-semibold text-slate-700">{asset.holder ?? 'Tidak ada (milik unit)'}</span>
                            </p>
                        )}
                        {assets.length === 0 && <p className="mt-2 text-xs text-amber-700">Tidak ada aset yang dapat dilaporkan di unit Anda.</p>}
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
        </AuthenticatedLayout>
    );
}
