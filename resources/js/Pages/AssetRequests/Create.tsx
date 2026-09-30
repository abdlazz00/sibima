import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetRequestType, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    pegawais: { id: number; nama: string; jabatan: string | null }[];
    categories: { id: number; name: string }[];
    canUnit: boolean;
}

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function Create({ pegawais, categories, canUnit }: CreateProps) {
    const form = useForm({
        jenis: 'pegawai' as AssetRequestType,
        pegawai_id: '',
        jumlah: '1',
        category_id: '',
        keterangan: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => (data.jenis === 'pegawai' ? { ...data, jumlah: '' } : { ...data, pegawai_id: '' }));
        form.post(route('asset-requests.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Permohonan Aset" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('asset-requests.index')} className="hover:text-blue-700">Permohonan Aset</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Buat Permohonan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Buat Permohonan Aset</h1>
                </div>

                <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Jenis Permohonan *</label>
                        <div className="flex flex-col gap-2 text-sm">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="jenis" checked={form.data.jenis === 'pegawai'} onChange={() => form.setData('jenis', 'pegawai')} />
                                Untuk pegawai (aset diserahkan ke pegawai dari stok unit)
                            </label>
                            {canUnit && (
                                <label className="flex items-center gap-2">
                                    <input type="radio" name="jenis" checked={form.data.jenis === 'unit'} onChange={() => form.setData('jenis', 'unit')} />
                                    Untuk unit (minta stok dari kecamatan)
                                </label>
                            )}
                        </div>
                        {form.errors.jenis && <p className="mt-1 text-xs text-red-600">{form.errors.jenis}</p>}
                    </div>

                    {form.data.jenis === 'pegawai' ? (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Pegawai *</label>
                            <select value={form.data.pegawai_id} onChange={(e) => form.setData('pegawai_id', e.target.value)} className={FIELD}>
                                <option value="">Pilih pegawai...</option>
                                {pegawais.map((p) => <option key={p.id} value={p.id}>{p.nama}{p.jabatan ? ` — ${p.jabatan}` : ''}</option>)}
                            </select>
                            {form.errors.pegawai_id && <p className="mt-1 text-xs text-red-600">{form.errors.pegawai_id}</p>}
                        </div>
                    ) : (
                        <div className="max-w-xs">
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Jumlah Barang *</label>
                            <input type="number" min={1} value={form.data.jumlah} onChange={(e) => form.setData('jumlah', e.target.value)} className={FIELD} />
                            {form.errors.jumlah && <p className="mt-1 text-xs text-red-600">{form.errors.jumlah}</p>}
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Subkategori Aset yang Diminta *</label>
                        <select value={form.data.category_id} onChange={(e) => form.setData('category_id', e.target.value)} className={FIELD}>
                            <option value="">Pilih subkategori...</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {form.errors.category_id && <p className="mt-1 text-xs text-red-600">{form.errors.category_id}</p>}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-900">Keterangan / Alasan *</label>
                        <textarea value={form.data.keterangan} onChange={(e) => form.setData('keterangan', e.target.value)} rows={4} className={FIELD} placeholder="Jelaskan kebutuhan dan alasan permohonan." />
                        {form.errors.keterangan && <p className="mt-1 text-xs text-red-600">{form.errors.keterangan}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link href={route('asset-requests.index')} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</Link>
                        <button type="submit" disabled={form.processing} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {form.processing ? 'Mengirim...' : 'Ajukan Permohonan'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
